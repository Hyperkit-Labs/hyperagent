import React from 'react';
import Link from 'next/link';
import Shield from 'lucide-react/dist/esm/icons/shield';
import UploadCloud from 'lucide-react/dist/esm/icons/upload-cloud';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical';
import Bot from 'lucide-react/dist/esm/icons/bot';
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left';
import Database from 'lucide-react/dist/esm/icons/database';
import Check from 'lucide-react/dist/esm/icons/check';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Hourglass from 'lucide-react/dist/esm/icons/hourglass';
import Clock from 'lucide-react/dist/esm/icons/clock';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw';
import { Workflow } from './workflow-stable';

interface WorkflowTableRowProps {
  workflow: Workflow;
  isSelected: boolean;
  onSelect: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  'upload-cloud': UploadCloud,
  'flask-conical': FlaskConical,
  bot: Bot,
  'arrow-right-left': ArrowRightLeft,
  database: Database,
};

export const WorkflowTableRow: React.FC<WorkflowTableRowProps> = ({
  workflow,
  isSelected,
  onSelect,
}) => {
  const CategoryIcon = iconMap[workflow.categoryIcon] || Shield;

  const getStatusBadge = () => {
    switch (workflow.status) {
      case 'running':
        return (
          <div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </div>
              <span className="text-xs font-medium text-amber-400">Running...</span>
            </div>
            {workflow.progress !== undefined && (
              <div className="w-24 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full animate-pulse"
                  style={{ width: `${workflow.progress}%` }}
                />
              </div>
            )}
          </div>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <Check className="w-3 h-3" /> Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/30 px-2 py-0.5 text-xs font-medium text-slate-400 border border-slate-600/30">
            <Hourglass className="w-3 h-3" /> Queued
          </span>
        );
    }
  };

  const getAccentBarColor = () => {
    switch (workflow.status) {
      case 'running':
        return 'bg-amber-500 opacity-100';
      case 'failed':
        return 'bg-rose-500 opacity-50';
      default:
        return 'bg-transparent group-hover:bg-violet-600/50 transition-colors';
    }
  };

  const getActionButton = () => {
    if (workflow.status === 'failed') {
      return (
        <button className="p-1.5 text-slate-400 hover:text-white bg-[#0B0B14] border border-white/10 rounded-md shadow-lg">
          <RotateCw className="w-4 h-4" />
        </button>
      );
    }
    return (
      <button className="p-1.5 text-slate-400 hover:text-white bg-[#0B0B14] border border-white/10 rounded-md shadow-lg">
        <MoreHorizontal className="w-4 h-4" />
      </button>
    );
  };

  return (
    <Link href={`/workflows/${workflow.id}`} className="block">
      <div className="group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors cursor-pointer relative">
        {/* Left Accent Bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${getAccentBarColor()}`} />

      <div className="col-span-4 lg:col-span-3 flex items-center gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="custom-checkbox appearance-none h-3.5 w-3.5 rounded border border-slate-600 bg-transparent checked:bg-violet-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
        />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white group-hover:text-violet-200 transition-colors">
            {workflow.name}
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
            <CategoryIcon className="w-3 h-3 text-slate-500" /> {workflow.category}
          </span>
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <span className="font-mono text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
          {workflow.runId}
        </span>
      </div>

      <div className="col-span-3 lg:col-span-2">{getStatusBadge()}</div>

      <div className="col-span-3 lg:col-span-2 flex items-center gap-2">
        {workflow.triggeredBy?.type === 'user' ? (
          <>
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white shadow-inner">
              {workflow.triggeredBy.avatar}
            </div>
            <span className="text-xs text-slate-300">{workflow.triggeredBy.name}</span>
          </>
        ) : workflow.triggeredBy?.avatar ? (
          <>
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] border border-indigo-500/30">
              {workflow.triggeredBy.avatar}
            </div>
            <span className="text-xs text-slate-300">{workflow.triggeredBy.name}</span>
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">{workflow.triggeredBy?.name || 'System'}</span>
          </>
        )}
      </div>

      <div className="col-span-2 text-right hidden md:block">
        <span className="text-xs text-slate-400 font-mono">{workflow.duration}</span>
      </div>

      {/* Floating Action (Visible on Hover) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        {getActionButton()}
      </div>

        <style jsx>{`
          .custom-checkbox:checked {
            background-color: #7c3aed;
            border-color: #7c3aed;
            background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
          }
        `}</style>
      </div>
    </Link>
  );
};