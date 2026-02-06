import React from 'react';
import Search from 'lucide-react/dist/esm/icons/search'
import BrainCircuit from 'lucide-react/dist/esm/icons/brain-circuit'
import Activity from 'lucide-react/dist/esm/icons/activity'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'

interface AgentsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedModel: string;
  onModelChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
}

export const AgentsToolbar: React.FC<AgentsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedModel,
  onModelChange,
  selectedStatus,
  onStatusChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Filter by agent name, capability or model..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-md py-2 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 placeholder:text-slate-600 transition-all h-9"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        {/* Model Filter */}
        <button className="flex items-center gap-2 px-3 py-2 h-9 text-xs font-medium text-slate-300 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap">
          <BrainCircuit className="w-3.5 h-3.5 text-slate-500" />
          Model: {selectedModel}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>

        {/* Status Filter */}
        <button className="flex items-center gap-2 px-3 py-2 h-9 text-xs font-medium text-slate-300 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          Status: {selectedStatus}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>

        <div className="h-4 w-[1px] bg-white/10 mx-1" />

        {/* Refresh Button */}
        <button className="flex items-center justify-center w-9 h-9 text-slate-300 bg-white/[0.08] border border-white/10 rounded-md transition-all hover:bg-white/10">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};