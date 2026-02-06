import React from 'react';
import GitPullRequest from 'lucide-react/dist/esm/icons/git-pull-request'
import Plus from 'lucide-react/dist/esm/icons/plus'

export const DeploymentsHeader: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-white mb-1">Deployments</h1>
        <p className="text-sm text-slate-400">
          View and manage deployment pipelines across all networks.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="px-3 py-1.5 text-sm font-medium text-slate-300 bg-white/5 border border-white/10 rounded-md hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
          <GitPullRequest className="w-4 h-4" />
          Connect Repo
        </button>
        <button className="px-3 py-1.5 text-sm font-medium text-white bg-violet-600 border border-violet-500/50 rounded-md hover:bg-violet-500 shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" />
          New Deployment
        </button>
      </div>
    </div>
  );
};