"use client";

import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { useDeployments } from "@/hooks/useDeployments";
import { Rocket } from "lucide-react";
import { ShimmerTableRows } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { DataTable, EmptyState, MetricCard, StatusBadge } from "@/components/ui";

export default function DeploymentsPage() {
  const { deployments, stats, loading, error, refetch } = useDeployments();

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <ApiErrorBanner error={error} onRetry={refetch} />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">Deployments</h1>
            <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Track deployment status and contract addresses.</p>
          </div>
          <Link
            href={ROUTES.HOME}
            className="px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-xs font-medium transition-all flex items-center gap-2 w-fit"
          >
            <Rocket className="w-3.5 h-3.5" />
            New deployment
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total" value={stats.total} sublabel="" />
          <MetricCard label="Success" value={stats.successful} sublabel="" />
          <MetricCard label="Failed" value={stats.failed} sublabel="" />
          <MetricCard label="Success rate" value={`${stats.successRate}%`} sublabel="" />
        </div>

        <div>
          <h3 className="font-medium text-[var(--color-text-primary)] text-sm mb-3">All deployments</h3>
          <DataTable
            headers={["Workflow", "Network", "Status", "Contract"]}
            isEmpty={!loading && deployments.length === 0}
            isLoading={loading && deployments.length === 0}
            loading={<ShimmerTableRows rows={5} cols={4} />}
            empty={
              <EmptyState
                icon={<Rocket className="w-8 h-8 text-[var(--color-text-muted)]" />}
                title="No deployments yet"
                description="Deploy a workflow to see deployments here."
                action={
                  <Link href={ROUTES.HOME} className="px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-xs font-medium">
                    New deployment
                  </Link>
                }
              />
            }
          >
            {deployments.map((d) => (
              <tr key={d.id} className="group hover:bg-[var(--color-bg-panel)] transition-colors">
                <td className="px-6 py-4">
                  <Link href={`${ROUTES.HOME}?workflow=${encodeURIComponent(d.workflowId)}`} className="text-[var(--color-text-primary)] hover:text-[var(--color-primary-light)] font-medium">
                    {d.workflowId}
                  </Link>
                </td>
                <td className="px-6 py-4 text-[var(--color-text-tertiary)]">{d.network ?? "-"}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-[var(--color-text-tertiary)] truncate max-w-[140px]">
                  {d.contractAddress ?? "-"}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      </div>
    </div>
  );
}
