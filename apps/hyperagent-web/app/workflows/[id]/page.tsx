'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getWorkflow, prepareDeploymentTransaction, completeDeployment, getWorkflowContracts, submitClarification, cancelWorkflow } from '@/lib/api';
import type { Workflow } from '@/lib/types';
import { useActiveAccount } from 'thirdweb/react';
import { getThirdwebClient } from '@/lib/thirdwebClient';
import FileCode from 'lucide-react/dist/esm/icons/file-code';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Code from 'lucide-react/dist/esm/icons/code';
import Shield from 'lucide-react/dist/esm/icons/shield';
import TestTube from 'lucide-react/dist/esm/icons/test-tube';
import Rocket from 'lucide-react/dist/esm/icons/rocket';
import Copy from 'lucide-react/dist/esm/icons/copy';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
import Download from 'lucide-react/dist/esm/icons/download';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Link from 'next/link';
import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  generation: <Code className="w-5 h-5" />,
  compilation: <FileCode className="w-5 h-5" />,
  audit: <Shield className="w-5 h-5" />,
  testing: <TestTube className="w-5 h-5" />,
  deployment: <Rocket className="w-5 h-5" />,
};

const STAGE_NAMES: Record<string, string> = {
  generation: 'Code Generation',
  compilation: 'Compilation',
  audit: 'Security Audit',
  testing: 'Testing',
  deployment: 'Deployment',
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const account = useActiveAccount(); // Smart Wallet account (ERC-4337) - single source of truth
  const thirdwebClient = getThirdwebClient();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [contractCode, setContractCode] = useState<string | null>(null);
  const [contractData, setContractData] = useState<any>(null);
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({});
  const [submittingClarification, setSubmittingClarification] = useState(false);
  const [isFetching, setIsFetching] = useState(false); // Request deduplication
  const [cancelling, setCancelling] = useState(false); // Cancel workflow state
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null); // Track when polling started
  const [lastWorkflowStatus, setLastWorkflowStatus] = useState<string | null>(null); // Track last status
  const [statusUnchangedCount, setStatusUnchangedCount] = useState(0); // Count how many times status hasn't changed

  const handleCancel = async () => {
    if (!workflow) return;
    
    const cancellableStatuses = ['generating', 'processing', 'compiling', 'auditing', 'testing', 'deploying'];
    if (!cancellableStatuses.includes(workflow.status)) {
      toast.error('Workflow cannot be cancelled in its current state');
      return;
    }

    if (!confirm('Are you sure you want to cancel this workflow? This action cannot be undone.')) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      await cancelWorkflow(workflowId);
      toast.success('Workflow cancelled successfully');
      setAutoRefresh(true);
      // Refresh workflow status
      await fetchWorkflow();
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to cancel workflow';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCancelling(false);
    }
  };

  const fetchWorkflow = useCallback(async () => {
    // Request deduplication: don't start a new request if one is in flight
    if (isFetching) {
      return;
    }
    
    // Stop polling if we've been polling for more than 5 minutes
    if (pollingStartTime && Date.now() - pollingStartTime > 5 * 60 * 1000) {
      setAutoRefresh(false);
      console.log('Stopped polling after 5 minutes');
      return;
    }
    
    // Stop polling if status hasn't changed in 10 consecutive polls (50 seconds)
    if (lastWorkflowStatus && statusUnchangedCount >= 10) {
      setAutoRefresh(false);
      console.log('Stopped polling: status unchanged for 10 consecutive polls');
      return;
    }
    
    try {
      setIsFetching(true);
      setError(null);
      const data = await getWorkflow(workflowId);
      setWorkflow(data);
      
      // Track status changes
      if (data.status !== lastWorkflowStatus) {
        setLastWorkflowStatus(data.status);
        setStatusUnchangedCount(0);
      } else {
        setStatusUnchangedCount(prev => prev + 1);
      }
      
      // Check if clarification is needed
      if (data.status === 'clarification_needed' || data.meta_data?.clarification_questions) {
        setShowClarificationModal(true);
        setAutoRefresh(false); // Stop auto-refresh until clarified
      } else {
        setShowClarificationModal(false);
        setClarificationAnswers({});
      }
      
      // Check if capability is exceeded
      if (data.status === 'capability_exceeded') {
        setAutoRefresh(false); // Stop auto-refresh for capability-exceeded workflows
      }
      
      // Fetch contract code and ABI only when:
      // 1. We don't have contract data yet, OR
      // 2. Status changed to a state that might have new contract data (compiling, auditing, completed)
      const shouldFetchContracts = !contractData || 
                                   (data.status === 'completed' && !contractData.bytecode) ||
                                   (data.status === 'compiling' && lastWorkflowStatus !== 'compiling') ||
                                   (data.status === 'auditing' && lastWorkflowStatus !== 'auditing') ||
                                   (data.status === 'testing' && lastWorkflowStatus !== 'testing');
      
      if (shouldFetchContracts) {
        try {
          const contractsResponse = await getWorkflowContracts(workflowId);
          // Handle both array and object responses
          const contracts = Array.isArray(contractsResponse) ? contractsResponse : (contractsResponse.contracts || []);
          if (contracts && contracts.length > 0) {
            const contract = contracts[0];
            setContractData(contract);
            if (contract.source_code) {
              setContractCode(contract.source_code);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch contract data:', err);
        }
      }
      
      // Stop auto-refresh if workflow is completed (with or without deployment) OR failed OR cancelled
      if (data.status === 'failed' || 
          data.status === 'cancelled' ||
          data.status === 'completed') {
        setAutoRefresh(false);
        setPollingStartTime(null);
        setStatusUnchangedCount(0);
      }
      
      // Continue refreshing ONLY if deployment is pending signature (user action required)
      if (data.meta_data?.deployment_status === 'pending_signature' || 
          data.meta_data?.requires_user_signature ||
          data.metadata?.deployment_status === 'pending_signature' || 
          data.metadata?.requires_user_signature) {
        setAutoRefresh(true);
        if (!pollingStartTime) {
          setPollingStartTime(Date.now());
        }
      }
      
      // Refresh if workflow is still processing (but stop after timeout)
      if (data.status === 'generating' || 
          data.status === 'compiling' || 
          data.status === 'auditing' || 
          data.status === 'testing' || 
          data.status === 'deploying' ||
          data.status === 'processing') {
        setAutoRefresh(true);
        if (!pollingStartTime) {
          setPollingStartTime(Date.now());
        }
      }
    } catch (err) {
      // Only show error if it's not a transient network error during polling
      // (transient errors are handled by retry logic in fetchWithErrorHandling)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflow';
      
      // Don't show transient network errors during auto-refresh (they're expected)
      if (!autoRefresh || !errorMessage.includes('Network error')) {
        setError(errorMessage);
      }
      
      // Always log for debugging
      console.error('Failed to fetch workflow:', err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [workflowId, isFetching, autoRefresh]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Auto-refresh every 5 seconds while workflow is in progress (increased from 3s to reduce load)
  useEffect(() => {
    if (!autoRefresh) {
      // Reset polling state when auto-refresh stops
      setPollingStartTime(null);
      setStatusUnchangedCount(0);
      setLastWorkflowStatus(null);
      return;
    }

    // Initialize polling start time when auto-refresh begins
    if (!pollingStartTime) {
      setPollingStartTime(Date.now());
    }

    const interval = setInterval(() => {
      fetchWorkflow();
    }, 5000); // Increased from 3000ms to 5000ms to reduce connection pressure

    return () => clearInterval(interval);
  }, [autoRefresh, fetchWorkflow, pollingStartTime]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const downloadContractCode = () => {
    if (!contractCode || !contractData) return;
    const filename = `${contractData.contract_name || 'Contract'}.sol`;
    downloadFile(contractCode, filename, 'text/plain');
  };

  const downloadABI = () => {
    if (!contractData || !contractData.abi) return;
    const abiJson = JSON.stringify(contractData.abi, null, 2);
    const filename = `${contractData.contract_name || 'Contract'}.json`;
    downloadFile(abiJson, filename, 'application/json');
  };

  const handleDeploy = async () => {
    if (!account || !thirdwebClient) {
      toast.error('Please connect your wallet');
      return;
    }
    
    if (!account.address) {
      toast.error('Wallet account not available');
      return;
    }

    if (!workflow) {
      toast.error('Workflow not loaded');
      return;
    }

    setDeploying(true);
    setError(null);

    try {
      const { deployUserContractEoa } = await import('@/lib/eoaDeploy');
      const { getChainFromNetwork } = await import('@/lib/smartWalletDeploy');
      
      // Get contract details
      const contracts = await getWorkflowContracts(workflowId);
      if (!contracts || contracts.length === 0) {
        throw new Error('No contract found for workflow');
      }
      const contract = contracts[0];
      
      // Validate contract has required data
      if (!contract.bytecode || !contract.abi) {
        throw new Error('Contract missing bytecode or ABI. Please ensure compilation completed successfully.');
      }

      if (!account?.address) {
        throw new Error('Wallet not connected');
      }

      const walletAddress = account.address;
      const workflowWalletAddress = (workflow as any).meta_data?.wallet_address || (workflow as any).metadata?.wallet_address;
      
      if (workflowWalletAddress && walletAddress.toLowerCase() !== workflowWalletAddress.toLowerCase()) {
        throw new Error(
          `Wallet ownership mismatch. This workflow belongs to wallet ${workflowWalletAddress.slice(0, 10)}...${workflowWalletAddress.slice(-8)}, ` +
          `but you are connected with wallet ${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}. ` +
          `Please connect the wallet that created this workflow to deploy.`
        );
      }

      const chain = getChainFromNetwork(workflow.network);
      
      console.log('[WorkflowDeploy] Account details:', {
        address: account.address,
        accountType: (account as any).type || (account as any).accountType || 'unknown',
      });

      if (!account.address || account.address.length !== 42 || !account.address.startsWith('0x')) {
        throw new Error('Invalid wallet account. Please reconnect your wallet.');
      }
      
      toast.info('Deploying contract from wallet...');
      
      const deploymentResult = await deployUserContractEoa({
        account,
        chain,
        abi: contract.abi,
        bytecode: contract.bytecode,
        constructorArgs: [],
      });

      toast.info('Contract deployed! Updating workflow status...');

      // Ensure transaction hash is present
      if (!deploymentResult.transactionHash) {
        throw new Error('Transaction hash not returned from deployment. Please check the deployment result.');
      }

      await completeDeployment(workflowId, {
        contractAddress: deploymentResult.contractAddress,
        transactionHash: deploymentResult.transactionHash,
        walletAddress: walletAddress,
      });

      toast.success(`Deployment successful! Contract deployed at ${deploymentResult.contractAddress}`);
      
      // Refresh workflow to get updated status
      await fetchWorkflow();
      setAutoRefresh(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Deployment failed';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Deployment error:', err);
    } finally {
      setDeploying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'capability_exceeded':
        return 'text-yellow-400';
      case 'processing':
      case 'generating':
      case 'compiling':
      case 'auditing':
      case 'testing':
      case 'deploying':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-400" />;
      case 'capability_exceeded':
        return <AlertCircle className="w-6 h-6 text-yellow-400" />;
      case 'processing':
      case 'generating':
      case 'compiling':
      case 'auditing':
      case 'testing':
      case 'deploying':
        return <Clock className="w-6 h-6 text-yellow-400 animate-pulse" />;
      default:
        return <Clock className="w-6 h-6 text-gray-400" />;
    }
  };

  const getExplorerUrl = (network: string, addressOrHash: string, isTx: boolean = false) => {
    const explorers: Record<string, string> = {
      mantle_testnet: 'https://sepolia.mantlescan.xyz',
      mantle_mainnet: 'https://mantlescan.xyz',
      avalanche_fuji: 'https://testnet.snowtrace.io',
      avalanche_mainnet: 'https://snowtrace.io',
    };
    const baseUrl = explorers[network] || explorers.mantle_testnet;
    const path = isTx ? 'tx' : 'address';
    return `${baseUrl}/${path}/${addressOrHash}`;
  };

  if (loading) {
    return (
      <div className="relative w-full bg-[#030712] text-white min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading workflow..." />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="relative w-full bg-[#030712] text-white min-h-screen">
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          <Card className="p-12 bg-gray-900/50 backdrop-blur-xl border border-red-500/20 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-2xl font-bold text-red-400 mb-2">Error Loading Workflow</h2>
            <p className="text-gray-400 mb-6">{error || 'Workflow not found'}</p>
            <Link href="/workflows">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Workflows
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-[#030712] text-white min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex items-center justify-between">
            <div>
              <Link href="/workflows">
                <Button variant="ghost" className="text-gray-400 hover:text-white mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Workflows
                </Button>
              </Link>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                {getStatusIcon(workflow.status)}
                Workflow Details
              </h1>
              <p className="text-gray-400 mt-2">ID: {workflow.workflow_id}</p>
            </div>
            <div className="flex gap-2">
              {(workflow.status === 'generating' || 
                workflow.status === 'processing' || 
                workflow.status === 'compiling' || 
                workflow.status === 'auditing' || 
                workflow.status === 'testing' || 
                workflow.status === 'deploying') && (
                <Button 
                  onClick={handleCancel} 
                  variant="outline" 
                  disabled={cancelling}
                  className="border-red-500/50 text-red-400 hover:text-red-300 hover:border-red-500 disabled:opacity-50"
                >
                  {cancelling ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Stop Workflow
                    </>
                  )}
                </Button>
              )}
              <Button onClick={fetchWorkflow} variant="outline" className="border-white/10 text-gray-300 hover:text-white">
                <Clock className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </motion.div>

          {/* Status Card */}
          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <p className={`text-2xl font-bold ${getStatusColor(workflow.status)}`}>
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Network</p>
                  <p className="text-lg font-semibold text-white">{workflow.network}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Progress</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {workflow.progress_percentage || 0}%
                  </p>
                </div>
              </div>
              {workflow.progress_percentage !== undefined && (
                <div className="mt-4">
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${workflow.progress_percentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Capability Exceeded Display */}
          {workflow.status === 'capability_exceeded' && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/20">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                        Capability Exceeded
                      </h3>
                      <p className="text-sm text-yellow-300">
                        Your requirements exceed the current system capabilities. We've generated a detailed design document with alternatives and recommendations.
                      </p>
                    </div>
                    
                    {/* Capability Assessment */}
                    {workflow.meta_data?.capability_assessment && (
                      <div className="mt-4 p-4 bg-black/30 rounded-lg border border-yellow-500/10">
                        <h4 className="text-sm font-semibold text-yellow-400 mb-2">Unsupported Features</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                          {(workflow.meta_data.capability_assessment.unsupported_features || []).map((feature: string, idx: number) => (
                            <li key={idx}>{feature}</li>
                          ))}
                        </ul>
                        {workflow.meta_data.capability_assessment.reasoning && (
                          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-yellow-500/10">
                            {workflow.meta_data.capability_assessment.reasoning}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Design Document */}
                    {workflow.meta_data?.design_document && (
                      <div className="mt-4 space-y-4">
                        <h4 className="text-sm font-semibold text-yellow-400">Design Document</h4>
                        
                        {/* Executive Summary */}
                        {workflow.meta_data.design_document.executive_summary && (
                          <div className="p-4 bg-black/30 rounded-lg border border-yellow-500/10">
                            <h5 className="text-xs font-semibold text-yellow-400 mb-2">Executive Summary</h5>
                            <p className="text-sm text-gray-300">{workflow.meta_data.design_document.executive_summary}</p>
                          </div>
                        )}
                        
                        {/* Alternative Solutions */}
                        {workflow.meta_data.design_document.alternative_solutions && 
                         workflow.meta_data.design_document.alternative_solutions.length > 0 && (
                          <div className="p-4 bg-black/30 rounded-lg border border-yellow-500/10">
                            <h5 className="text-xs font-semibold text-yellow-400 mb-3">Alternative Solutions</h5>
                            <div className="space-y-3">
                              {workflow.meta_data.design_document.alternative_solutions.map((solution: any, idx: number) => (
                                <div key={idx} className="pb-3 border-b border-yellow-500/10 last:border-0 last:pb-0">
                                  <h6 className="text-sm font-medium text-white mb-1">{solution.title}</h6>
                                  <p className="text-xs text-gray-400 mb-2">{solution.description}</p>
                                  {solution.pros && solution.pros.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-green-400 mb-1">Pros:</p>
                                      <ul className="list-disc list-inside text-xs text-gray-400 space-y-0.5">
                                        {solution.pros.map((pro: string, pIdx: number) => (
                                          <li key={pIdx}>{pro}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Modification Recommendations */}
                        {workflow.meta_data.design_document.modification_recommendations && (
                          <div className="p-4 bg-black/30 rounded-lg border border-yellow-500/10">
                            <h5 className="text-xs font-semibold text-yellow-400 mb-3">Modification Recommendations</h5>
                            {workflow.meta_data.design_document.modification_recommendations.features_to_remove && 
                             workflow.meta_data.design_document.modification_recommendations.features_to_remove.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-400 mb-1">Features to Remove:</p>
                                <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">
                                  {workflow.meta_data.design_document.modification_recommendations.features_to_remove.map((feature: string, idx: number) => (
                                    <li key={idx}>{feature}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {workflow.meta_data.design_document.modification_recommendations.step_by_step_approach && 
                             workflow.meta_data.design_document.modification_recommendations.step_by_step_approach.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Step-by-Step Approach:</p>
                                <ol className="list-decimal list-inside text-xs text-gray-300 space-y-1">
                                  {workflow.meta_data.design_document.modification_recommendations.step_by_step_approach.map((step: string, idx: number) => (
                                    <li key={idx}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Next Steps */}
                        {workflow.meta_data.design_document.next_steps && 
                         workflow.meta_data.design_document.next_steps.length > 0 && (
                          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <h5 className="text-xs font-semibold text-blue-400 mb-2">Next Steps</h5>
                            <ol className="list-decimal list-inside text-xs text-gray-300 space-y-1">
                              {workflow.meta_data.design_document.next_steps.map((step: string, idx: number) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Action Button */}
                    <div className="mt-4 flex gap-3">
                      <Button
                        onClick={() => router.push('/workflows/create')}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        Create New Workflow
                      </Button>
                      {workflow.meta_data?.design_document && (
                        <Button
                          onClick={() => {
                            const designDoc = JSON.stringify(workflow.meta_data.design_document, null, 2);
                            const blob = new Blob([designDoc], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `design-document-${workflowId}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success('Design document downloaded');
                          }}
                          variant="outline"
                          className="border-yellow-500/20 text-yellow-400 hover:text-yellow-300"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Design Document
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Error Message Display */}
          {workflow.error_message && workflow.status !== 'capability_exceeded' && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-red-500/10 backdrop-blur-xl border border-red-500/20">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                      Workflow Failed
                    </h3>
                    <div className="space-y-2">
                      <p className="text-sm text-red-300 whitespace-pre-wrap font-mono">
                        {workflow.error_message}
                      </p>
                      {workflow.retry_count > 0 && (
                        <p className="text-xs text-gray-400 mt-2">
                          Retried {workflow.retry_count} time(s)
                        </p>
                      )}
                      {/* Show stage where error occurred */}
                      {workflow.progress_percentage !== undefined && (
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="text-xs text-gray-400">
                            Failed at {workflow.progress_percentage}% progress
                            {workflow.progress_percentage <= 20 && " (Generation stage)"}
                            {workflow.progress_percentage > 20 && workflow.progress_percentage <= 40 && " (Compilation stage)"}
                            {workflow.progress_percentage > 40 && workflow.progress_percentage <= 60 && " (Audit stage)"}
                            {workflow.progress_percentage > 60 && workflow.progress_percentage <= 80 && " (Testing stage)"}
                            {workflow.progress_percentage > 80 && " (Deployment stage)"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Clarification Modal */}
          {showClarificationModal && workflow && (workflow.status === 'clarification_needed' || workflow.meta_data?.clarification_questions) && (
            <motion.div
              variants={itemVariants}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowClarificationModal(false);
                }
              }}
            >
              <Card className="w-full max-w-2xl p-8 bg-gray-900 border border-white/20">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Clarification Needed</h2>
                    <p className="text-gray-400">
                      We need a bit more information to generate your contract accurately.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {(workflow.meta_data?.clarification_questions || []).map((question: string, index: number) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {question}
                        </label>
                        <textarea
                          className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Your answer..."
                          value={clarificationAnswers[index] || ''}
                          onChange={(e) => {
                            setClarificationAnswers({
                              ...clarificationAnswers,
                              [index]: e.target.value,
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-4 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowClarificationModal(false)}
                      className="border-white/10 text-gray-300 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        const questions = workflow.meta_data?.clarification_questions || [];
                        const originalPrompt = workflow.meta_data?.original_prompt || workflow.nlp_input || '';
                        
                        // Combine original prompt with answers
                        const answers = questions.map((q: string, i: number) => 
                          `Q: ${q}\nA: ${clarificationAnswers[i] || ''}`
                        ).join('\n\n');
                        
                        const clarifiedPrompt = `${originalPrompt}\n\nClarifications:\n${answers}`;
                        
                        setSubmittingClarification(true);
                        try {
                          await submitClarification(workflowId, clarifiedPrompt);
                          setShowClarificationModal(false);
                          toast.success('Clarification submitted. Workflow continuing...');
                          setClarificationAnswers({});
                          // Refresh workflow after a short delay
                          setTimeout(() => {
                            fetchWorkflow();
                          }, 1000);
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to submit clarification');
                        } finally {
                          setSubmittingClarification(false);
                        }
                      }}
                      disabled={submittingClarification || Object.keys(clarificationAnswers).length === 0}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {submittingClarification ? 'Submitting...' : 'Submit & Continue'}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Request Details */}
          <motion.div variants={itemVariants}>
            <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Request Details</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Generated Smart Contract</p>
                  <p className="text-white">
                    {contractCode ? (
                      <span className="text-green-400 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Contract Generated
                      </span>
                    ) : workflow.contracts && workflow.contracts.length > 0 ? (
                      <span className="text-green-400 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {workflow.contracts[0].contract_name || 'Contract'}
                      </span>
                    ) : (
                      <span className="text-gray-500">Not yet generated</span>
                    )}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-400 mb-1">Contract Type</p>
                  <p className="text-white">{workflow.contract_type || 'Custom'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-400 mb-1">Network</p>
                  <p className="text-white">{workflow.network || 'N/A'}</p>
                </div>
                
                {workflow.deployment_result?.transaction_hash && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-blue-400 font-mono text-xs break-all">
                        {workflow.deployment_result.transaction_hash}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(workflow.deployment_result.transaction_hash)}
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <a
                        href={getExplorerUrl(workflow.network, workflow.deployment_result.transaction_hash, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
                
                {workflow.deployment_result?.contract_address && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Contract Address</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-green-400 font-mono text-xs break-all">
                        {workflow.deployment_result.contract_address}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(workflow.deployment_result.contract_address)}
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <a
                        href={getExplorerUrl(workflow.network, workflow.deployment_result.contract_address)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
                
                {/* Show deployment button when:
                    1. Deployment is pending signature (from meta_data)
                    2. Workflow is completed but no contract address exists (deployment not done yet)
                    3. Workflow status is processing/deploying with pending deployment
                */}
                {((workflow.meta_data?.deployment_status === 'pending_signature' || 
                   workflow.meta_data?.requires_user_signature ||
                   workflow.metadata?.deployment_status === 'pending_signature' ||
                   workflow.metadata?.requires_user_signature) && 
                  !workflow.deployment_result?.contract_address) ||
                 (workflow.status === 'completed' && 
                  !workflow.deployment_result?.contract_address &&
                  contractData && 
                  contractData.bytecode) && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-400 mb-1">
                          {workflow.status === 'completed' ? 'Ready to Deploy' : 'Waiting for Approval'}
                        </p>
                        <p className="text-sm text-gray-300 mb-3">
                          {workflow.meta_data?.deployment_message || 
                           workflow.metadata?.deployment_message || 
                           'Please sign the deployment transaction in your wallet to deploy the contract. Gas fees will be sponsored by paymaster for supported networks.'}
                        </p>
                        {account ? (
                          <Button
                            onClick={handleDeploy}
                            disabled={deploying}
                            className="bg-blue-600 hover:bg-blue-500 text-white"
                          >
                            {deploying ? (
                              <>
                                <LoadingSpinner size="sm" />
                                <span className="ml-2">Deploying...</span>
                              </>
                            ) : (
                              <>
                                <Rocket className="w-4 h-4 mr-2" />
                                Deploy Contract
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Wallet className="w-4 h-4" />
                            <span>Please connect your wallet to deploy</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Workflow Stages - End-to-End Pipeline */}
          <motion.div variants={itemVariants}>
            <h2 className="text-xl font-bold text-white mb-4">Workflow Stages</h2>
            <div className="space-y-3">
              {(() => {
                // Use stages from backend if available, otherwise calculate from workflow status
                const backendStages = workflow.stages || [];
                const stageMap = new Map(backendStages.map((s: any) => [s.name || s.stage, s]));

                // Define all required stages
                const REQUIRED_STAGES = [
                  { name: 'generation', label: 'Code Generation', required: true },
                  { name: 'compilation', label: 'Compilation', required: true },
                  { name: 'audit', label: 'Security Audit', required: true },
                  { name: 'testing', label: 'Testing', required: true },
                  { name: 'deployment', label: 'Deployment', required: true },
                ];

                // Render all required stages
                return REQUIRED_STAGES.map((stageDef) => {
                  const stage = stageMap.get(stageDef.name);
                  let status = stage?.status || 'pending';
                  
                  // Fallback: Determine status from workflow state if backend stages not available
                  if (!stage) {
                    // Generation: Check if contract exists
                    if (stageDef.name === 'generation') {
                      status = contractData?.source_code ? 'completed' : 
                               workflow.status === 'generating' ? 'processing' : 'pending';
                    }
                    // Compilation: Check if bytecode exists
                    else if (stageDef.name === 'compilation') {
                      status = contractData?.bytecode ? 'completed' : 
                               workflow.status === 'generating' && workflow.progress_percentage > 20 ? 'processing' : 'pending';
                    }
                    // Audit: Check metadata
                    else if (stageDef.name === 'audit') {
                      const auditResult = workflow.meta_data?.audit_result || workflow.metadata?.audit_result;
                      status = auditResult ? (auditResult.status === 'failed' ? 'failed' : 'completed') :
                               workflow.status === 'auditing' ? 'processing' : 'pending';
                    }
                    // Testing: Check metadata
                    else if (stageDef.name === 'testing') {
                      const testResult = workflow.meta_data?.test_result || workflow.metadata?.test_result;
                      status = testResult ? (testResult.status === 'failed' ? 'failed' : 'completed') :
                               workflow.status === 'testing' ? 'processing' : 'pending';
                    }
                    // Deployment: Check deployments or metadata
                    else if (stageDef.name === 'deployment') {
                      status = workflow.deployment_result?.contract_address ? 'completed' :
                               workflow.meta_data?.deployment_status === 'pending_signature' ? 'pending' :
                               workflow.status === 'deploying' ? 'processing' :
                               workflow.status === 'completed' && contractData?.bytecode ? 'pending' : 'pending';
                    }
                  }
                  
                  const isCompleted = status === 'completed' || status === 'COMPLETED';
                  const isFailed = status === 'failed' || status === 'FAILED';
                  const isProcessing = status === 'processing' || status === 'PROCESSING';

                  return (
                    <Card 
                      key={stageDef.name} 
                      className={`p-4 bg-gray-900/50 backdrop-blur-xl border ${
                        isCompleted ? 'border-green-500/20' : 
                        isFailed ? 'border-red-500/20' : 
                        isProcessing ? 'border-yellow-500/20' : 
                        'border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          isCompleted ? 'bg-green-500/10 text-green-400' :
                          isFailed ? 'bg-red-500/10 text-red-400' :
                          isProcessing ? 'bg-yellow-500/10 text-yellow-400 animate-pulse' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {STAGE_ICONS[stageDef.name] || <Clock className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">{stageDef.label}</p>
                            {stageDef.required && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Required
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${
                            isCompleted ? 'text-green-400' :
                            isFailed ? 'text-red-400' :
                            isProcessing ? 'text-yellow-400' :
                            'text-gray-400'
                          }`}>
                            {isCompleted ? 'Completed' :
                             isFailed ? 'Failed' :
                             isProcessing ? 'In Progress...' :
                             status === 'pending' ? 'Pending' : 'Pending'}
                          </p>
                          {(stage?.error || (isFailed && workflow.error_message && (
                            (stageDef.name === 'generation' && workflow.progress_percentage <= 20) ||
                            (stageDef.name === 'compilation' && workflow.progress_percentage > 20 && workflow.progress_percentage <= 40) ||
                            (stageDef.name === 'audit' && workflow.progress_percentage > 40 && workflow.progress_percentage <= 60) ||
                            (stageDef.name === 'testing' && workflow.progress_percentage > 60 && workflow.progress_percentage <= 80) ||
                            (stageDef.name === 'deployment' && workflow.progress_percentage > 80)
                          ))) && (
                            <p className="text-xs text-red-400 mt-1 whitespace-pre-wrap">
                              {stage?.error || (isFailed ? workflow.error_message : '')}
                            </p>
                          )}
                        </div>
                        {isCompleted && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {isFailed && <XCircle className="w-5 h-5 text-red-400" />}
                        {isProcessing && <LoadingSpinner size="sm" />}
                        {!isCompleted && !isFailed && !isProcessing && (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </Card>
                  );
                });
              })()}
            </div>
          </motion.div>

          {/* Deployment Result */}
          {workflow.deployment_result && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-green-500/20">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-green-400" />
                  Deployment Result
                </h2>
                <div className="space-y-4">
                  {workflow.deployment_result.contract_address && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Contract Address</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-2 bg-black/30 rounded-lg text-green-400 font-mono text-sm">
                          {workflow.deployment_result.contract_address}
                        </code>
                        <Button
                          onClick={() => copyToClipboard(workflow.deployment_result.contract_address)}
                          variant="ghost"
                          size="sm"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <a
                          href={getExplorerUrl(workflow.network, workflow.deployment_result.contract_address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}
                  {workflow.deployment_result.transaction_hash && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-2 bg-black/30 rounded-lg text-blue-400 font-mono text-sm break-all">
                          {workflow.deployment_result.transaction_hash}
                        </code>
                        <Button
                          onClick={() => copyToClipboard(workflow.deployment_result.transaction_hash)}
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <a
                          href={getExplorerUrl(workflow.network, workflow.deployment_result.transaction_hash, true)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="shrink-0">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}
                  {workflow.deployment_result.eigenda_commitment && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">EigenDA Commitment</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-2 bg-black/30 rounded-lg text-purple-400 font-mono text-sm">
                          {workflow.deployment_result.eigenda_commitment}
                        </code>
                        <Button
                          onClick={() => copyToClipboard(workflow.deployment_result.eigenda_commitment)}
                          variant="ghost"
                          size="sm"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Generated Smart Contract Card */}
          {contractCode && contractData && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-blue-400" />
                    Generated Smart Contract
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => copyToClipboard(contractCode)}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </Button>
                    <Button
                      onClick={downloadContractCode}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export .sol
                    </Button>
                  </div>
                </div>

                {/* File Name */}
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">File Name</p>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-1.5 bg-black/30 rounded-lg text-blue-400 font-mono text-sm">
                      {contractData.contract_name || 'Contract'}.sol
                    </code>
                    {contractData.solidity_version && (
                      <span className="text-xs text-gray-500">
                        Solidity {contractData.solidity_version}
                      </span>
                    )}
                  </div>
                </div>

                {/* Contract Code Snippet */}
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-2">Solidity Code</p>
                  <div className="relative">
                    <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto max-h-[400px] text-sm border border-white/5">
                      <code className="text-gray-300 font-mono whitespace-pre">{contractCode}</code>
                    </pre>
                    <div className="absolute top-2 right-2">
                      <Button
                        onClick={() => copyToClipboard(contractCode)}
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ABI Artifact */}
                {contractData.abi && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-400">ABI Artifact</p>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => copyToClipboard(JSON.stringify(contractData.abi, null, 2))}
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white h-7 text-xs"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy ABI
                        </Button>
                        <Button
                          onClick={downloadABI}
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white h-7 text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Export .json
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto max-h-[300px] text-xs border border-white/5">
                        <code className="text-gray-300 font-mono whitespace-pre">
                          {JSON.stringify(contractData.abi, null, 2)}
                        </code>
                      </pre>
                      <div className="absolute top-2 right-2">
                        <Button
                          onClick={() => copyToClipboard(JSON.stringify(contractData.abi, null, 2))}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Contract Code Fallback */}
          {workflow.contract_code && !contractCode && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Generated Contract Code</h2>
                <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto max-h-[500px] text-sm">
                  <code className="text-gray-300">{workflow.contract_code}</code>
                </pre>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
