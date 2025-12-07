'use client';

import { useState, useEffect } from 'react';
import { useActiveWallet, useActiveAccount, ConnectButton } from 'thirdweb/react';
import { thirdwebClient, createFetchWithPayment, isThirdwebConfigured } from '@/lib/thirdwebClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SpendingControls } from '@/components/spending/SpendingControls';
import type { Workflow } from '@/lib/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const PAYMENT_AMOUNTS = {
  ERC20: BigInt(10000), // $0.01 USDC
  ERC721: BigInt(20000), // $0.02 USDC
  Custom: BigInt(150000), // $0.15 USDC
};

interface Recipe {
  id: string;
  name: string;
  description: string;
  price: number;
  contractType: 'ERC20' | 'ERC721' | 'Custom';
  amount: bigint;
  icon: string;
  color: string;
}

const recipes: Recipe[] = [
  { 
    id: 'erc20', 
    name: 'ERC20 Token', 
    description: 'Standard fungible token with transfer, approve, and balance functions',
    price: 0.01,
    contractType: 'ERC20',
    amount: PAYMENT_AMOUNTS.ERC20,
    icon: '🪙',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'erc721', 
    name: 'ERC721 NFT', 
    description: 'Non-fungible token for unique digital assets',
    price: 0.02,
    contractType: 'ERC721',
    amount: PAYMENT_AMOUNTS.ERC721,
    icon: '🖼️',
    color: 'from-purple-500 to-pink-500'
  },
  { 
    id: 'vesting', 
    name: 'Vesting Contract', 
    description: 'Token vesting schedule with cliff and linear release',
    price: 0.15,
    contractType: 'Custom',
    amount: PAYMENT_AMOUNTS.Custom,
    icon: '⏰',
    color: 'from-orange-500 to-red-500'
  },
  { 
    id: 'staking', 
    name: 'Staking Pool', 
    description: 'Staking contract with rewards distribution',
    price: 0.15,
    contractType: 'Custom',
    amount: PAYMENT_AMOUNTS.Custom,
    icon: '💰',
    color: 'from-green-500 to-emerald-500'
  },
];

