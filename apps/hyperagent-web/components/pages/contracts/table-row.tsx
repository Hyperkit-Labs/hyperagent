import React from 'react';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Image from 'lucide-react/dist/esm/icons/image';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2';
import FileCode from 'lucide-react/dist/esm/icons/file-code';
import Split from 'lucide-react/dist/esm/icons/split';
import Copy from 'lucide-react/dist/esm/icons/copy';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import FileWarning from 'lucide-react/dist/esm/icons/file-warning';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import { Contract } from './ContractsTable';

interface ContractTableRowProps {
  contract: Contract;
  isSelected: boolean;
  onSelect: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  lock: Lock,
  image: Image,
  'settings-2': Settings2,
  'file-code': FileCode,
  split: Split,
};

export const ContractTableRow: React.FC<ContractTableRowProps> = ({
  contract,
  isSelected,
  onSelect,
}) => {
  const ContractIcon = iconMap[contract.icon] || FileCode;

  const getVerificationBadge = () => {
    switch (contract.verification) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
            <FileWarning className="w-3 h-3" /> Unverified
          </span>
        );
      case 'deprecated':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Deprecated
          </span>
        );
    }
  };

  const rowOpacity = contract.isDeprecated ? 'opacity-60 hover:opacity-100' : '';

  return (
    <div
      className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors cursor-pointer relative ${rowOpacity}`}
    >
      {/* Left Accent Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-violet-600/50 transition-colors" />

      <div className="col-span-5 lg:col-span-4 flex items-center gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="custom-checkbox appearance-none h-3.5 w-3.5 rounded border border-slate-600 bg-transparent checked:bg-violet-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
        />
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded bg-gradient-to-br ${contract.iconColor} flex items-center justify-center shrink-0`}
          >
            <ContractIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className={`text-sm font-medium transition-colors truncate ${
                contract.isDeprecated
                  ? 'text-slate-400 group-hover:text-slate-300'
                  : 'text-slate-200 group-hover:text-white'
              }`}
            >
              {contract.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`font-mono text-[10px] ${
                  contract.isDeprecated ? 'text-slate-600' : 'text-slate-500'
                }`}
              >
                {contract.address}
              </span>
              <button
                className={`transition-colors ${
                  contract.isDeprecated
                    ? 'text-slate-700 hover:text-slate-500'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <div className="flex items-center gap-1.5 bg-slate-800/50 border border-white/5 rounded-full pl-1.5 pr-2.5 py-0.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: contract.network.color }}
          />
          <span
            className={`text-xs ${
              contract.isDeprecated ? 'text-slate-400' : 'text-slate-300'
            }`}
          >
            {contract.network.name}
          </span>
        </div>
      </div>

      <div className="col-span-3 lg:col-span-2">{getVerificationBadge()}</div>

      <div className="col-span-2 text-right hidden lg:block">
        <span
          className={`text-sm font-medium ${
            contract.isDeprecated ? 'text-slate-400' : 'text-slate-300'
          }`}
        >
          {contract.balance.amount}
        </span>
        {contract.balance.usd && (
          <div
            className={`text-[10px] ${
              contract.isDeprecated ? 'text-slate-600' : 'text-slate-500'
            }`}
          >
            {contract.balance.usd}
          </div>
        )}
      </div>

      <div className="col-span-4 lg:col-span-2 text-right">
        <span
          className={`text-xs block ${
            contract.isDeprecated ? 'text-slate-500' : 'text-slate-300'
          }`}
        >
          {contract.lastActivity.time}
        </span>
        <span
          className={`text-[10px] font-mono ${
            contract.isDeprecated ? 'text-slate-600' : 'text-slate-500'
          }`}
        >
          {contract.lastActivity.action}
        </span>
      </div>

      {/* Floating Action */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1.5 text-slate-400 hover:text-white bg-[#0B0B14] border border-white/10 rounded-md shadow-lg">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

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