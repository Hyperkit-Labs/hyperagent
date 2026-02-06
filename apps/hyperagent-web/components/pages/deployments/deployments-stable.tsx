import React, { useState, useEffect } from 'react';
import { DeploymentTableHeader } from '@/components/pages/deployments/table-header';
import { DeploymentTableRow } from '@/components/pages/deployments/table-row';
import { DeploymentTablePagination } from '@/components/pages/deployments/table-pagination';
import { getWorkflows, type WorkflowResponse } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export interface Deployment {
  id: string;
  title: string;
  commitHash: string;
  author: string;
  environment: 'Production' | 'Staging' | 'Devnet';
  environmentIcon: string;
  branch: string;
  status: 'building' | 'failed' | 'ready';
  time: string;
  duration: string;
}

const getEnvironment = (network: string): 'Production' | 'Staging' | 'Devnet' => {
  if (network.toLowerCase().includes('testnet') || 
      network.toLowerCase().includes('sepolia') ||
      network.toLowerCase().includes('fuji')) {
    return 'Devnet';
  }
  if (network.toLowerCase().includes('staging')) {
    return 'Staging';
  }
  return 'Production';
};

const getEnvironmentIcon = (environment: string): string => {
  if (environment === 'Production') return 'zap';
  if (environment === 'Staging') return 'layout';
  return 'test-tube-2';
};

export const DeploymentsTable: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;

  useEffect(() => {
    const fetchDeployments = async () => {
      try {
        setLoading(true);
        const response = await getWorkflows({ limit: 100 });
        const workflows = response.workflows || [];
        
        // Filter workflows that have deployment data
        const deployedWorkflows = workflows.filter(
          (wf: WorkflowResponse) => {
            const deploymentAddress = (wf as any).deploymentAddress || (wf.meta as any)?.deployment_address;
            return deploymentAddress || wf.status === 'deploying' || wf.status === 'DEPLOYING' || wf.status === 'completed' || wf.status === 'COMPLETED';
          }
        );

        // Convert workflows to deployments
        const deploymentsData: Deployment[] = deployedWorkflows.map((wf: WorkflowResponse) => {
          const environment = getEnvironment(wf.network || '');
          const txHash = (wf as any).txHash || (wf.meta as any)?.tx_hash || wf.workflow_id;
          const walletAddress = (wf as any).wallet_address || (wf.meta as any)?.wallet_address;
          
          return {
            id: wf.workflow_id,
            title: wf.nlp_input || (wf as any).intent || 'Smart Contract Deployment',
            commitHash: txHash.substring(0, 6),
            author: walletAddress ? `${walletAddress.substring(0, 6)}` : 'system',
            environment,
            environmentIcon: getEnvironmentIcon(environment),
            branch: wf.network || 'unknown',
            status: 
              wf.status === 'deploying' || wf.status === 'DEPLOYING' || wf.status === 'in_progress' ? 'building' :
              wf.status === 'failed' || wf.status === 'FAILED' || wf.status === 'error' ? 'failed' : 'ready',
            time: wf.created_at ? formatDistanceToNow(new Date(wf.created_at), { addSuffix: true }) : 'Unknown',
            duration: wf.updated_at && wf.created_at 
              ? `Duration: ${Math.round((new Date(wf.updated_at).getTime() - new Date(wf.created_at).getTime()) / 1000)}s`
              : 'Duration: N/A',
          };
        });

        setDeployments(deploymentsData);
      } catch (error) {
        console.error('Failed to fetch deployments:', error);
        setDeployments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
    const interval = setInterval(fetchDeployments, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // Pagination
  const totalPages = Math.ceil(deployments.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentDeployments = deployments.slice(startIndex, endIndex);

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
      <DeploymentTableHeader />

      {/* List Items */}
      <div className="divide-y divide-white/5 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading deployments...</p>
            </div>
          </div>
        ) : deployments.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-slate-400 mb-2">No deployments found</p>
              <p className="text-sm text-slate-500">Create your first workflow to see deployments here</p>
            </div>
          </div>
        ) : (
          currentDeployments.map((deployment) => (
            <DeploymentTableRow key={deployment.id} deployment={deployment} />
          ))
        )}
      </div>

      {!loading && deployments.length > 0 && (
        <DeploymentTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalResults={deployments.length}
          resultsPerPage={resultsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};