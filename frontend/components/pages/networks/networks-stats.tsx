import React from 'react';
import Zap from 'lucide-react/dist/esm/icons/zap'
import Network from 'lucide-react/dist/esm/icons/network'
import Link from 'lucide-react/dist/esm/icons/link'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'

export const NetworksStats: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Total Request
          </span>
          <Zap className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">24.5M</div>
        <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> 4.3k req/s peak
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Avg Latency
          </span>
          <Network className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">42ms</div>
        <div className="text-[10px] text-slate-500 mt-1">Global average</div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Active Chains
          </span>
          <Link className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">5/8</div>
        <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> 1 degraded
        </div>
      </div>
    </div>
  );
};