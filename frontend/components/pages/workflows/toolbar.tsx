import React from 'react';
import Search from 'lucide-react/dist/esm/icons/search'
import Filter from 'lucide-react/dist/esm/icons/filter'
import Layers from 'lucide-react/dist/esm/icons/layers'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import List from 'lucide-react/dist/esm/icons/list'
import KanbanSquare from 'lucide-react/dist/esm/icons/kanban-square'

interface WorkflowsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedProject: string;
  onProjectChange: (value: string) => void;
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
}

export const WorkflowsToolbar: React.FC<WorkflowsToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedProject,
  onProjectChange,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by ID, name, or hash..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-md py-2 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 placeholder:text-slate-600 transition-all h-9"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        {/* Status Filter */}
        <button className="flex items-center gap-2 px-3 py-2 h-9 text-xs font-medium text-slate-300 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          Status: {selectedStatus}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>

        {/* Project Filter */}
        <button className="flex items-center gap-2 px-3 py-2 h-9 text-xs font-medium text-slate-300 bg-white/[0.03] border border-white/10 rounded-md hover:bg-white/[0.08] hover:text-white transition-all whitespace-nowrap">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          Project: {selectedProject}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>

        <div className="h-4 w-[1px] bg-white/10 mx-1" />

        {/* View Mode Toggles */}
        <button
          onClick={() => onViewModeChange('list')}
          className={`flex items-center justify-center w-9 h-9 border rounded-md transition-all ${
            viewMode === 'list'
              ? 'text-slate-300 bg-white/[0.08] border-white/10'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border-transparent'
          }`}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`flex items-center justify-center w-9 h-9 border rounded-md transition-all ${
            viewMode === 'kanban'
              ? 'text-slate-300 bg-white/[0.08] border-white/10'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border-transparent'
          }`}
        >
          <KanbanSquare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};