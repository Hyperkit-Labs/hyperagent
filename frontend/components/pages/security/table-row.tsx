import React from 'react';
import Unlock from 'lucide-react/dist/esm/icons/unlock';
import Key from 'lucide-react/dist/esm/icons/key';
import ZapOff from 'lucide-react/dist/esm/icons/zap-off';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import FileCode from 'lucide-react/dist/esm/icons/file-code';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Check from 'lucide-react/dist/esm/icons/check';
import { SecurityAlert } from './SecurityAlertsTable';

interface SecurityAlertTableRowProps {
  alert: SecurityAlert;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  unlocked: Unlock,
  key: Key,
  'zap-off': ZapOff,
  'shield-check': ShieldCheck,
};

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  high: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  medium: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  low: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  fixed: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
};

const iconColors: Record<string, string> = {
  amber: 'text-amber-500',
  orange: 'text-orange-400',
  blue: 'text-blue-400',
  emerald: 'text-emerald-500',
};

const iconBgColors: Record<string, string> = {
  amber: 'border-amber-500/20 bg-amber-500/10',
  orange: 'border-white/5 bg-slate-800',
  blue: 'border-white/5 bg-slate-800',
  emerald: 'border-white/5 bg-slate-800',
};

const statusColors: Record<string, { dot: string; text: string }> = {
  pending: {
    dot: 'bg-amber-500 animate-pulse',
    text: 'text-amber-100',
  },
  patched: {
    dot: 'bg-blue-500',
    text: 'text-slate-300',
  },
  ignored: {
    dot: 'bg-slate-500',
    text: 'text-slate-400',
  },
  resolved: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-500/80',
  },
};

export const SecurityAlertTableRow: React.FC<SecurityAlertTableRowProps> = ({ alert }) => {
  const AlertIcon = iconMap[alert.icon] || ShieldCheck;
  const severityStyle = severityColors[alert.severity];
  const iconColor = iconColors[alert.iconColor];
  const iconBg = iconBgColors[alert.iconColor];
  const statusStyle = statusColors[alert.status.state];

  const rowOpacity = alert.isResolved ? 'opacity-75 hover:opacity-100' : '';
  const titleColor = alert.isResolved ? 'text-slate-400' : 'text-white';
  const assetColor = alert.isResolved ? 'text-slate-400' : 'text-slate-300';
  const borderHover =
    alert.severity === 'high' ? 'hover:border-amber-500/50' : 'border-transparent';

  return (
    <div
      className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors relative border-l-2 ${borderHover} ${rowOpacity}`}
    >
      <div className="col-span-5 lg:col-span-4 flex items-center gap-4">
        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <AlertIcon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${titleColor}`}>{alert.title}</span>
            <span
              className={`text-[10px] rounded px-1.5 py-0.5 border font-medium ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}
            >
              {alert.severityLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">{alert.description}</span>
          </div>
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <div className={`flex items-center gap-2 text-xs font-mono ${assetColor}`}>
          <FileCode className="w-3 h-3 text-slate-500" />
          {alert.affectedAsset}
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex flex-col justify-center">
        <span className="text-xs text-slate-400">{alert.detectionTime}</span>
        <span className="text-[10px] text-slate-600">{alert.detectionMethod}</span>
      </div>

      <div className="col-span-3 lg:col-span-3 flex flex-col justify-center gap-1.5">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          <span className={`text-xs ${statusStyle.text}`}>{alert.status.label}</span>
        </div>
        <div
          className={`text-[10px] ${
            alert.status.state === 'ignored' ? 'text-slate-600' : 'text-slate-500'
          }`}
        >
          {alert.status.detail}
        </div>
      </div>

      <div className="col-span-2 lg:col-span-1 flex items-center justify-end">
        <button className="p-1.5 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-all">
          {alert.isResolved ? (
            <Check className="w-4 h-4" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};