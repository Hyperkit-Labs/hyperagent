'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getWorkflowContracts } from '@/lib/api';
import { WorkflowProgress } from '@/components/workflows/WorkflowProgress';
import { ContractViewer } from '@/components/contracts/ContractViewer';
import { DynamicIsland } from '@/components/workflow/DynamicIsland';
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
  const [isV2Workflow, setIsV2Workflow] = useState(false);

  // Check if this is a v2 workflow (has meta.workflowId pattern)
  useEffect(() => {
    const checkV2 = async () => {
      if (workflowId && workflowId.startsWith('wf_')) {
        try {
          // Try to fetch v2 workflow
          const v2Workflow = await getWorkflowV2(workflowId);
          if (v2Workflow.meta?.workflowId) {
            setIsV2Workflow(true);
          }
        } catch (error) {
          // Not a v2 workflow, use v1
          setIsV2Workflow(false);
        }
      }
    };
    checkV2();
  }, [workflowId]);

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
        <p className="text-gray-400">Workflow not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DynamicIsland workflowId={workflowId} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {activeWorkflow.name || `Workflow ${activeWorkflow.workflow_id.slice(0, 8)}`}
          </h1>
          <p className="mt-2 text-gray-400">
            Created {formatDate(activeWorkflow.created_at)} • {activeWorkflow.network}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="text-xs text-green-400 bg-green-500/20 border border-green-500/30 px-2 py-1 rounded-full font-semibold">
              Live
            </span>
          )}
          <StatusBadge status={activeWorkflow.status} />
        </div>
      </div>

      <WorkflowProgress workflow={activeWorkflow} />

      {activeWorkflow.error_message && (
        <div className="bg-gray-900/50 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <h3 className="font-semibold text-red-400 mb-2">Error</h3>
            <p className="text-red-300">{activeWorkflow.error_message}</p>
          </div>
        </div>
      )}

      {/* Show contract code - support both v1 and v2 formats */}
      {((activeWorkflow.contracts && activeWorkflow.contracts.length > 0) || activeWorkflow.contract || activeWorkflow.contract_code) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Generated Contract</h2>
          {loadingContracts && activeWorkflow.contracts ? (
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="md" text="Loading contract code..." />
              </div>
            </div>
          ) : contractsWithCode.length > 0 ? (
            contractsWithCode.map((contract) => (
              <ContractViewer
                key={contract.id}
                contractCode={contract.source_code || ''}
                abi={contract.abi}
                contractName={contract.contract_name || contract.contract_type}
              />
            ))
          ) : activeWorkflow.contract || activeWorkflow.contract_code ? (
            <ContractViewer
              contractCode={activeWorkflow.contract || activeWorkflow.contract_code || ''}
              abi={activeWorkflow.compiled_contract?.abi || []}
              contractName="Generated Contract"
            />
          ) : (
            <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-400">
                  Contract code is being generated. Please refresh the page in a moment.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deployment Information - support both v1 and v2 formats */}
      {((activeWorkflow.deployments && activeWorkflow.deployments.length > 0) || activeWorkflow.deploymentAddress || activeWorkflow.txHash) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Deployment Information</h2>
          {activeWorkflow.deployments && activeWorkflow.deployments.length > 0 ? (
            activeWorkflow.deployments.map((deployment) => (
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
            ))
          ) : (activeWorkflow.deploymentAddress || activeWorkflow.txHash) ? (
            <Card>
              <div className="space-y-3">
                {activeWorkflow.deploymentAddress && (
                  <div>
                    <span className="text-sm text-gray-500">Contract Address:</span>
                    <div className="mt-1">
                      <ExplorerLink
                        network={activeWorkflow.network}
                        type="address"
                        value={activeWorkflow.deploymentAddress}
                      />
                    </div>
                  </div>
                )}
                {activeWorkflow.txHash && (
                  <div>
                    <span className="text-sm text-gray-500">Transaction Hash:</span>
                    <div className="mt-1">
                      <ExplorerLink
                        network={activeWorkflow.network}
                        type="tx"
                        value={activeWorkflow.txHash}
                      />
                    </div>
                  </div>
                )}
                {activeWorkflow.meta?.ipfsCid && (
                  <div>
                    <span className="text-sm text-gray-500">IPFS CID (EigenDA):</span>
                    <div className="mt-1">
                      <a
                        href={`https://ipfs.io/ipfs/${activeWorkflow.meta.ipfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline font-mono text-sm"
                      >
                        {activeWorkflow.meta.ipfsCid}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {/* Audit Results - v2 format */}
      {activeWorkflow.auditResults && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Audit Results</h2>
          <Card>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Status:</span>
                <StatusBadge status={activeWorkflow.auditResults.passed ? 'completed' : 'failed'} />
                <span className={`text-sm font-medium ${
                  activeWorkflow.auditResults.passed ? 'text-green-400' : 'text-red-400'
                }`}>
                  {activeWorkflow.auditResults.passed ? 'Passed' : 'Failed'}
                </span>
              </div>
              {activeWorkflow.auditResults.findings && activeWorkflow.auditResults.findings.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Findings:</span>
                  <ul className="mt-2 space-y-1">
                    {activeWorkflow.auditResults.findings.map((finding: string, idx: number) => (
                      <li key={idx} className="text-sm text-orange-300">• {finding}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

