'use client';

import { useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      {workflowId && <DynamicIsland workflowId={workflowId} />}
      
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            HyperAgent Studio
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Generate, audit, and deploy smart contracts in minutes with AI. Connect your wallet to get started.
          </p>
        </div>

        {/* Wallet Connection */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">Wallet Connection</h3>
              <p className="text-sm text-gray-600">
                {account ? `Connected: ${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Connect your wallet to continue'}
              </p>
            </div>
            <WalletConnect />
          </div>
        </Card>

        {/* Contract Generation */}
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Describe Your Smart Contract
          </h3>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Create an ERC20 token called MyToken with symbol MTK, initial supply of 1000000 tokens, and owner-only minting capability"
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            disabled={status === 'generating'}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {status === 'generating' && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-900 font-medium">Generating your contract...</p>
                <p className="text-blue-700 text-sm mt-1">This usually takes 60-90 seconds</p>
              </div>
            </div>
          )}

          {status === 'success' && contractData && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-900 font-medium">Contract generated successfully!</p>
                  <p className="text-green-700 text-sm mt-1">{contractData.contractName} is ready to deploy</p>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowDeployModal(true)}
                className="w-full flex items-center justify-center gap-2"
              >
                <Rocket className="w-4 h-4" />
                Deploy to Avalanche Fuji
              </Button>
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!account || status === 'generating' || !description.trim()}
            className="w-full mt-4"
          >
            {status === 'generating' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {status === 'generating' ? 'Generating...' : 'Generate Smart Contract'}
          </Button>

          <p className="text-xs text-gray-500 mt-2 text-center">
            Payment of 0.01 USDC will be required after generation
          </p>
        </Card>

        {/* How It Works */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <h3 className="font-semibold text-lg mb-4">How It Works</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">Connect Wallet</p>
                <p className="text-sm text-gray-600">Connect MetaMask, Core, OKX, or Phantom wallet</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">Describe Contract</p>
                <p className="text-sm text-gray-600">Describe your smart contract in plain English</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">AI Generation</p>
                <p className="text-sm text-gray-600">AI generates, compiles, and audits your contract</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                4
              </div>
              <div>
                <p className="font-medium">Deploy</p>
                <p className="text-sm text-gray-600">Sign deployment transaction in your wallet</p>
              </div>
            </div>
          </div>
        </Card>
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
