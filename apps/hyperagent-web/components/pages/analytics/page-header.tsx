import React from 'react';

export const AnalyticsHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-base font-medium text-white">Throughput & Latency</h2>
        <p className="text-xs text-slate-400 mt-1">Request volume overlaid with system latency over time.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span className="text-slate-300">Requests</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-slate-300">Latency</span>
        </div>
      </div>
    </div>
  );
};