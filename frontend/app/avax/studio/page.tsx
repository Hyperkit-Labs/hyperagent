'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { DeploymentModal } from '@/components/deployment/DeploymentModal';
import { DynamicIsland } from '@/components/workflow/DynamicIsland';
import { createWorkflow, getWorkflowStatus } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, Code, Rocket } from 'lucide-react';

export default function StudioPage() {
  const [description, setDescription] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [contractData, setContractData] = useState<any>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  
  const account = useActiveAccount();

  const handleGenerate = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    if (!description.trim()) {
      setError('Please describe your smart contract');
      return;
    }

    setStatus('generating');
    setError(null);

    try {
      // Step 1: Create workflow (with x402 payment handling)
      const workflow = await createWorkflow({
        nlp_input: description,
        network: 'avalanche_fuji',
        contract_type: 'Custom',
        wallet_address: account.address,
      });

      setWorkflowId(workflow.workflow_id);

      // Step 2: Poll for completion
      const checkStatus = setInterval(async () => {
        const currentStatus = await getWorkflowStatus(workflow.workflow_id);
        
        if (currentStatus.status === 'completed') {
          clearInterval(checkStatus);
          setStatus('success');
          setContractData({
            workflowId: workflow.workflow_id,
            contractName: currentStatus.contracts?.[0]?.contract_name || 'Contract',
            contractCode: currentStatus.contracts?.[0]?.source_code || '',
            bytecode: currentStatus.contracts?.[0]?.bytecode || '',
            abi: currentStatus.contracts?.[0]?.abi || [],
            network: 'avalanche_fuji',
          });
        } else if (currentStatus.status === 'failed') {
          clearInterval(checkStatus);
          setStatus('failed');
          setError(currentStatus.error_message || 'Generation failed');
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => clearInterval(checkStatus), 300000);

    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Failed to generate contract');
    }
  };

  const handleDeploymentComplete = (txHash: string, contractAddress: string) => {
    setShowDeployModal(false);
    alert(`Contract deployed!\nAddress: ${contractAddress}\nTx: ${txHash}`);
  };

  return (
    <div className="min-h-screen bg-[#0A0B14] text-white">
      {workflowId && <DynamicIsland workflowId={workflowId} />}
      
      <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
        {/* Header */}
        <div className="text-center space-y-6 relative">
          <div className="absolute -top-24 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent">
            Avalanche Studio
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Architect, audit, and launch institutional-grade smart contracts on Avalanche Fuji. 
            Powered by spec-locked orchestrator and x402 micropayments.
          </p>
        </div>

        {/* Wallet Connection */}
        <Card className="bg-[#161721] border-white/5 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h3 className="font-bold text-xl mb-2">Wallet Hub</h3>
              <p className="text-gray-400">
                {account ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
                  </span>
                ) : 'Connect your wallet to enable deployment'}
              </p>
            </div>
            <WalletConnect />
          </div>
        </Card>

        {/* Contract Generation */}
        <Card className="bg-[#161721] border-white/5 p-8 overflow-hidden relative">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Code className="w-6 h-6 text-red-400" />
            </div>
            Describe Your Smart Contract
          </h3>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Deploy a HTP ERC20 with supply 40B, include team vesting and liquidity rewards, x402 compatible"
            className="w-full h-40 px-6 py-4 bg-[#0A0B14] border border-white/10 rounded-2xl text-white placeholder:text-gray-600 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 resize-none transition-all text-lg"
            disabled={status === 'generating'}
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
            >
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </motion.div>
          )}

          {status === 'generating' && (
            <div className="mt-6 p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-4">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-100 font-bold">Spec-Locked Orchestrator is Processing...</p>
                <p className="text-blue-300/70 text-sm mt-1">Generating contract code and auditing logic patterns (60-90s)</p>
              </div>
            </div>
          )}

          {status === 'success' && contractData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 bg-green-500/10 border border-green-500/20 rounded-xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-green-100 font-bold text-lg">Architectural Blueprint Verified</p>
                  <p className="text-green-300/70 text-sm mt-1">{contractData.contractName} is optimized for Avalanche Fuji</p>
                </div>
              </div>
              <Button
                onClick={() => setShowDeployModal(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-14 rounded-2xl font-bold text-lg shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <Rocket className="w-5 h-5" />
                Initiate Deployment Sequence
              </Button>
            </motion.div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!account || status === 'generating' || !description.trim()}
            className={`w-full mt-8 h-14 rounded-2xl font-bold text-lg transition-all ${
              status === 'generating' 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg shadow-red-500/20 hover:scale-[1.01]'
            }`}
          >
            {status === 'generating' ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Processing Architecture...
              </>
            ) : (
              'Generate Institutional Smart Contract'
            )}
          </Button>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500 font-medium uppercase tracking-widest">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              x402 Protocol: 0.01 USDC
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              Spec-Locked v2
            </span>
          </div>
        </Card>

        {/* How It Works */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Sync Wallet', desc: 'Connect Core or MetaMask' },
            { step: '02', title: 'Prompt AI', desc: 'Describe logic in English' },
            { step: '03', title: 'Audit TEE', desc: 'Secure generation & verification' },
            { step: '04', title: 'One-Click', desc: 'Deploy to Fuji C-Chain' },
          ].map((item) => (
            <Card key={item.step} className="bg-[#161721] border-white/5 p-6 hover:border-red-500/20 transition-all">
              <span className="text-red-500/50 font-mono text-sm block mb-4 tracking-tighter">{item.step}</span>
              <h4 className="font-bold text-white mb-2">{item.title}</h4>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Deployment Modal */}
      {showDeployModal && contractData && (
        <DeploymentModal
          workflowId={contractData.workflowId}
          contractName={contractData.contractName}
          contractCode={contractData.contractCode}
          bytecode={contractData.bytecode}
          abi={contractData.abi}
          network={contractData.network}
          onDeploymentComplete={handleDeploymentComplete}
          onCancel={() => setShowDeployModal(false)}
          isOpen={showDeployModal}
        />
      )}
    </div>
  );
}
