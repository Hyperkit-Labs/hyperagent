'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getWorkflowContracts } from '@/lib/api';
import { WorkflowProgress } from '@/components/workflows/WorkflowProgress';
import { ContractViewer } from '@/components/contracts/ContractViewer';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ExplorerLink } from '@/components/deployments/ExplorerLink';
import { formatDate } from '@/lib/utils';

interface ContractWithCode {
  id: string;
  contract_name: string;
  contract_type: string;
  solidity_version: string;
  source_code: string;
  bytecode: string;
  abi: any;
  deployed_bytecode?: string;
  created_at: string;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const { workflow, loading } = useWorkflow(workflowId);
  const { workflow: wsWorkflow, connected } = useWebSocket(workflowId);
  const [contractsWithCode, setContractsWithCode] = useState<ContractWithCode[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Use WebSocket data if available, otherwise fall back to polling
  const activeWorkflow = wsWorkflow || workflow;

  // Fetch contract details with source code when workflow has contracts
  useEffect(() => {
    if (activeWorkflow?.contracts && activeWorkflow.contracts.length > 0) {
      const fetchContracts = async () => {
        setLoadingContracts(true);
        try {
          const data = await getWorkflowContracts(workflowId);
          setContractsWithCode(data.contracts);
        } catch (error) {
          console.error('Failed to fetch contract details:', error);
        } finally {
          setLoadingContracts(false);
        }
      };
      fetchContracts();
    }
  }, [workflowId, activeWorkflow?.contracts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!activeWorkflow) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Workflow not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {activeWorkflow.name || `Workflow ${activeWorkflow.workflow_id.slice(0, 8)}`}
          </h1>
          <p className="mt-2 text-gray-600">
            Created {formatDate(activeWorkflow.created_at)} • {activeWorkflow.network}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              Live
            </span>
          )}
          <StatusBadge status={activeWorkflow.status} />
        </div>
      </div>

      <WorkflowProgress workflow={activeWorkflow} />

      {activeWorkflow.error_message && (
        <Card>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-red-700">{activeWorkflow.error_message}</p>
          </div>
        </Card>
      )}

      {activeWorkflow.contracts && activeWorkflow.contracts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Generated Contract</h2>
          {loadingContracts ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" text="Loading contract code..." />
              </div>
            </Card>
          ) : contractsWithCode.length > 0 ? (
            contractsWithCode.map((contract) => (
              <ContractViewer
                key={contract.id}
                contractCode={contract.source_code || ''}
                abi={contract.abi}
                contractName={contract.contract_name || contract.contract_type}
              />
            ))
          ) : (
            <Card>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">
                  Contract code is being generated. Please refresh the page in a moment.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeWorkflow.deployments && activeWorkflow.deployments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Deployment Information</h2>
          {activeWorkflow.deployments.map((deployment) => (
            <Card key={deployment.id}>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Contract Address:</span>
                  <div className="mt-1">
                    <ExplorerLink
                      network={deployment.network}
                      type="address"
                      value={deployment.contract_address}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Transaction Hash:</span>
                  <div className="mt-1">
                    <ExplorerLink
                      network={deployment.network}
                      type="tx"
                      value={deployment.transaction_hash}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Block Number:</span>
                    <span className="ml-2 font-medium">{deployment.block_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gas Used:</span>
                    <span className="ml-2 font-medium">{deployment.gas_used.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

