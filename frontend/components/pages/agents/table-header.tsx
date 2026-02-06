import React from 'react';

export const AgentTableHeader: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-white/[0.02] text-xs font-medium text-slate-500 uppercase tracking-wider">
      <div className="col-span-5 lg:col-span-4">Agent Identity</div>
      <div className="col-span-2 hidden lg:block">Model</div>
      <div className="col-span-2 hidden lg:block">Context</div>
      <div className="col-span-3 lg:col-span-3">Current Activity</div>
      <div className="col-span-2 lg:col-span-1 text-right">Active</div>
    </div>
  );
};