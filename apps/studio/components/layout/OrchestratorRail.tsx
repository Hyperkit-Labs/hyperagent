"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface OrchestratorRailProps {
  /** Whether the rail is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Optional active workflow name */
  activeRunName?: string;
  /** Run status */
  runStatus?: "idle" | "running" | "failed";
  /** Current network */
  networkLabel?: string;
  /** Environment label */
  environment?: string;
  /** Quick mode pills */
  children?: React.ReactNode;
}

export function OrchestratorRail({
  collapsed = false,
  onCollapsedChange,
  activeRunName,
  runStatus = "idle",
  networkLabel = "skale-base-sepolia",
  environment = "Firecracker VM",
  children,
}: OrchestratorRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const handleToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapsedChange?.(next);
  };

  if (isCollapsed) {
    return (
      <aside className="w-12 border-l border-white/5 bg-slate-950/70 backdrop-blur-md flex flex-col shrink-0">
        <button
          type="button"
          onClick={handleToggle}
          className="h-14 flex items-center justify-center border-b border-white/5 hover:bg-white/5 transition-colors text-slate-400 hover:text-slate-100"
          title="Expand Orchestrator"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <span className="text-[10px] font-medium text-slate-500 -rotate-90 whitespace-nowrap mt-8">
            Orchestrator
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[360px] border-l border-white/5 bg-slate-950/70 backdrop-blur-md flex flex-col shrink-0">
      <div className="flex items-center justify-between h-12 px-3 border-b border-white/5 shrink-0">
        <span className="text-xs font-medium text-slate-400">Orchestrator</span>
        <button
          type="button"
          onClick={handleToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
          title="Collapse Orchestrator"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="border-b border-white/5 px-3 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Current workflow</span>
          <span
            className={`text-[11px] flex items-center gap-1 ${
              runStatus === "running"
                ? "text-emerald-400"
                : runStatus === "failed"
                  ? "text-red-400"
                  : "text-slate-500"
            }`}
          >
            {runStatus === "running" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            {runStatus === "failed" && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            )}
            {runStatus}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium truncate">
          {activeRunName || "No active run"}
        </p>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <span>{environment}</span>
          <span>•</span>
          <span>{networkLabel}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-2 text-[11px] min-h-0">
        {children}
      </div>

      <div className="border-t border-white/5 px-3 py-2 space-y-2 shrink-0">
        <div className="flex gap-1 text-[11px] flex-wrap">
          {["Audit", "Debug", "Deploy", "Create"].map((mode) => (
            <button
              key={mode}
              type="button"
              className="px-2 py-1 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 px-2 py-1.5 border border-white/5">
          <input
            type="text"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
            placeholder="Ask HyperAgent to build, audit, or deploy…"
          />
          <button
            type="button"
            className="h-7 w-7 rounded-full bg-violet-500 text-xs flex items-center justify-center shadow-lg shadow-violet-500/40 hover:bg-violet-400 transition-colors"
          >
            ↵
          </button>
        </div>
      </div>
    </aside>
  );
}
