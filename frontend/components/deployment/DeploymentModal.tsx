'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { createFetchWithPayment, isThirdwebConfigured } from '@/lib/thirdwebClient';
import { handleX402FetchError, handleHttpErrorResponse, parseResponseData, MAX_PAYMENT_ALLOWED } from '@/lib/x402ErrorHandler';

interface DeploymentModalProps {
  workflowId: string;
  contractName: string;
  contractCode: string;
  bytecode: string;
  abi: any[];
  network: string;
  onDeploymentComplete: (txHash: string, contractAddress: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

interface DeploymentStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: string;
}

type NetworkInfo = {
  network: string;
  chain_id?: number | null;
  explorer?: string | null;
  currency?: string | null;
};

export function DeploymentModal({
  workflowId,
  contractName,
  contractCode,
  bytecode,
  abi,
  network,
  onDeploymentComplete,
  onCancel,
  isOpen,
}: DeploymentModalProps) {
  const [steps, setSteps] = useState<DeploymentStep[]>([
    { id: 'payment', label: 'Processing payment (if required)', status: 'pending' },
    { id: 'deploy', label: 'Deploying contract', status: 'pending' },
    { id: 'confirm', label: 'Confirming on blockchain', status: 'pending' },
  ]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  const wallet = useActiveWallet();
  const account = useActiveAccount();

  useEffect(() => {
    if (!isOpen) {
      setSteps([
        { id: 'payment', label: 'Processing payment (if required)', status: 'pending' },
        { id: 'deploy', label: 'Deploying contract', status: 'pending' },
        { id: 'confirm', label: 'Confirming on blockchain', status: 'pending' },
      ]);
      setTxHash(null);
      setContractAddress(null);
      setError(null);
      setNetworkInfo(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !network) return;

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    // Best-effort: resolve explorer/chain id for links.
    fetch(`${API_BASE_URL}/networks/${encodeURIComponent(network)}/features`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === 'object') {
          setNetworkInfo({
            network: (data as any).network ?? network,
            chain_id: (data as any).chain_id ?? null,
            explorer: (data as any).explorer ?? null,
            currency: (data as any).currency ?? null,
          });
        }
      })
      .catch(() => undefined);
  }, [isOpen, network]);

  const updateStep = (stepId: string, status: DeploymentStep['status'], details?: string) => {
    setSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, status, details } : step)));
  };

  const handleDeploy = async () => {
    if (!wallet || !account) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isThirdwebConfigured()) {
      setError('Thirdweb client not configured. Please set NEXT_PUBLIC_THIRDWEB_CLIENT_ID.');
      return;
    }

    setError(null);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const fetchWithPayment = createFetchWithPayment(wallet, MAX_PAYMENT_ALLOWED);

      updateStep('payment', 'in_progress', 'Submitting request (will prompt for payment if required)...');
      updateStep('deploy', 'in_progress', 'Waiting for deployment...');

      let response: Response;
      try {
        response = await fetchWithPayment(`${API_BASE_URL}/x402/deployments/deploy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': account.address,
          },
          body: JSON.stringify({
            compiled_contract: {
              contract_name: contractName,
              source_code: contractCode,
              bytecode: bytecode,
              abi: abi,
            },
            network: network,
            wallet_address: account.address,
            use_gasless: true,
          }),
        });
      } catch (fetchError) {
        handleX402FetchError(fetchError);
      }

      if (!response.ok) {
        await handleHttpErrorResponse(response);
      }

      const deploymentResult = await parseResponseData(response);

      updateStep('payment', 'completed');
      updateStep('deploy', 'completed');

      const outTxHash = (deploymentResult as any).transaction_hash || (deploymentResult as any).tx_hash;
      const outContractAddr = (deploymentResult as any).contract_address;

      if (outTxHash) {
        setTxHash(outTxHash);
      }

      if (outContractAddr) {
        setContractAddress(outContractAddr);
        updateStep('confirm', 'completed');
        onDeploymentComplete(outTxHash ?? '', outContractAddr);
      } else {
        updateStep('confirm', 'in_progress', 'Deployment submitted. Waiting for contract address...');
      }
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      const currentStep = steps.findIndex((s) => s.status === 'in_progress');
      if (currentStep >= 0) {
        updateStep(steps[currentStep].id, 'failed', err.message);
      }
    }
  };

  if (!isOpen) return null;

  const allCompleted = steps.every((s) => s.status === 'completed');
  const hasFailed = steps.some((s) => s.status === 'failed');
  const isBusy = steps.some((s) => s.status === 'in_progress');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2 text-white">Deploy Smart Contract</h2>
          <p className="text-gray-400 mb-6">
            Deploy {contractName} to {networkInfo?.network || network}
          </p>

          {/* Deployment Steps */}
          <div className="space-y-4 mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {step.status === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {step.status === 'in_progress' && (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${
                    step.status === 'completed' ? 'text-green-400' :
                    step.status === 'in_progress' ? 'text-blue-400' :
                    step.status === 'failed' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                  {step.details && (
                    <p className="text-sm text-gray-500 mt-1">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-sm font-semibold text-blue-400 mb-2">Transaction Hash</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-blue-300 break-all font-mono bg-gray-800/50 px-2 py-1 rounded border border-white/5">{txHash}</code>
                {networkInfo?.explorer && (
                  <a
                    href={`${networkInfo.explorer}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Contract Address */}
          {contractAddress && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-sm font-semibold text-green-400 mb-2">Contract Address</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-green-300 break-all font-mono bg-gray-800/50 px-2 py-1 rounded border border-white/5">{contractAddress}</code>
                {networkInfo?.explorer && (
                  <a
                    href={`${networkInfo.explorer}/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-green-400 hover:text-green-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400 mb-1">Deployment Error</h4>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Check */}
          {!account && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-400 text-sm">
                Please connect your wallet to deploy the contract
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isBusy || (allCompleted && !hasFailed)}
              className="flex-1"
            >
              {allCompleted ? 'Close' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              onClick={handleDeploy}
              disabled={!account || !wallet || allCompleted || hasFailed}
              loading={steps.some((s) => s.status === 'in_progress')}
              className="flex-1"
            >
              {allCompleted ? 'Deployed!' : hasFailed ? 'Failed' : 'Deploy Contract'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default DeploymentModal;

