import React, { useState } from 'react';
import Code2 from 'lucide-react/dist/esm/icons/code-2';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';
import TestTube2 from 'lucide-react/dist/esm/icons/test-tube-2';
import Box from 'lucide-react/dist/esm/icons/box';
import Bot from 'lucide-react/dist/esm/icons/bot';
import TerminalSquare from 'lucide-react/dist/esm/icons/terminal-square';
import { Agent } from './AgentsTable';

interface AgentTableRowProps {
  agent: Agent;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'code-2': Code2,
  'shield-alert': ShieldAlert,
  'test-tube-2': TestTube2,
  box: Box,
};

const badgeColors: Record<string, string> = {
  violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  slate: 'border-white/10 text-slate-500',
};

export const AgentTableRow: React.FC<AgentTableRowProps> = ({ agent }) => {
  const [isEnabled, setIsEnabled] = useState(agent.enabled);
  const AgentIcon = iconMap[agent.icon] || Bot;

  const getStatusIndicator = () => {
    switch (agent.status) {
      case 'thinking':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-200">{agent.activity.message}</span>
            </div>
            {agent.activity.detail && (
              <div className="text-[10px] text-slate-500 truncate font-mono bg-black/20 px-1.5 py-0.5 rounded w-fit max-w-full">
                {agent.activity.detail}
              </div>
            )}
          </>
        );
      case 'active':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs text-emerald-400">{agent.activity.message}</span>
            </div>
            <div className="w-full max-w-[140px] h-1 bg-white/10 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 animate-pulse w-[75%]" />
            </div>
          </>
        );
      case 'idle':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span className="text-xs text-slate-400">{agent.activity.message}</span>
            </div>
            {agent.activity.detail && (
              <div className="text-[10px] text-slate-600">{agent.activity.detail}</div>
            )}
          </>
        );
      case 'offline':
        return (
          <>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              <span className="text-xs text-slate-500">{agent.activity.message}</span>
            </div>
            {agent.activity.detail && (
              <div className="text-[10px] text-slate-700">{agent.activity.detail}</div>
            )}
          </>
        );
    }
  };

  const contextPercentage = (agent.contextUsed / agent.contextTotal) * 100;
  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  const rowOpacity = agent.isDisabled ? 'opacity-60 hover:opacity-100' : '';
  const nameColor = agent.isDisabled ? 'text-slate-400' : 'text-white';
  const idColor = agent.isDisabled ? 'text-slate-600' : 'text-slate-500';

  return (
    <div
      className={`group grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors relative ${rowOpacity}`}
    >
      <div className="col-span-5 lg:col-span-4 flex items-center gap-4">
        <div
          className={`w-9 h-9 rounded-lg border border-white/5 bg-gradient-to-br ${
            agent.isDisabled ? 'bg-slate-800 grayscale' : agent.iconGradient
          } flex items-center justify-center shrink-0`}
        >
          <AgentIcon className={`w-5 h-5 ${agent.isDisabled ? 'text-slate-400' : ''}`} />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${nameColor}`}>{agent.name}</span>
            <span
              className={`text-[10px] border rounded px-1.5 py-0.5 ${
                badgeColors[agent.badge.color]
              }`}
            >
              {agent.badge.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-mono ${idColor}`}>id: {agent.agentId}</span>
          </div>
        </div>
      </div>

      <div className="col-span-2 hidden lg:flex items-center">
        <span
          className={`text-xs flex items-center gap-1.5 ${
            agent.isDisabled ? 'text-slate-500' : 'text-slate-300'
          }`}
        >
          <Bot
            className={`w-3 h-3 ${agent.isDisabled ? 'text-slate-600' : 'text-slate-500'}`}
          />
          {agent.model}
        </span>
      </div>

      <div className="col-span-2 hidden lg:flex flex-col justify-center pr-6">
        <div
          className={`flex justify-between text-[10px] mb-1 ${
            agent.isDisabled ? 'text-slate-600' : 'text-slate-500'
          }`}
        >
          <span>Used</span>
          <span>
            {formatNumber(agent.contextUsed)} / {formatNumber(agent.contextTotal)}
          </span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          {agent.contextUsed > 0 && (
            <div
              className={`h-full ${
                agent.status === 'active'
                  ? 'bg-emerald-500/70'
                  : agent.status === 'idle'
                  ? 'bg-blue-500/50'
                  : 'bg-slate-500'
              }`}
              style={{ width: `${contextPercentage}%` }}
            />
          )}
        </div>
      </div>

      <div className="col-span-3 lg:col-span-3 flex flex-col justify-center gap-1.5">
        {getStatusIndicator()}
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

      {/* Terminal Button (hidden on mobile) */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block">
        <button className="p-1.5 text-slate-400 hover:text-white bg-[#0B0B14] border border-white/10 rounded-md shadow-lg">
          <TerminalSquare className="w-4 h-4" />
        </button>
      </div>

      <style jsx>{`
        @keyframes subtle-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};