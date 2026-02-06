import React from 'react';
import FileText from 'lucide-react/dist/esm/icons/file-text'
import ScanEye from 'lucide-react/dist/esm/icons/scan-eye'

export const SecurityHeader: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-white mb-1">Security Center</h1>
        <p className="text-sm text-slate-400">
          Real-time vulnerability scanning, contract auditing, and threat detection.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="px-3 py-1.5 text-sm font-medium text-slate-300 bg-white/5 border border-white/10 rounded-md hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
          <FileText className="w-4 h-4" />
          View Report
        </button>
        <button className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-emerald-500/50 rounded-md hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 whitespace-nowrap">
          <ScanEye className="w-4 h-4" />
          New Audit
        </button>
      </div>
    </div>
  );
};