'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Clock from 'lucide-react/dist/esm/icons/clock'
import X from 'lucide-react/dist/esm/icons/x'
import { getWorkflows } from '@/lib/api';
import type { Workflow as ApiWorkflow } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface Workflow {
  description: string;
  type: string;
  network: string;
  networkColor: string;
  status: 'completed' | 'running' | 'failed';
  time: string;
  id?: string;
}

const getNetworkColor = (network: string): string => {
  const colorMap: Record<string, string> = {
    mantle_testnet: 'bg-white/50',
    mantle_mainnet: 'bg-white/50',
    avalanche_fuji: 'bg-red-500',
    avalanche_mainnet: 'bg-red-500',
    base_sepolia: 'bg-blue-500',
    base_mainnet: 'bg-blue-500',
    arbitrum_sepolia: 'bg-cyan-500',
    arbitrum_one: 'bg-cyan-500',
  };
  return colorMap[network] || 'bg-violet-500';
};

const getWorkflowType = (workflow: ApiWorkflow): string => {
  const stages = workflow.stages || [];
  const currentStage = stages.find(s => s.status === 'in_progress' || s.status === 'processing');
  if (currentStage) {
    return currentStage.name.charAt(0).toUpperCase() + currentStage.name.slice(1);
  }
  if (workflow.status === 'completed' || workflow.status === 'success') {
    return 'Deployment';
  }
  return 'Workflow';
};

export const RecentWorkflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await getWorkflows({ limit: 5 });
        // getWorkflows returns { workflows: [], total: number }
        const workflowsList = Array.isArray(response) ? response : response.workflows || [];
        const adaptedWorkflows: Workflow[] = workflowsList.map((wf: ApiWorkflow) => ({
          description: wf.nlp_input || wf.intent || 'Workflow',
          type: getWorkflowType(wf),
          network: wf.network || 'Unknown',
          networkColor: getNetworkColor(wf.network || ''),
          status: wf.status === 'completed' || wf.status === 'success' ? 'completed' : 
                  wf.status === 'failed' || wf.status === 'error' ? 'failed' : 'running',
          time: wf.created_at ? formatDistanceToNow(new Date(wf.created_at), { addSuffix: true }) : 'Unknown',
          id: wf.workflow_id,
        }));
        setWorkflows(adaptedWorkflows);
      } catch (error) {
        console.error('Failed to fetch recent workflows:', error);
        // Fallback to empty array on error
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);
  const getStatusBadge = (status: Workflow['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Completed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
            <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-amber-400" /> Running
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
            <X className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400" /> Recent Workflows
        </h3>
        <Link href="/workflows" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          View All
        </Link>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400 mx-auto mb-2"></div>
            <p className="text-xs">Loading workflows...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm mb-2">No workflows yet</p>
            <Link href="/workflows/create" className="text-xs text-violet-400 hover:text-violet-300">
              Create your first workflow
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-white/[0.02] text-xs uppercase text-slate-500 font-medium">
              <tr>
                <th className="px-5 py-3 tracking-wider font-medium">Description</th>
                <th className="px-5 py-3 tracking-wider font-medium">Type</th>
                <th className="px-5 py-3 tracking-wider font-medium">Network</th>
                <th className="px-5 py-3 tracking-wider font-medium">Status</th>
                <th className="px-5 py-3 tracking-wider font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {workflows.map((workflow, index) => (
                <tr
                  key={workflow.id || index}
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  <td className="px-5 py-3 font-medium text-slate-300 group-hover:text-white">
                    {workflow.id ? (
                      <Link href={`/workflows/${workflow.id}`} className="hover:text-violet-300">
                        {workflow.description}
                      </Link>
                    ) : (
                      workflow.description
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-xs text-slate-400">
                      {workflow.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex items-center gap-2 text-slate-400 text-xs">
                    <div className={`w-2 h-2 rounded-full ${workflow.networkColor}`} />{' '}
                    {workflow.network}
                  </td>
                  <td className="px-5 py-3">{getStatusBadge(workflow.status)}</td>
                  <td className="px-5 py-3 text-right text-slate-500 text-xs font-mono">
                    {workflow.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};