'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveWallet, useActiveAccount } from 'thirdweb/react';
import { WorkflowForm } from '@/components/workflows/WorkflowForm';
import { createWorkflow, handleApiError } from '@/lib/api';
import { createFetchWithPayment, isThirdwebConfigured } from '@/lib/thirdwebClient';
import { Card } from '@/components/ui/Card';
import { handleX402FetchError, parseX402ErrorResponse, handleX402ResponseError, parseResponseData, MAX_PAYMENT_ALLOWED } from '@/lib/x402ErrorHandler';
import type { TaskCostBreakdown } from '@/components/workflows/TaskSelector';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';


import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CreateWorkflowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || '';
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<TaskCostBreakdown | null>(null);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      // Check if v2 API is requested
      if (data.use_v2_api) {
        const { createWorkflowV2 } = await import('@/lib/api');
        const response = await createWorkflowV2(data.intent || data.nlp_input);
        router.push(`/workflows/${response.workflow_id || response.meta?.workflowId}`);
        return;
      }

      // Use x402 flow whenever Thirdweb client + wallet are available.
      const useX402Flow = Boolean(wallet && account && isThirdwebConfigured());

      if (useX402Flow) {
        if (!wallet || !account) {
          throw new Error('Please connect your wallet to continue');
        }

        if (!isThirdwebConfigured()) {
          throw new Error('Thirdweb client not configured. Please set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in your .env.local file.');
        }

        // For x402 networks, we need to:
        const fetchWithPayment = createFetchWithPayment(wallet, MAX_PAYMENT_ALLOWED);
        
        let contractResponse: Response;
        try {
          contractResponse = await fetchWithPayment(
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
        } catch (fetchError) {
          handleX402FetchError(fetchError);
        }

        if (!contractResponse.ok) {
          if (contractResponse.status === 402) {
            const errorData = await parseX402ErrorResponse(contractResponse);
            handleX402ResponseError(contractResponse, errorData);
          }
          const errorData = await contractResponse.json().catch(() => ({}));
          throw new Error((errorData as any).error || (errorData as any).message || `Contract generation failed: ${contractResponse.statusText}`);
        }

        const contractData = await parseResponseData(contractResponse);

        // Use cost breakdown if available, otherwise fallback to MAX_PAYMENT_ALLOWED
        const fetchWorkflowWithPayment = createFetchWithPayment(wallet, MAX_PAYMENT_ALLOWED);

        let workflowResponse: Response;
        try {
          workflowResponse = await fetchWorkflowWithPayment(
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
                selected_tasks: data.selected_tasks || ['compilation', 'audit', 'testing', 'deployment'],
              }),
            }
          );
        } catch (fetchError) {
          handleX402FetchError(fetchError);
        }

        if (!workflowResponse.ok) {
          if (workflowResponse.status === 402) {
            const errorData = await parseX402ErrorResponse(workflowResponse);
            handleX402ResponseError(workflowResponse, errorData);
          }
          const errorData = await workflowResponse.json().catch(() => ({}));
          throw new Error((errorData as any).error || (errorData as any).message || `Workflow creation failed: ${workflowResponse.statusText}`);
        }

        const workflowData = await parseResponseData(workflowResponse);
        router.push(`/workflows/${workflowData.workflow_id}`);
      } else {
        // Use regular workflow creation for non-x402 networks
        // Include selected_tasks in request
        const workflowData = {
          ...data,
          selected_tasks: data.selected_tasks || ['generation', 'audit', 'testing', 'deployment'],
        };
        const response = await createWorkflow(workflowData);
        router.push(`/workflows/${response.workflow_id}`);
      }
    } catch (err: any) {
      console.error('Workflow creation error:', err);
      setError(handleApiError(err));
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full bg-[#030712] text-white min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Create New Workflow</h1>
          <p className="text-gray-400">
            Describe the smart contract you want to create and we'll generate it for you
          </p>
          <p className="mt-2 text-sm text-blue-400">
            Note: Some actions may require x402 payment. You&apos;ll be prompted to approve payments in your wallet.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <h3 className="font-semibold text-red-400 mb-2">Error</h3>
            <p className="text-red-300 text-sm">{error}</p>
            {error.includes('Payment required') && (
              <p className="text-red-400 text-xs mt-2">
                The payment transaction should appear in your wallet. Please approve it to continue.
              </p>
            )}
          </div>
        )}

        <WorkflowForm 
          onSubmit={handleSubmit} 
          loading={loading}
          onCostUpdate={(cost) => setCostBreakdown(cost)}
          initialPrompt={initialPrompt}
        />
      </div>
    </div>
  );
}

export default function CreateWorkflowPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateWorkflowContent />
    </Suspense>
  );
}
