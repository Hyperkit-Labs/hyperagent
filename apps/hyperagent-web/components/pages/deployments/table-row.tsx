import React from 'react';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import X from 'lucide-react/dist/esm/icons/x';
import Check from 'lucide-react/dist/esm/icons/check';
import Layout from 'lucide-react/dist/esm/icons/layout';
import Zap from 'lucide-react/dist/esm/icons/zap';
import TestTube2 from 'lucide-react/dist/esm/icons/test-tube-2';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch';
import Info from 'lucide-react/dist/esm/icons/info';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import { Deployment } from './DeploymentsTable';

interface DeploymentTableRowProps {
  deployment: Deployment;
}

const envIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: Layout,
  zap: Zap,
  'test-tube-2': TestTube2,
};

export const DeploymentTableRow: React.FC<DeploymentTableRowProps> = ({ deployment }) => {
  const EnvIcon = envIconMap[deployment.environmentIcon] || Layout;

  const getStatusIcon = () => {
    switch (deployment.status) {
      case 'building':
        return (
          <div className="relative mt-0.5">
            <div className="absolute inset-0 bg-amber-500 blur-[8px] opacity-20 rounded-full" />
            <div className="relative w-8 h-8 rounded-full border border-amber-500/30 flex items-center justify-center bg-amber-500/10">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            </div>
          </div>
        );
      case 'failed':
        return (
          <div className="w-8 h-8 rounded-full border border-rose-500/20 flex items-center justify-center bg-rose-500/10 shrink-0">
            <X className="w-4 h-4 text-rose-500" />
          </div>
        );
      case 'ready':
        return (
          <div className="w-8 h-8 rounded-full border border-emerald-500/20 flex items-center justify-center bg-emerald-500/10 shrink-0">
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
        );
    }
  };

  const getStatusBadge = () => {
    switch (deployment.status) {
      case 'building':
        return (
          <span className="text-xs font-medium text-amber-400 animate-pulse">Building...</span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400">
            Failed
            <Info className="w-3 h-3 ml-1 opacity-50 hover:opacity-100 cursor-help" />
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            Ready
          </span>
        );
    }
  };

  const getAccentBarClass = () => {
    switch (deployment.status) {
      case 'building':
        return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
      case 'failed':
        return 'bg-transparent group-hover:bg-rose-500/50 transition-colors';
      case 'ready':
        return 'bg-transparent group-hover:bg-emerald-500/50 transition-colors';
    }
  };

  return (
    <div className="group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors cursor-pointer relative">
      {/* Accent Border */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${getAccentBarClass()}`} />

      <div className="col-span-5 lg:col-span-4 flex items-start gap-4">
        {getStatusIcon()}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{deployment.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 font-mono">
              {deployment.commitHash}
            </span>
            <span className="text-[10px] text-slate-500">by {deployment.author}</span>
          </div>
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <span className="text-xs text-slate-300 flex items-center gap-1.5">
          <EnvIcon className="w-3.5 h-3.5 text-slate-500" />
          {deployment.environment}
        </span>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.03] border border-white/5 max-w-[120px]">
          <GitBranch className="w-3 h-3 text-slate-500" />
          <span className="text-xs text-slate-300 truncate">{deployment.branch}</span>
        </div>
      </div>

      <div className="col-span-3 lg:col-span-2">{getStatusBadge()}</div>

      <div className="col-span-4 lg:col-span-2 text-right">
        <span className="text-xs text-slate-300 block">{deployment.time}</span>
        <span className="text-[10px] text-slate-500">{deployment.duration}</span>
      </div>

      {/* Floating Action (only for completed deployments) */}
      {deployment.status !== 'building' && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 text-slate-400 hover:text-white bg-[#0B0B14] border border-white/10 rounded-md shadow-lg">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};