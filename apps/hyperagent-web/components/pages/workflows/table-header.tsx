import React from 'react';

interface WorkflowTableHeaderProps {
  selectAll: boolean;
  onSelectAll: () => void;
}

export const WorkflowTableHeader: React.FC<WorkflowTableHeaderProps> = ({
  selectAll,
  onSelectAll,
}) => {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-white/[0.02] text-xs font-medium text-slate-500 uppercase tracking-wider">
      <div className="col-span-4 lg:col-span-3 flex items-center gap-3">
        <input
          type="checkbox"
          checked={selectAll}
          onChange={onSelectAll}
          className="custom-checkbox appearance-none h-3.5 w-3.5 rounded border border-slate-600 bg-transparent checked:bg-violet-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
        />
        <span>Workflow Name</span>
      </div>
      <div className="col-span-2 hidden lg:block">Run ID</div>
      <div className="col-span-3 lg:col-span-2">Status</div>
      <div className="col-span-3 lg:col-span-2">Triggered By</div>
      <div className="col-span-2 text-right hidden md:block">Duration</div>

      <style jsx>{`
        .custom-checkbox:checked {
          background-color: #7c3aed;
          border-color: #7c3aed;
          background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
        }
      `}</style>
    </div>
  );
};