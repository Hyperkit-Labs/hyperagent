import React from 'react';

export const SecurityAlertTableHeader: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-white/[0.02] text-xs font-medium text-slate-500 uppercase tracking-wider">
      <div className="col-span-5 lg:col-span-4">Vulnerability / Issue</div>
      <div className="col-span-2 hidden lg:block">Affected Asset</div>
      <div className="col-span-2 hidden lg:block">Detection Time</div>
      <div className="col-span-3 lg:col-span-3">Status</div>
      <div className="col-span-2 lg:col-span-1 text-right">Action</div>
    </div>
  );
};