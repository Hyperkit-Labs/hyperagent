import React from 'react';
import Link from 'next/link';
import Plus from 'lucide-react/dist/esm/icons/plus'

export const WorkflowsHeader: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-white mb-1">Workflows</h1>
        <p className="text-sm text-slate-400">Manage, trigger, and monitor automated agent tasks.</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/workflows/create" className="px-3 py-1.5 text-sm font-medium text-white bg-violet-600 border border-violet-500/50 rounded-md hover:bg-violet-500 shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" />
          New Workflow
        </Link>
      </div>
    </div>
  );
};