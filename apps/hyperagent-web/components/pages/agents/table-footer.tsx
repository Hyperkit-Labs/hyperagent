import React from 'react';

interface AgentTableFooterProps {
  totalAgents: number;
}

export const AgentTableFooter: React.FC<AgentTableFooterProps> = ({ totalAgents }) => {
  return (
    <div className="mt-auto border-t border-white/5 px-6 py-4 flex items-center justify-between">
      <div className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-300">{totalAgents}</span> active agents
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled
          className="px-3 py-1.5 text-xs font-medium text-slate-400 border border-white/10 rounded hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button className="px-3 py-1.5 text-xs font-medium text-slate-400 border border-white/10 rounded hover:bg-white/5 hover:text-white transition-all">
          Next
        </button>
      </div>
    </div>
  );
};