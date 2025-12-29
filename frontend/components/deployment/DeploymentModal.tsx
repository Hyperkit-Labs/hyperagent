'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall, toHex, prepareTransaction, getContract } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { getThirdwebClient } from '@/lib/thirdwebClient';

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

const NETWORK_CONFIG: Record<string, { chainId: number; name: string; explorer: string }> = {
  avalanche_fuji: {
    chainId: 43113,
    name: 'Avalanche Fuji Testnet',
    explorer: 'https://testnet.snowtrace.io',
  },
  avalanche_mainnet: {
    chainId: 43114,
    name: 'Avalanche Mainnet',
    explorer: 'https://snowtrace.io',
  },
  mantle_testnet: {
    chainId: 5003,
    name: 'Mantle Testnet',
    explorer: 'https://explorer.testnet.mantle.xyz',
  },
  mantle_mainnet: {
    chainId: 5000,
    name: 'Mantle Mainnet',
    explorer: 'https://explorer.mantle.xyz',
  },
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
    { id: 'payment', label: 'Processing payment', status: 'pending' },
    { id: 'deploy', label: 'Deploying contract', status: 'pending' },
    { id: 'confirm', label: 'Confirming on blockchain', status: 'pending' },
  ]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const account = useActiveAccount();
  const { mutate: sendTransaction, data: txResult, isPending, isSuccess, isError, error: txError } = useSendTransaction();
  const client = getThirdwebClient();

  const networkConfig = NETWORK_CONFIG[network];
  const chain = networkConfig ? defineChain(networkConfig.chainId) : undefined;
  
  const [preparedTransaction, setPreparedTransaction] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSteps([
        { id: 'payment', label: 'Processing payment', status: 'pending' },
        { id: 'deploy', label: 'Deploying contract', status: 'pending' },
        { id: 'confirm', label: 'Confirming on blockchain', status: 'pending' },
      ]);
      setTxHash(null);
      setContractAddress(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (txResult && txResult.transactionHash) {
      console.log('Transaction result:', txResult);
      setTxHash(txResult.transactionHash);
      updateStep('broadcast', 'completed');
      updateStep('confirm', 'in_progress', 'Waiting for confirmations...');
    }
  }, [txResult]);

  useEffect(() => {
    if (txError) {
      console.error('Transaction error:', txError);
      setError(txError.message || 'Transaction failed');
      const signStep = steps.find(s => s.id === 'sign');
      if (signStep && signStep.status === 'in_progress') {
        updateStep('sign', 'failed', 'User rejected transaction');
      }
    }
  }, [txError]);

  const updateStep = (stepId: string, status: DeploymentStep['status'], details?: string) => {
    setSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, details } : step
      )
    );
  };

  const { mutateAsync: sendPaymentTransaction } = useSendTransaction();

  const handleDeploy = async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setError(null);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const client = getThirdwebClient();
      
      updateStep('payment', 'in_progress', 'Checking payment requirements...');
      
      // Step 1: Make initial request to get payment requirements
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/x402/deployments/deploy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Wallet-Address': account.address,
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
        console.error('Network error:', fetchError);
        throw new Error(
          'Cannot connect to backend API. Please ensure the backend is running at ' + API_BASE_URL
        );
      }

      // Step 2: Handle 402 Payment Required
      if (response.status === 402) {
        const paymentData = await response.json();
        console.log('Payment required:', paymentData);
        
        updateStep('payment', 'in_progress', 'Approve USDC payment in your wallet');
        
        // Extract payment details from x402 response
        // x402 v2 format: includes chainId, to, amount, token in x402_token or directly
        const x402Token = paymentData.x402_token || paymentData;
        const chainId = x402Token.chainId || paymentData.chainId || 43113; // Avalanche Fuji
        
        // USDC contract addresses by chain
        const USDC_ADDRESSES: Record<number, string> = {
          43113: '0x5425890298aed601595a70AB815c96711a31Bc65', // Avalanche Fuji USDC
          43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // Avalanche Mainnet USDC
          5003: '0x...', // Mantle Testnet (replace with actual)
          5000: '0x...', // Mantle Mainnet (replace with actual)
        };
        
        const usdcAddress = x402Token.token || paymentData.token || USDC_ADDRESSES[chainId];
        const recipientAddress = x402Token.to || paymentData.to || process.env.NEXT_PUBLIC_USDC_RECIPIENT_ADDRESS;
        
        // Parse amount - x402 might return it in various formats
        let amountWei: string;
        const rawAmount = x402Token.amount || paymentData.amount;
        if (typeof rawAmount === 'string') {
          amountWei = rawAmount;
        } else if (typeof rawAmount === 'number') {
          // Convert USDC (6 decimals) - e.g., 0.10 USDC = 100000
          amountWei = Math.floor(rawAmount * 1000000).toString();
        } else {
          // Default to 0.10 USDC
          amountWei = '100000';
        }
        
        if (!usdcAddress) {
          throw new Error(`USDC address not found for chain ${chainId}`);
        }
        
        if (!recipientAddress) {
          throw new Error('Payment recipient address not configured');
        }
        
        console.log('Payment details:', { chainId, usdcAddress, recipientAddress, amountWei });
        
        // Define the chain
        const chain = defineChain(chainId);
        
        // Create USDC contract instance
        const usdcContract = getContract({
          client,
          chain,
          address: usdcAddress,
        });
        
        // Prepare USDC transfer transaction
        const transaction = prepareContractCall({
          contract: usdcContract,
          method: 'function transfer(address to, uint256 amount) returns (bool)',
          params: [recipientAddress, BigInt(amountWei)],
        });
        
        // Send transaction and wait for wallet approval
        const txResult = await sendPaymentTransaction(transaction);
        console.log('Payment transaction sent:', txResult.transactionHash);
        
        updateStep('payment', 'in_progress', 'Payment confirmed, processing deployment...');
        
        // Step 3: Retry deployment with payment proof
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for payment confirmation
        
        response = await fetch(`${API_BASE_URL}/x402/deployments/deploy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Wallet-Address': account.address,
            'X-Payment-Hash': txResult.transactionHash,
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
      }

      // Step 4: Check if deployment succeeded
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Deployment error:', errorData);
        
        let errorMessage = 'Deployment failed';
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (typeof errorData.detail === 'object') {
          errorMessage = JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
        
        throw new Error(errorMessage);
      }

      const deploymentResult = await response.json();
      
      updateStep('payment', 'completed');
      updateStep('deploy', 'in_progress', 'Server is deploying your contract...');
      
      // Extract transaction info
      const txHash = deploymentResult.transaction_hash || deploymentResult.tx_hash;
      const contractAddr = deploymentResult.contract_address;
      
      if (txHash) {
        setTxHash(txHash);
        updateStep('deploy', 'completed');
        updateStep('confirm', 'in_progress', 'Waiting for blockchain confirmation...');
      }
      
      if (contractAddr) {
        setContractAddress(contractAddr);
        updateStep('confirm', 'completed');
        
        onDeploymentComplete(txHash, contractAddr);
      }

    } catch (err: any) {
      console.error('Deployment error:', err);
      setError(err.message || 'Deployment failed');
      const currentStep = steps.findIndex(s => s.status === 'in_progress');
      if (currentStep >= 0) {
        updateStep(steps[currentStep].id, 'failed', err.message);
      }
    }
  };

  const handleConfirmation = async () => {
    if (!txHash) return;

    try {
      // Call backend to track deployment
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/deploy/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_hash: txHash,
          network: network,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm deployment');
      }

      const result = await response.json();
      setContractAddress(result.contract_address);
      updateStep('confirm', 'completed', `Contract deployed at ${result.contract_address}`);

      // Notify parent component
      setTimeout(() => {
        onDeploymentComplete(txHash, result.contract_address);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
      updateStep('confirm', 'failed', err.message);
    }
  };

  useEffect(() => {
    if (txHash && !contractAddress) {
      // Start checking for confirmation
      const timer = setTimeout(() => {
        handleConfirmation();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [txHash, contractAddress]);

  if (!isOpen) return null;

  const allCompleted = steps.every(s => s.status === 'completed');
  const hasFailed = steps.some(s => s.status === 'failed');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">Deploy Smart Contract</h2>
          <p className="text-gray-600 mb-6">
            Deploy {contractName} to {networkConfig?.name || network}
          </p>

          {/* Deployment Steps */}
          <div className="space-y-4 mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {step.status === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                  {step.status === 'in_progress' && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    step.status === 'completed' ? 'text-green-600' :
                    step.status === 'in_progress' ? 'text-blue-600' :
                    step.status === 'failed' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {step.label}
                  </p>
                  {step.details && (
                    <p className="text-sm text-gray-600 mt-1">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">Transaction Hash</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-blue-700 break-all">{txHash}</code>
                {networkConfig && (
                  <a
                    href={`${networkConfig.explorer}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Contract Address */}
          {contractAddress && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-1">Contract Address</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-green-700 break-all">{contractAddress}</code>
                {networkConfig && (
                  <a
                    href={`${networkConfig.explorer}/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-green-600 hover:text-green-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">Deployment Error</h4>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Wallet Check */}
          {!account && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                Please connect your wallet to deploy the contract
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isPending || (allCompleted && !hasFailed)}
              className="flex-1"
            >
              {allCompleted ? 'Close' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              onClick={handleDeploy}
              disabled={!account || isPending || allCompleted || hasFailed}
              className="flex-1"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {allCompleted ? 'Deployed!' : hasFailed ? 'Failed' : 'Deploy Contract'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default DeploymentModal;

