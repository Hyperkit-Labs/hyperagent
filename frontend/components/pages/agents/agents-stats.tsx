import React from 'react';
import Cpu from 'lucide-react/dist/esm/icons/cpu'
import Coins from 'lucide-react/dist/esm/icons/coins'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'

export const AgentsStats: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Active Threads
          </span>
          <Cpu className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">12/20</div>
        <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" /> 4 new tasks queueing
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Token Usage
          </span>
          <Coins className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">842k</div>
        <div className="text-[10px] text-slate-500 mt-1">~ $12.42 this session</div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Success Rate
          </span>
          <CheckCircle2 className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">98.2%</div>
        <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> 2 conflicts resolved
        </div>
      </div>
    </div>
  );
};