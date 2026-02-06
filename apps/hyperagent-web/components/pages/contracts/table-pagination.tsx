import React from 'react';

interface ContractTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  resultsPerPage: number;
  onPageChange: (page: number) => void;
}

export const ContractTablePagination: React.FC<ContractTablePaginationProps> = ({
  currentPage,
  totalPages,
  totalResults,
  resultsPerPage,
  onPageChange,
}) => {
  const startResult = (currentPage - 1) * resultsPerPage + 1;
  const endResult = Math.min(currentPage * resultsPerPage, totalResults);

  return (
    <div className="mt-auto border-t border-white/5 px-6 py-4 flex items-center justify-between">
      <div className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-300">{startResult}</span> to{' '}
        <span className="font-medium text-slate-300">{endResult}</span> of{' '}
        <span className="font-medium text-slate-300">{totalResults}</span> contracts
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 border border-white/10 rounded hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-xs font-medium text-slate-400 border border-white/10 rounded hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};