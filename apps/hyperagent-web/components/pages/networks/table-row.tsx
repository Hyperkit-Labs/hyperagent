import React, { useState } from 'react';
import Hexagon from 'lucide-react/dist/esm/icons/hexagon';
import Triangle from 'lucide-react/dist/esm/icons/triangle';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Terminal from 'lucide-react/dist/esm/icons/terminal';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2';
import { Network } from '@/components/pages/networks/networks-table';

interface NetworkTableRowProps {
  network: Network;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  hexagon: Hexagon,
  triangle: Triangle,
  layers: Layers,
  zap: Zap,
  terminal: Terminal,
};

export const NetworkTableRow: React.FC<NetworkTableRowProps> = ({ network }) => {
  const [isEnabled, setIsEnabled] = useState(network.enabled);
  const NetworkIcon = iconMap[network.icon] || Hexagon;

  const getStatusIndicator = () => {
    switch (network.status) {
      case 'operational':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs text-emerald-400">Operational</span>
            </div>
            <div className="w-full max-w-[140px] h-1 bg-white/10 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${network.latencyPercentage}%` }}
              />
              {network.latencyPercentage > 40 && (
                <div className="h-full bg-emerald-500/50 w-[10%]" />
              )}
            </div>
          </>
        );
      case 'degraded':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-400">Degraded</span>
            </div>
            <div className="w-full max-w-[140px] h-1 bg-white/10 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${network.latencyPercentage}%` }}
              />
            </div>
          </>
        );
      case 'disconnected':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
              <span className="text-xs text-slate-500">Disconnected</span>
            </div>
            <div className="w-full max-w-[140px] h-1 bg-white/5 rounded-full overflow-hidden flex">
              {/* Empty bar */}
            </div>
          </>
        );
    }
  };

  const getAccentBarClass = () => {
    if (network.status === 'degraded') {
      return 'bg-transparent group-hover:bg-amber-500/50 transition-colors';
    }
    return '';
  };

  const rowOpacity = network.isDisabled ? 'opacity-60 hover:opacity-100' : '';
  const textColor = network.isDisabled ? 'text-slate-400' : 'text-white';
  const secondaryTextColor = network.isDisabled ? 'text-slate-600' : 'text-slate-500';

  return (
    <div
      className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors relative ${rowOpacity}`}
    >
      {/* Warning Sidebar for degraded */}
      {network.status === 'degraded' && (
        <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${getAccentBarClass()}`} />
      )}

      <div className="col-span-5 lg:col-span-4 flex items-center gap-4">
        <div
          className={`w-9 h-9 rounded-lg border border-white/5 flex items-center justify-center shrink-0 ${
            network.isDisabled ? 'bg-slate-800 grayscale' : ''
          }`}
          style={
            !network.isDisabled
              ? { backgroundColor: `${network.iconColor}1A` }
              : undefined
          }
        >
          <NetworkIcon
            className={`w-5 h-5 ${
              network.icon === 'triangle' ? 'rotate-180' : ''
            }`}
            style={{ color: network.iconColor }}
            fill={`${network.iconColor}33`}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${textColor}`}>
              {network.name}
            </span>
            <span
              className={`text-[10px] border border-white/10 rounded px-1 ${secondaryTextColor}`}
            >
              {network.currency}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] truncate ${secondaryTextColor}`}>
              {network.rpcUrl}
            </span>
            {!network.isDisabled && (
              <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Copy className="w-3 h-3 text-slate-600 hover:text-slate-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <span
          className={`text-xs font-mono ${
            network.isDisabled ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          {network.chainId}
        </span>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <span
          className={`inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium ring-1 ring-inset ${
            network.isDisabled
              ? 'text-slate-500 ring-white/5'
              : 'text-slate-300 ring-white/10'
          }`}
        >
          {network.type}
        </span>
      </div>

      <div className="col-span-3 lg:col-span-3 flex flex-col justify-center gap-1.5">
        {getStatusIndicator()}
        <span
          className={`text-[10px] ${
            network.status === 'degraded'
              ? 'text-amber-500/80'
              : network.isDisabled
              ? 'text-slate-600'
              : 'text-slate-500'
          }`}
        >
          {network.latency}
          {network.blockInfo && ` • ${network.blockInfo}`}
        </span>
      </div>

      <div className="col-span-2 lg:col-span-1 flex items-center justify-end">
        {/* Custom Toggle */}
        <div className="relative inline-block w-9 h-5 align-middle select-none transition duration-200 ease-in">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={() => setIsEnabled(!isEnabled)}
            className={`toggle-checkbox absolute block w-3.5 h-3.5 rounded-full bg-white border-4 appearance-none cursor-pointer top-0.5 left-0.5 transition-all duration-300 ease-in-out z-10 ${
              isEnabled ? 'right-0 border-emerald-500' : 'border-slate-500'
            }`}
            style={isEnabled ? { transform: 'translateX(16px)' } : {}}
          />
          <label
            className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer border transition-colors duration-300 ${
              isEnabled
                ? 'bg-emerald-500 border-white/5'
                : 'bg-slate-700 border-white/5'
            }`}
          />
        </div>
      </div>

      {/* Settings Button (hidden on mobile) */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block">
        <button className="p-1.5 text-slate-400 hover:text-white bg-[#0B0B14] border border-white/10 rounded-md shadow-lg">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};