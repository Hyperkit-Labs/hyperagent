import React from 'react';
import Search from 'lucide-react/dist/esm/icons/search'
import Filter from 'lucide-react/dist/esm/icons/filter'
import Box from 'lucide-react/dist/esm/icons/box'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw'

interface SecurityToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedSeverity: string;
  onSeverityChange: (value: string) => void;
  selectedScope: string;
  onScopeChange: (value: string) => void;
}

export const SecurityToolbar: React.FC<SecurityToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedSeverity,
  onSeverityChange,
  selectedScope,
  onScopeChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search vulnerabilities, contracts, or error codes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-md py-2 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder:text-slate-600 transition-all h-9"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        {/* Severity Filter */}
        <button className="flex items-center gap-2 px-3 py-2 h-9 text-xs font-medium text-slate-300 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          Severity: {selectedSeverity}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>

        {/* Scope Filter */}
        <button className="flex items-center gap-2 px-3 py-2 h-9 text-xs font-medium text-slate-300 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap">
          <Box className="w-3.5 h-3.5 text-slate-500" />
          Scope: {selectedScope}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>

        <div className="h-4 w-[1px] bg-white/10 mx-1" />

        {/* Refresh Button */}
        <button className="flex items-center justify-center w-9 h-9 text-slate-300 bg-white/[0.08] border border-white/10 rounded-md transition-all hover:bg-white/10">
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};