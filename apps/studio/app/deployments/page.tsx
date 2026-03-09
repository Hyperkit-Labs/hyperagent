"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { useDeployments } from "@/hooks/useDeployments";
import { Rocket } from "lucide-react";
import { ShimmerTableRows } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { EmptyState, MetricCard, StatusBadge } from "@/components/ui";
import { DeploymentDetails } from "./DeploymentDetails";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "success" | "failed" | "pending";

export default function DeploymentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { deployments, stats, loading, error, refetch } = useDeployments({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const selectedDeployment = selectedId
    ? deployments.find((d) => d.id === selectedId)
    : null;

  return (
    <div className="h-full flex flex-col p-4 lg:p-6">
      <ApiErrorBanner error={error} onRetry={refetch} />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Deployments</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            Track deployment status and contract addresses.
          </p>
        </div>
        <Link
          href={ROUTES.HOME}
          className="px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-xs font-medium transition-all flex items-center gap-2 w-fit"
        >
          <Rocket className="w-3.5 h-3.5" />
          New deployment
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Total" value={stats.total} sublabel="" />
        <MetricCard label="Success" value={stats.successful} sublabel="" />
        <MetricCard label="Failed" value={stats.failed} sublabel="" />
        <MetricCard label="Success rate" value={`${stats.successRate}%`} sublabel="" />
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        <section className="w-[40%] min-w-[240px] flex flex-col rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md overflow-hidden">
          <header className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
            <h2 className="text-sm font-medium text-slate-100">All deployments</h2>
            <div className="flex gap-1 text-[11px]">
              {(["all", "success", "failed", "pending"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "px-2 py-1 rounded-full capitalize transition-colors",
                    statusFilter === f
                      ? "bg-violet-500/20 text-violet-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </header>
          <div className="flex-1 overflow-auto min-h-0">
            {loading && deployments.length === 0 ? (
              <div className="p-4">
                <ShimmerTableRows rows={5} cols={1} />
              </div>
            ) : deployments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Rocket className="w-8 h-8 text-slate-500 mb-3" />
                <p className="text-sm text-slate-400">No deployments yet</p>
                <p className="text-xs text-slate-500 mt-1">Deploy a workflow to see deployments here.</p>
                <Link
                  href={ROUTES.HOME}
                  className="mt-4 px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-xs font-medium"
                >
                  New deployment
                </Link>
              </div>
            ) : (
              <div className="text-xs">
                {deployments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 border-l-2 border-transparent text-left transition-colors",
                      selectedId === d.id && "border-violet-500 bg-violet-500/5",
                      "hover:bg-white/5"
                    )}
                  >
                    <span className="truncate text-slate-100 flex-1 min-w-0">
                      {d.workflowId}
                    </span>
                    <span className="ml-auto flex items-center gap-2 shrink-0">
                      <StatusBadge status={d.status} />
                      <span className="text-slate-500">{d.network ?? "-"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex-1 flex flex-col rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md overflow-hidden min-w-0">
          {selectedDeployment ? (
            <DeploymentDetails deployment={selectedDeployment} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500 px-6">
              Select a deployment to inspect logs, contracts, and actions.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
