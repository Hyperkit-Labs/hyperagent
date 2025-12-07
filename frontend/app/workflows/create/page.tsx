'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveWallet, useActiveAccount } from 'thirdweb/react';
import { WorkflowForm } from '@/components/workflows/WorkflowForm';
import { createWorkflow, handleApiError } from '@/lib/api';
import { createFetchWithPayment, isThirdwebConfigured } from '@/lib/thirdwebClient';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card } from '@/components/ui/Card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Check if network supports x402
function isX402Network(network: string): boolean {
  const x402Networks = ['avalanche_fuji', 'avalanche_mainnet', 'avalanche'];
  return x402Networks.some(n => network.toLowerCase().includes(n.toLowerCase()));
}

export default function CreateWorkflowPage() {
  const router = useRouter();
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      // Check if network requires x402 payment
      const requiresPayment = isX402Network(data.network);
      
      if (requiresPayment) {
        // Use x402 payment flow for Avalanche networks
        if (!wallet || !account) {
          throw new Error('Please connect your wallet to create a workflow on Avalanche networks');
        }

        if (!isThirdwebConfigured()) {
          throw new Error('Thirdweb client not configured. Please set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in your .env.local file.');
        }

        // For x402 networks, we need to:
        // 1. First generate the contract with payment
        // 2. Then create workflow from contract with payment
        
        // Step 1: Generate contract with x402 payment
        const contractPrice = BigInt(10000); // $0.01 USDC
        const fetchWithPayment = createFetchWithPayment(wallet, contractPrice);
        
        const contractResponse = await fetchWithPayment(
          `${API_BASE_URL}/x402/contracts/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-wallet-address': account.address,
            },
            body: JSON.stringify({
              nlp_description: data.nlp_input,
              contract_type: data.contract_type,
              network: data.network,
            }),
          }
        );

        if (!contractResponse.ok) {
          if (contractResponse.status === 402) {
            throw new Error('Payment required. Please approve the transaction in your wallet.');
          }
          const errorData = await contractResponse.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Contract generation failed: ${contractResponse.statusText}`);
        }

        const contractData = await contractResponse.json();

        // Step 2: Create workflow from contract with x402 payment
        const workflowPrice = BigInt(100000); // $0.10 USDC
        const fetchWorkflowWithPayment = createFetchWithPayment(wallet, workflowPrice);

        const workflowResponse = await fetchWorkflowWithPayment(
          `${API_BASE_URL}/x402/workflows/create-from-contract`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-wallet-address': account.address,
            },
            body: JSON.stringify({
              contract_code: contractData.contract_code,
              contract_type: contractData.contract_type,
              network: data.network,
              constructor_args: contractData.constructor_args || [],
              wallet_address: account.address,
              use_gasless: data.use_gasless || false,
              name: data.name,
            }),
          }
        );

        if (!workflowResponse.ok) {
          if (workflowResponse.status === 402) {
            throw new Error('Payment required for workflow creation. Please approve the transaction in your wallet.');
          }
          const errorData = await workflowResponse.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Workflow creation failed: ${workflowResponse.statusText}`);
        }

        const workflowData = await workflowResponse.json();
        router.push(`/workflows/${workflowData.workflow_id}`);
      } else {
        // Use regular workflow creation for non-x402 networks
        const response = await createWorkflow(data);
        router.push(`/workflows/${response.workflow_id}`);
      }
    } catch (err: any) {
      console.error('Workflow creation error:', err);
      setError(handleApiError(err));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Workflow</h1>
        <p className="mt-2 text-gray-600">
          Describe the smart contract you want to create and we&apos;ll generate it for you
        </p>
        <p className="mt-2 text-sm text-blue-600">
          Note: Avalanche networks require x402 payment. You&apos;ll be prompted to approve payments in your wallet.
        </p>
      </div>

      {error && (
        <Card>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
            {error.includes('Payment required') && (
              <p className="text-red-600 text-xs mt-2">
                The payment transaction should appear in your wallet. Please approve it to continue.
              </p>
            )}
          </div>
        </Card>
      )}

      <WorkflowForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}

