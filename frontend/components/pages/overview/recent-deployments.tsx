"use client";

import React, { useState, useEffect } from 'react';
import UploadCloud from 'lucide-react/dist/esm/icons/upload-cloud'
import Layers from 'lucide-react/dist/esm/icons/layers'
import File from 'lucide-react/dist/esm/icons/file'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { getWorkflows } from '@/lib/api';
import Link from 'next/link';

interface Deployment {
  workflow_id: string;
  name: string;
  subtitle: string;
  type: string;
  icon: 'layers' | 'file';
  deploymentType: string;
  network: string;
  status: 'success' | 'broadcasting' | 'pending';
}

export const RecentDeployments: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeployments = async () => {
      try {
        const result = await getWorkflows({ limit: 5 });
        const workflows = result.workflows || [];
        
        const mapped: Deployment[] = workflows
          .filter((w) => w.deployment_result || w.deploymentAddress)
          .map((workflow) => {
            const txHash = workflow.deployment_result?.transaction_hash || workflow.txHash || '';
            const shortTx = txHash ? `Tx: ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'No tx hash';
            const contractName = workflow.nlp_input || workflow.intent || 'Contract';
            const shortName = contractName.length > 30 
              ? contractName.slice(0, 30) + '...' 
              : contractName;
            
            return {
              workflow_id: workflow.workflow_id,
              name: shortName,
              subtitle: shortTx,
              type: 'Single',
              icon: 'file' as const,
              deploymentType: 'Single',
              network: workflow.network || 'Unknown',
              status: workflow.status === 'completed' ? 'success' as const : 'pending' as const,
            };
          })
          .slice(0, 5);
        
        setDeployments(mapped);
      } catch (error) {
        console.error('Failed to fetch deployments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDeployments, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return (
    <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-violet-400" /> Recent Deployments
        </h3>
        <label className="flex items-center cursor-pointer gap-2">
          <span className="text-xs text-slate-500 font-medium">Auto-refresh</span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600" />
          </div>
        </label>
      </div>
      <div className="p-0">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <UploadCloud className="w-12 h-12 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">No deployments yet</p>
            <Link href="/workflows/create" className="text-xs text-violet-400 hover:text-violet-300 mt-2">
              Create your first workflow
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {deployments.map((deployment) => (
              <Link
                key={deployment.workflow_id}
                href={`/workflows/${deployment.workflow_id}`}
                className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded ${
                      deployment.icon === 'layers'
                        ? 'bg-violet-500/10 text-violet-400'
                        : 'bg-slate-700/30 text-slate-400'
                    }`}
                  >
                    {deployment.icon === 'layers' ? (
                      <Layers className="w-4 h-4" />
                    ) : (
                      <File className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{deployment.name}</div>
                    <div className="text-xs text-slate-500">{deployment.subtitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-medium text-white">{deployment.deploymentType}</div>
                    <div className="text-[10px] text-slate-500">{deployment.network}</div>
                  </div>
                  {deployment.status === 'success' ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Success
                    </span>
                  ) : deployment.status === 'broadcasting' ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Broadcasting
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Pending
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};