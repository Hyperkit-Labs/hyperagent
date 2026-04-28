"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { getWorkflow } from "@/lib/api";

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
  networkLabel,
  environment,
  children,
}: OrchestratorRailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [inputValue, setInputValue] = useState("");

  const workflowIdFromPath = pathname?.startsWith("/workflows/")
    ? pathname.split("/")[2] || null
    : null;
  const activeWorkflowId = searchParams.get("workflow") || workflowIdFromPath;
  const { data: workflow } = useSWR(
    activeWorkflowId ? `workflow-${activeWorkflowId}` : null,
    () => getWorkflow(activeWorkflowId!),
  );

  const resolvedRunName =
    activeRunName ||
    workflow?.name ||
    workflow?.intent ||
    (activeWorkflowId ? `Workflow ${activeWorkflowId.slice(0, 8)}` : undefined);
  const resolvedRunStatus: "idle" | "running" | "failed" =
    workflow?.status === "failed"
      ? "failed"
      : workflow?.status === "running" || workflow?.status === "building"
        ? "running"
        : workflow?.status === "completed"
          ? "idle"
          : activeWorkflowId
            ? "running"
            : runStatus;
  const resolvedNetworkLabel =
    networkLabel ||
    workflow?.network ||
    (activeWorkflowId ? "Workflow network unavailable" : "No active network");
  const resolvedEnvironment =
    environment ||
    workflow?.current_stage ||
    (activeWorkflowId ? "Pipeline active" : "No active workflow");

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
              resolvedRunStatus === "running"
                ? "text-emerald-400"
                : resolvedRunStatus === "failed"
                  ? "text-red-400"
                  : "text-slate-500"
            }`}
          >
            {resolvedRunStatus === "running" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            {resolvedRunStatus === "failed" && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            )}
            {resolvedRunStatus}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium truncate">
          {resolvedRunName || "No active workflow"}
        </p>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <span>{resolvedEnvironment}</span>
          <span>•</span>
          <span>{resolvedNetworkLabel}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-2 text-[11px] min-h-0">
        {children}
      </div>

      <div className="border-t border-white/5 px-3 py-2 space-y-2 shrink-0">
        <div className="flex gap-1 text-[11px] flex-wrap">
          {[
            { mode: "Audit", href: ROUTES.SECURITY },
            {
              mode: "Debug",
              href: `${ROUTES.HOME}?q=${encodeURIComponent("Debug the last workflow")}`,
            },
            { mode: "Deploy", href: ROUTES.DEPLOYMENTS },
            { mode: "Create", href: ROUTES.HOME },
          ].map(({ mode, href }) => (
            <button
              key={mode}
              type="button"
              onClick={() => router.push(href)}
              className="px-2 py-1 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
            >
              {mode}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = inputValue.trim();
            if (q) router.push(`${ROUTES.HOME}?q=${encodeURIComponent(q)}`);
            setInputValue("");
          }}
          className="flex items-center gap-2 rounded-xl bg-slate-900/80 px-2 py-1.5 border border-white/5"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
            placeholder="Ask HyperAgent to build, audit, or deploy…"
          />
          <button
            type="submit"
            className="h-7 w-7 rounded-full bg-violet-500 text-xs flex items-center justify-center shadow-lg shadow-violet-500/40 hover:bg-violet-400 transition-colors"
          >
            ↵
          </button>
        </form>
      </div>
    </aside>
  );
}