export default function AvalancheStudioPage() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [thirdwebConfigured, setThirdwebConfigured] = useState(false);

  useEffect(() => {
    setThirdwebConfigured(isThirdwebConfigured());
  }, []);

  const handleGenerate = async (recipe: Recipe) => {
    if (!wallet || !account) {
      setError('Please connect your wallet first');
      return;
    }

    if (!thirdwebConfigured) {
      setError('Thirdweb client not configured. Please set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in your .env.local file.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!API_BASE_URL || !API_BASE_URL.startsWith('http')) {
        throw new Error(`Invalid API URL: ${API_BASE_URL}. Please set NEXT_PUBLIC_API_URL in your .env.local file.`);
      }

      const fetchWithPayment = createFetchWithPayment(wallet, recipe.amount);
      const url = `${API_BASE_URL}/x402/contracts/generate`;

      const response = await fetchWithPayment(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': account.address,
        },
        body: JSON.stringify({
          nlp_description: `Create ${recipe.name}: ${recipe.description}`,
          contract_type: recipe.contractType,
          network: 'avalanche_fuji'
        }),
      });

      // Handle 402 Payment Required - fetchWithPayment should handle this, but if we get one, it means payment failed
      if (response.status === 402) {
        const text = await response.text().catch(() => 'Payment required');
        throw new Error(`Payment required: ${text.substring(0, 100)}`);
      }

      // Handle 403 Forbidden (Spending limit exceeded)
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || errorData.error || 'Spending limit exceeded';
        throw new Error(`403: ${errorMsg}`);
      }

      // Handle 502/503/504 errors (Bad Gateway, Service Unavailable, Gateway Timeout)
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        let errorData: any;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          } else {
            const text = await response.text();
            errorData = { error: text };
          }
        } catch {
          errorData = { error: 'Settlement service temporarily unavailable' };
        }
        
        const errorMsg = errorData?.errorMessage || errorData?.error || 
                        `Settlement service error (${response.status}). The payment settlement service is temporarily unavailable. Please try again in a few moments.`;
        throw new Error(errorMsg);
      }

      let responseData: any;
      try {
        // Check content-type before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          // If not JSON, read as text first
          const text = await response.text();
          // Try to parse as JSON if it looks like JSON
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            responseData = JSON.parse(text);
          } else {
            // If it's not JSON (might be a JWT token or error message), throw with the text
            throw new Error(`Unexpected response format: ${text.substring(0, 200)}`);
          }
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('Unexpected response format')) {
          throw parseError;
        }
        const text = await response.text().catch(() => 'Unable to read response');
        console.error('Failed to parse response:', text);
        throw new Error(`Invalid response format: ${text.substring(0, 200)}`);
      }

      if (response.status === 200) {
        console.log('Contract generated successfully:', responseData);
        setResult(responseData);
      } else {
        const errorMsg = responseData?.errorMessage || 
                        responseData?.error || 
                        responseData?.details || 
                        responseData?.message || 
                        responseData?.detail || 
                        `Request failed: ${response.status} ${response.statusText}`;
        
        console.error('Request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMsg,
          fullResponse: responseData
        });
        
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error('Contract generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate contract';
      
      if (errorMessage.includes('EIP-7702') || errorMessage.includes('does not support')) {
        setError(
          `Avalanche Fuji does not support EIP-7702 yet. ` +
          `x402 payments require ERC-4337 Smart Account. Please ensure your facilitator wallet is an ERC-4337 Smart Account.`
        );
      } else if (errorMessage.includes('Payment required') || errorMessage.includes('402')) {
        setError(
          `${errorMessage}. ` +
          `The payment transaction should appear in your wallet. ` +
          `Please approve it to continue.`
        );
      } else if (errorMessage.includes('403') || errorMessage.includes('Spending control') || errorMessage.includes('limit exceeded') || errorMessage.includes('Daily limit') || errorMessage.includes('Monthly limit')) {
        setError(
          `Spending limit exceeded: ${errorMessage}. ` +
          `Please adjust your spending limits in the Spending Controls section above, or wait for your daily/monthly limit to reset.`
        );
      } else if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway') || errorMessage.includes('Settlement service')) {
        setError(
          `Payment settlement service is temporarily unavailable (502 Bad Gateway). ` +
          `This usually means the payment infrastructure is experiencing issues. ` +
          `Please wait a few moments and try again. If the problem persists, the payment may have been processed - check your wallet for the transaction.`
        );
      } else if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
        setError(
          `Payment settlement service is temporarily unavailable. ` +
          `Please wait a few moments and try again.`
        );
      } else if (errorMessage.includes('504') || errorMessage.includes('Gateway Timeout')) {
        setError(
          `Payment settlement service request timed out. ` +
          `The service may be experiencing high load. Please try again in a few moments.`
        );
      } else if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
        setError('Contract generation is taking longer than expected. The payment was successful, but the contract generation timed out. Please try again or contact support.');
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to fetch')) {
        setError(
          `Network error or request timeout. The payment was successful (check your wallet), but the contract generation may have timed out. ` +
          `Please try again. If the issue persists, check if the backend is running at ${API_BASE_URL}.`
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async () => {
    if (!wallet || !account || !result) {
      setError('Please generate a contract first');
      return;
    }

    if (!thirdwebConfigured) {
      setError('Thirdweb client not configured');
      return;
    }

    setWorkflowLoading(true);
    setError(null);

    try {
      // Workflow creation is FREE - contract generation already includes payment
      // No x402 payment needed for workflow creation
      const response = await fetch(
        `${API_BASE_URL}/x402/workflows/create-from-contract`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': account.address,
          },
          body: JSON.stringify({
            contract_code: result.contract_code,
            contract_type: result.contract_type,
            network: 'avalanche_fuji',
            constructor_args: result.constructor_args || [],
            wallet_address: account.address,
            use_gasless: true
          }),
        }
      );

      if (response.ok) {
        const workflowData = await response.json();
        setWorkflow(workflowData);
        pollWorkflowStatus(workflowData.workflow_id);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.statusText}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start workflow');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const pollWorkflowStatus = async (workflowId: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    let deploymentHandled = false;
    let consecutiveErrors = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Workflow status polling timeout after 5 minutes. The workflow may still be processing. Please refresh the page.');
        return;
      }

      try {
        // Reset consecutive errors on successful request
        consecutiveErrors = 0;
        
        // Use a longer timeout for workflow status (30 seconds) since workflows can take time
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        let response: Response;
        try {
          // Use a simple fetch without complex options to avoid CORS/preflight issues
          response = await fetch(
            `${API_BASE_URL}/workflows/${workflowId}`,
            {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'Accept': 'application/json',
              },
              // Don't set Content-Type for GET requests - it can trigger unnecessary preflight
            }
          );
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          // Handle different types of fetch errors
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timeout - backend may be slow or unresponsive. The workflow might still be processing.');
          }
          
          // Network errors
          if (fetchError.message?.includes('Failed to fetch') || 
              fetchError.message?.includes('ERR_EMPTY_RESPONSE') ||
              fetchError.message?.includes('NetworkError') ||
              fetchError.message?.includes('Network request failed')) {
            throw new Error('Cannot connect to backend server. Please check if the server is running.');
          }
          
          // Re-throw other errors
          throw fetchError;
        } finally {
          clearTimeout(timeoutId);
        }

        let status: any;
        if (response.ok) {
          try {
            status = await response.json();
          } catch (jsonError) {
            console.error('Failed to parse workflow status JSON:', jsonError);
            throw new Error('Invalid response from server - backend may be returning an error');
          }
          setWorkflow(status);
        } else {
          // Handle non-OK responses
          let errorText = '';
          try {
            const errorData = await response.json();
            errorText = errorData.detail || errorData.message || `HTTP ${response.status}`;
          } catch {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }
          
          if (response.status === 404) {
            throw new Error(`Workflow not found: ${errorText}`);
          } else if (response.status >= 500) {
            throw new Error(`Server error: ${errorText}`);
          } else {
            throw new Error(`Failed to get workflow status: ${errorText}`);
          }
        }

        // If workflow failed, check if it failed before contracts were created
        if (status && status.status === 'failed') {
            // Check if contracts exist in the workflow status
            const hasContractsInStatus = status.contracts && 
                                        Array.isArray(status.contracts) && 
                                        status.contracts.length > 0;
            
            // If no contracts in status, verify with contracts endpoint
            if (!hasContractsInStatus) {
              try {
                const contractsCheckResponse = await fetch(
                  `${API_BASE_URL}/workflows/${workflowId}/contracts`
                );
                
                if (contractsCheckResponse.ok) {
                  const contractsCheckData = await contractsCheckResponse.json();
                  const hasContracts = contractsCheckData.contracts && 
                                     Array.isArray(contractsCheckData.contracts) && 
                                     contractsCheckData.contracts.length > 0;
                  
                  if (!hasContracts) {
                    // Workflow failed before contracts were created - don't attempt deployment
                    const errorMsg = status.error_message || 'Workflow failed';
                    if (!errorMsg.includes('Deployment requires user wallet signature')) {
                      // This is not a deployment signature error, so don't attempt deployment
                      setError(
                        `Workflow failed during generation, compilation, or audit stages. ` +
                        `No contracts were created. Error: ${errorMsg}`
                      );
                      return;
                    }
                  }
                }
              } catch (checkErr) {
                console.error('Error checking contracts:', checkErr);
                // If we can't verify, don't attempt deployment
                setError('Unable to verify contracts for deployment. The workflow may have failed before contracts were created.');
                return;
              }
            }
            
            // Only attempt deployment signing if:
            // 1. Workflow failed with deployment signature error
            // 2. Contracts actually exist in the workflow
            // 3. Wallet is connected
            // 4. We haven't already handled this deployment
            if (
              status.error_message &&
              status.error_message.includes('Deployment requires user wallet signature') &&
              !deploymentHandled &&
              wallet &&
              account &&
              hasContractsInStatus
            ) {
              deploymentHandled = true;
              console.log('Workflow requires user wallet signature for deployment, handling...');
              
              try {
                await handleDeploymentSigning(workflowId, status.network);
              } catch (deployErr) {
                console.error('Failed to handle deployment signing:', deployErr);
                setError(`Deployment signing failed: ${deployErr instanceof Error ? deployErr.message : 'Unknown error'}`);
              }
              return;
            } else if (status.status === 'failed' && !hasContractsInStatus) {
              // Workflow failed and no contracts exist - show error and stop polling
              const errorMsg = status.error_message || 'Workflow failed';
              setError(
                `Workflow failed before contracts were created. ` +
                `The workflow may have failed during generation, compilation, or audit stages. ` +
                `Error: ${errorMsg}`
              );
              return;
            }
          }

          if (status.status !== 'completed' && status.status !== 'failed') {
            attempts++;
            setTimeout(poll, 5000);
          } else if (status.status === 'completed') {
            console.log('Workflow completed successfully');
            
            // Check if deployment was skipped and requires user signature
            const metadata = status.metadata || {};
            if (metadata.deployment_skipped || metadata.requires_user_signature) {
              // Deployment is pending - automatically handle it
              if (!deploymentHandled && wallet && account) {
                deploymentHandled = true;
                console.log('Workflow completed but deployment requires user signature. Handling automatically...');
                
                try {
                  await handleDeploymentSigning(workflowId, status.network);
                } catch (deployErr) {
                  console.error('Failed to handle deployment signing:', deployErr);
                  setError(`Deployment signing failed: ${deployErr instanceof Error ? deployErr.message : 'Unknown error'}`);
                }
              }
            }
          }
      } catch (err) {
        consecutiveErrors++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error polling workflow status:', err);
        
        // If we get too many consecutive errors, check backend health
        if (consecutiveErrors >= 5) {
          try {
            const healthResponse = await fetch(`${API_BASE_URL}/health`, { 
              signal: AbortSignal.timeout(5000) 
            });
            if (!healthResponse.ok) {
              setError('Backend health check failed. The server may be restarting. Please wait a moment and refresh the page.');
              return;
            }
          } catch (healthError) {
            setError('Cannot connect to backend server. Please check if the server is running and try refreshing the page.');
            return;
          }
          // Reset consecutive errors if health check passes
          consecutiveErrors = 0;
        }
        
        // Don't show timeout/connection errors as user-facing errors if we're still retrying
        if (attempts < maxAttempts) {
          // Only show error if it's been multiple attempts
          if (attempts >= 3 && attempts % 5 === 0) {
            setError(`Workflow status polling issue: ${errorMessage}. Retrying... (${attempts}/${maxAttempts})`);
          }
          attempts++;
          // Exponential backoff for connection errors
          const delay = errorMessage.includes('connection') || errorMessage.includes('timeout') || errorMessage.includes('ERR_EMPTY_RESPONSE')
            ? Math.min(5000 * Math.pow(1.5, Math.min(attempts - 1, 5)), 30000) // Max 30 seconds
            : 5000;
          setTimeout(poll, delay);
        } else {
          // Max attempts reached - show final error
          setError(`Failed to get workflow status after ${maxAttempts} attempts: ${errorMessage}. The workflow may still be processing. Please refresh the page to check status.`);
        }
      }
    };

    poll();
  };

  const handleDeploymentSigning = async (workflowId: string, network: string) => {
    if (!wallet || !account || !thirdwebConfigured) {
      throw new Error('Wallet not connected or Thirdweb not configured');
    }

    try {
      setError('Preparing deployment transaction...');
      
      // First, verify the workflow has contracts before attempting to fetch them
      const workflowStatusResponse = await fetch(
        `${API_BASE_URL}/workflows/${workflowId}`
      );
      
      if (workflowStatusResponse.ok) {
        const workflowStatus = await workflowStatusResponse.json();
        const hasContracts = workflowStatus.contracts && 
                           Array.isArray(workflowStatus.contracts) && 
                           workflowStatus.contracts.length > 0;
        
        if (!hasContracts) {
          const errorMsg = workflowStatus.error_message || 'Workflow failed';
          throw new Error(
            `No contracts found in workflow. The workflow failed before contracts were created. ` +
            `This typically happens when the workflow fails during generation, compilation, or audit stages. ` +
            `Error: ${errorMsg}. Please check the workflow status and try creating a new workflow.`
          );
        }
      }
      
      const contractsResponse = await fetch(
        `${API_BASE_URL}/workflows/${workflowId}/contracts`
      );
      
      if (!contractsResponse.ok) {
        const errorText = await contractsResponse.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch workflow contracts: ${contractsResponse.status} ${errorText}`);
      }

      const contractsData = await contractsResponse.json();
      const contract = contractsData.contracts?.[0];

      if (!contract) {
        throw new Error(
          'No contract found in workflow. The workflow may have failed during generation, compilation, or audit stages before contracts were created. ' +
          'Please check the workflow error message and try creating a new workflow.'
        );
      }

      // Validate contract has required fields
      if (!contract.bytecode || !contract.abi) {
        throw new Error(
          'Contract is missing required data (bytecode or ABI). The contract may not have been compiled successfully. ' +
          'Please check the workflow status and try again.'
        );
      }

      // Use x402 payment flow for deployment preparation
      // Deployment costs $0.10 USDC
      const deploymentPrice = BigInt(100000); // $0.10 USDC
      const fetchWithPayment = createFetchWithPayment(wallet, deploymentPrice);

      const prepareResponse = await fetchWithPayment(
        `${API_BASE_URL}/x402/deployments/prepare`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': account.address,
          },
          body: JSON.stringify({
            compiled_contract: {
              abi: contract.abi,
              bytecode: contract.bytecode,
            },
            network: network,
            wallet_address: account.address,
            constructor_args: [],
          }),
        }
      );

      if (!prepareResponse.ok) {
        if (prepareResponse.status === 402) {
          throw new Error('Payment required for deployment. Please approve the transaction in your wallet.');
        }
        const errorData = await prepareResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Failed to prepare deployment transaction');
      }

      const prepareData = await prepareResponse.json();
      const unsignedTransaction = prepareData.transaction_data.transaction;

      setError('Please sign the deployment transaction in your wallet... This is required for ERC4337 Smart Account deployments. The transaction will be signed and broadcast automatically.');

      // For ERC4337 Smart Accounts, we use Thirdweb SDK which handles Smart Account signing automatically
      // Thirdweb SDK detects if the account is a Smart Account and handles the signing flow accordingly
      // The user will be prompted to sign in their wallet (Core, MetaMask, etc.)
      const { sendTransaction } = await import('thirdweb');
      const { avalancheFuji, avalanche } = await import('thirdweb/chains');
      const chain = network === 'avalanche_mainnet' ? avalanche : avalancheFuji;
      
      // Send transaction - Thirdweb SDK handles ERC4337 Smart Account signing and broadcasting
      // For Smart Accounts, Thirdweb uses account abstraction to sign and broadcast the transaction
      const receipt = await sendTransaction({
        account: account,
        transaction: {
          to: undefined, // Contract deployment (no 'to' address)
          data: unsignedTransaction.data || `0x${contract.bytecode}`,
          value: BigInt(unsignedTransaction.value || 0),
          gas: BigInt(unsignedTransaction.gas),
          gasPrice: BigInt(unsignedTransaction.gasPrice || 0),
          chain: chain,
        } as any,
      });

      // Extract deployment information from receipt
      // Thirdweb's sendTransaction returns a receipt with transactionHash
      // For contract deployments, we need to wait for the receipt to get the contract address
      const transactionHash = receipt.transactionHash;
      
      if (!transactionHash) {
        throw new Error('Transaction hash not found in deployment receipt. The deployment may have failed.');
      }

      setError(`Deployment transaction submitted! Hash: ${transactionHash}. Waiting for confirmation...`);
      console.log('Deployment transaction submitted via ERC4337 Smart Account:', {
        transactionHash,
        receipt
      });
      
      // Note: The contract address will be available in the transaction receipt after confirmation
      // The backend workflow processor should detect the deployment and update the status
      // For now, we show the transaction hash and poll for workflow updates
      
      // Note: Since Thirdweb's sendTransaction already broadcast the transaction,
      // we don't need to send it to the backend again. The workflow will be updated
      // when the backend detects the deployment via polling or when we manually update it.
      // For now, we'll poll the workflow status which should eventually reflect the deployment.
      
      // Poll workflow status to refresh UI and detect deployment completion
      // The backend workflow processor should detect the deployment and update the status
      setTimeout(() => {
        pollWorkflowStatus(workflowId);
      }, 2000);
      
      setError(null);
      
    } catch (err) {
      console.error('Deployment signing error:', err);
      setError(`Deployment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  };

  if (!wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="text-center space-y-8 p-8 max-w-2xl">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
              <span className="text-4xl">⚡</span>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Avalanche x402 Studio
            </h1>
            <p className="text-xl text-gray-600">Pay-per-deploy smart contract generation</p>
            <p className="text-sm text-gray-500">Avalanche Fuji Testnet</p>
          </div>
          
          {!thirdwebConfigured && (
            <Card className="max-w-md mx-auto">
              <div className="p-6 space-y-3">
                <div className="flex items-center space-x-2 text-yellow-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="font-semibold">Configuration Required</p>
                </div>
                <p className="text-sm text-gray-600">
                  Please set <code className="bg-yellow-100 px-2 py-1 rounded text-xs font-mono">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> in your <code className="bg-yellow-100 px-2 py-1 rounded text-xs font-mono">.env.local</code> file.
                </p>
              </div>
            </Card>
          )}
          
          {thirdwebConfigured && thirdwebClient && (
            <div className="tw-connect-button-wrapper">
              <ConnectButton client={thirdwebClient} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center space-y-6 mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">⚡</span>
          </div>
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
              Avalanche x402 Studio
            </h1>
            <p className="text-xl text-gray-600">Choose a recipe to generate and deploy contracts</p>
          </div>
          
          <div className="flex items-center justify-center pt-4">
            {thirdwebClient && (
              <div className="tw-connect-button-wrapper">
                <ConnectButton client={thirdwebClient} />
              </div>
            )}
          </div>
        </div>

        {account && (
          <div className="max-w-2xl mx-auto mb-8">
            <SpendingControls />
          </div>
        )}

        {error && (
          <div className="max-w-4xl mx-auto mb-8">
            <Card className="border-red-200 bg-red-50/50">
              <div className="p-6">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {result && (
          <div className="max-w-5xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card gradient hover className="shadow-xl">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Generated Contract
                  </h2>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                    ✓ Success
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contract Type</p>
                    <p className="text-lg font-mono font-semibold text-gray-900">{result.contract_type || 'N/A'}</p>
                  </div>
                  
                  {result.contract_address && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Deployed Address</p>
                      <a
                        href={`https://testnet.snowtrace.io/address/${result.contract_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-mono text-blue-600 hover:text-blue-700 hover:underline break-all"
                      >
                        {result.contract_address}
                      </a>
                    </div>
                  )}
                </div>
                
                {result.contract_code && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Source Code</p>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl overflow-auto text-sm max-h-96 font-mono shadow-inner border border-gray-800">
                        <code>{result.contract_code}</code>
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(result.contract_code);
                        }}
                        className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                        title="Copy code"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {!workflow && (
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          Complete End-to-End Workflow
                        </h3>
                        <p className="text-sm text-gray-600">
                          Run full pipeline: Compilation → Audit → Testing → Deployment
                        </p>
                        <p className="text-xs text-green-600 font-medium mt-1">
                          ✓ Free - Contract generation already includes workflow
                        </p>
                      </div>
                      <Button
                        onClick={handleStartWorkflow}
                        disabled={workflowLoading || !thirdwebConfigured}
                        variant="gradient"
                        size="lg"
                      >
                        {workflowLoading ? (
                          <span className="flex items-center space-x-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Starting...</span>
                          </span>
                        ) : (
                          'Start Full Workflow'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {workflow && (
                  <div className="pt-6 border-t border-gray-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Workflow Status</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          workflow.status === 'completed' 
                            ? (workflow.metadata?.deployment_skipped ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')
                            : workflow.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {workflow.status === 'completed' 
                            ? (workflow.metadata?.deployment_skipped ? '⏳ Deployment Pending' : '✓ Completed')
                            : workflow.status === 'failed' ? '✗ Failed' :
                           workflow.status === 'generating' ? '🔄 Compiling' :
                           workflow.status === 'auditing' ? '🔍 Auditing' :
                           workflow.status === 'testing' ? '🧪 Testing' :
                           workflow.status === 'deploying' ? '📤 Deploying' :
                           workflow.status}
                        </span>
                      </div>
                      
                      {workflow.status === 'completed' && workflow.metadata?.deployment_skipped && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-yellow-900 mb-1">Deployment Pending</h4>
                              <p className="text-sm text-yellow-800">
                                {workflow.metadata.deployment_message || 'Deployment requires your wallet signature. The frontend will automatically prompt you to sign the deployment transaction.'}
                              </p>
                              {wallet && account && (
                                <p className="text-xs text-yellow-700 mt-2">
                                  Deployment will be handled automatically. Please check your wallet for the signature request.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-semibold text-gray-900">{workflow.progress_percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${workflow.progress_percentage || 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-4">
                        {['Compilation', 'Audit', 'Testing', 'Deployment'].map((stage, index) => {
                          const stageProgress = (workflow.progress_percentage || 0) / 25;
                          const isComplete = stageProgress > index + 1;
                          const isCurrent = stageProgress >= index && stageProgress < index + 1;
                          const isDeployment = stage === 'Deployment';
                          const isDeploymentPending = isDeployment && workflow.status === 'completed' && workflow.metadata?.deployment_skipped;
                          const hasDeployment = isDeployment && workflow.deployments && workflow.deployments.length > 0;
                          
                          return (
                            <div 
                              key={stage}
                              className={`p-3 rounded-lg text-center ${
                                isDeploymentPending
                                  ? 'bg-yellow-50 border-2 border-yellow-200'
                                  : hasDeployment
                                  ? 'bg-green-50 border-2 border-green-200'
                                  : isComplete 
                                  ? 'bg-green-50 border-2 border-green-200'
                                  : isCurrent
                                  ? 'bg-blue-50 border-2 border-blue-200'
                                  : 'bg-gray-50 border-2 border-gray-200'
                              }`}
                            >
                              <div className={`text-2xl mb-1 ${
                                isDeploymentPending
                                  ? 'text-yellow-600'
                                  : hasDeployment || isComplete
                                  ? 'text-green-600'
                                  : isCurrent
                                  ? 'text-blue-600'
                                  : 'text-gray-400'
                              }`}>
                                {isDeploymentPending
                                  ? '⏳'
                                  : hasDeployment || isComplete
                                  ? '✓'
                                  : isCurrent
                                  ? '⟳'
                                  : '○'}
                              </div>
                              <p className={`text-xs font-semibold ${
                                isDeploymentPending
                                  ? 'text-yellow-700'
                                  : hasDeployment || isComplete
                                  ? 'text-green-700'
                                  : isCurrent
                                  ? 'text-blue-700'
                                  : 'text-gray-500'
                              }`}>
                                {stage}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      
                      {workflow.deployments && workflow.deployments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Deployment Details</h4>
                          {workflow.deployments.map((deployment: any) => (
                            <div key={deployment.id} className="space-y-2 text-sm">
                              {deployment.contract_address && (
                                <div>
                                  <span className="text-gray-600">Contract Address: </span>
                                  <a
                                    href={`https://testnet.snowtrace.io/address/${deployment.contract_address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-mono"
                                  >
                                    {deployment.contract_address}
                                  </a>
                                </div>
                              )}
                              {deployment.transaction_hash && (
                                <div>
                                  <span className="text-gray-600">Transaction: </span>
                                  <a
                                    href={`https://testnet.snowtrace.io/tx/${deployment.transaction_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-mono"
                                  >
                                    {deployment.transaction_hash.substring(0, 20)}...
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {workflow.workflow_id && (
                        <div className="pt-4">
                          <a
                            href={`/workflows/${workflow.workflow_id}`}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            View full workflow details →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {recipes.map((recipe) => (
            <Card 
              key={recipe.id} 
              hover 
              gradient
              className="relative overflow-hidden group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${recipe.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="relative p-6 space-y-5">
                <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${recipe.color} rounded-xl shadow-lg mb-2`}>
                  <span className="text-3xl">{recipe.icon}</span>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">{recipe.name}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{recipe.description}</p>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Price</p>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-bold text-gray-900">${recipe.price}</span>
                    <span className="text-sm text-gray-500 font-medium">USDC</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => handleGenerate(recipe)}
                  disabled={loading || !thirdwebConfigured}
                  variant="gradient"
                  className="w-full mt-4"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </span>
                  ) : (
                    'Generate & Deploy'
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
