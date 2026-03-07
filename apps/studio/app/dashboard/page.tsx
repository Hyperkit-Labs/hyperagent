"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConnectModal } from "thirdweb/react";
import { Code, HardDrive, Package, Activity, Info, List, Rocket, GitBranch, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { createQuickDemo } from "@/lib/api";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { CONNECT_WALLETS } from "@/lib/connectWallets";
import { useMetrics } from "@/hooks/useMetrics";
import { useWorkflows } from "@/hooks/useWorkflows";
import { useDeployments } from "@/hooks/useDeployments";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { MetricCard } from "@/components/ui";
import { RequireApiSession } from "@/components/auth/RequireApiSession";

export default function DashboardPage() {
  const router = useRouter();
  const client = getThirdwebClient();
  const [quickDemoLoading, setQuickDemoLoading] = useState(false);
  const [quickDemoError, setQuickDemoError] = useState<string | null>(null);
  const { connect } = useConnectModal();
  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useMetrics();
  const { workflows, total: workflowsTotal, loading: workflowsLoading, error: workflowsError, refetch: refetchWorkflows } = useWorkflows({ filters: { limit: 10 } });
  const { deployments, loading: deploymentsLoading, error: deploymentsError, refetch: refetchDeployments } = useDeployments();
  const recentDeployments = deployments.slice(0, 5);
  const apiError = metricsError || workflowsError || deploymentsError;
  const refetchAll = () => {
    refetchMetrics();
    refetchWorkflows();
    refetchDeployments();
  };
  const barValues = [
    metrics?.workflows?.total ?? 0,
    metrics?.workflows?.completed ?? 0,
    metrics?.workflows?.failed ?? 0,
    deployments.length,
    metrics?.contracts?.deployed ?? 0,
    metrics?.contracts?.verified ?? 0,
  ];
  const maxBar = Math.max(1, ...barValues);

  return (
    <RequireApiSession title="Sign in to view dashboard" description="Sign in with your wallet to see workflows, deployments, and metrics.">
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <ApiErrorBanner error={apiError ?? quickDemoError ?? null} onRetry={() => { refetchAll(); setQuickDemoError(null); }} />
        <OnboardingChecklist
          onConnectClick={() => { if (client) void connect({ client, wallets: CONNECT_WALLETS }); }}
          onByokClick={() => router.push(ROUTES.SETTINGS)}
          onPaymentClick={() => router.push(ROUTES.PAYMENTS)}
          onTryItNowClick={async () => {
            setQuickDemoLoading(true);
            setQuickDemoError(null);
            try {
              const res = await createQuickDemo();
              if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
              else setQuickDemoError("No sandbox URL returned");
            } catch (e) {
              setQuickDemoError(e instanceof Error ? e.message : "Quick demo failed");
            } finally {
              setQuickDemoLoading(false);
            }
          }}
        />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[var(--color-text-tertiary)] text-sm">Projects /</span>
              <span className="text-[var(--color-text-primary)] font-medium text-sm">Overview</span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">Project Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setQuickDemoLoading(true);
                setQuickDemoError(null);
                try {
                  const res = await createQuickDemo();
                  if (res.url) {
                    window.open(res.url, "_blank", "noopener,noreferrer");
                  } else {
                    setQuickDemoError("No sandbox URL returned");
                  }
                } catch (e) {
                  setQuickDemoError(e instanceof Error ? e.message : "Quick demo failed");
                } finally {
                  setQuickDemoLoading(false);
                }
              }}
              disabled={quickDemoLoading}
              className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {quickDemoLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              Try it Now
            </button>
            <Link
              href={ROUTES.CHAT}
              className="px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-xs font-medium transition-all flex items-center gap-2"
            >
              <Activity className="w-3.5 h-3.5" />
              New from idea
            </Link>
            <Link
              href={ROUTES.MONITORING}
              className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] text-xs font-medium transition-colors"
            >
              View Logs
            </Link>
            <Link
              href={ROUTES.HOME}
              className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] text-xs font-medium transition-all flex items-center gap-2"
            >
              <Rocket className="w-3.5 h-3.5" />
              New workflow
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Workflows"
            value={workflowsLoading ? "..." : (workflowsTotal ?? workflows?.length ?? 0)}
            sublabel="Total in list"
            icon={<div className="w-2 h-2 rounded-full bg-[var(--color-semantic-success)] shadow-[0_0_8px_var(--color-semantic-success)]" />}
          />
          <MetricCard
            label="Deployments"
            value={deployments.length}
            sublabel="Active"
            icon={<Code className="w-4 h-4 text-[var(--color-primary-mid)]" />}
          />
          <MetricCard
            label="Metrics"
            value={metricsLoading ? "..." : (typeof metrics?.workflows?.total === "number" ? metrics.workflows.total : "-")}
            sublabel="From API"
            icon={<HardDrive className="w-4 h-4 text-[var(--color-semantic-violet)]" />}
          />
          <MetricCard
            label="Status"
            value={typeof metrics?.workflows?.active === "number" && metrics.workflows.active > 0 ? "Building" : "Idle"}
            sublabel="Platform"
            icon={<Package className="w-4 h-4 text-[var(--color-semantic-violet)]" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel rounded-xl p-5 lg:col-span-1 animate-enter delay-100 flex flex-col">
            <h3 className="font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-[var(--color-primary)]" />
              Project Details
            </h3>
            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-tertiary)] text-xs">Workflows</span>
                <span className="text-[var(--color-text-primary)] text-xs font-medium">{workflows?.length ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                <span className="text-[var(--color-text-tertiary)] text-xs">Deployments</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-primary-alpha-10)] text-[var(--color-primary-light)] border border-[var(--color-primary-alpha-20)]">
                  {deployments.length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--color-text-tertiary)] text-xs">Mode</span>
                <span className="text-[var(--color-text-primary)] text-xs font-medium">Dashboard</span>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 lg:col-span-2 animate-enter delay-100 flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                Traffic Overview
              </h3>
            </div>
            <div className="flex-1 relative flex items-end justify-between gap-2 px-2">
              {barValues.map((val, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[var(--color-border-subtle)] rounded-t chart-bar min-w-0"
                  style={{ height: `${Math.round((val / maxBar) * 100)}%` }}
                  title={`${val}`}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-3 px-1 text-[10px] text-[var(--color-text-dim)]">
              {["Workflows", "Completed", "Failed", "Deployments", "Contracts", "Verified"].map((label) => (
                <span key={label} className="flex-1 min-w-0 text-center truncate" title={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden animate-enter delay-200">
          <div className="p-5 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <h3 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm">
              <List className="w-4 h-4 text-[var(--color-primary)]" />
              Recent Deployments
            </h3>
            <Link
              href={ROUTES.DEPLOYMENTS}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-xs flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-bg-surface)]/50 border-b border-[var(--color-border-subtle)]">
                  <th className="px-6 py-3 font-medium">Network</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Contract</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[var(--color-border-subtle)]">
                {deploymentsLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                      Loading deployments...
                    </td>
                  </tr>
                ) : recentDeployments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-[var(--color-text-tertiary)]">
                      No deployments yet.
                    </td>
                  </tr>
                ) : (
                  recentDeployments.map((d) => (
                    <tr key={d.id} className="group hover:bg-[var(--color-bg-panel)] transition-colors">
                      <td className="px-6 py-4 font-mono text-[var(--color-text-secondary)] flex items-center gap-2">
                        <GitBranch className="w-3 h-3 text-[var(--color-text-dim)]" /> {d.network ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                          <div className="w-1 h-1 rounded-full bg-emerald-400" /> {d.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-text-tertiary)] font-mono text-[10px] truncate max-w-[120px]">
                        {d.contractAddress ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </RequireApiSession>
  );
}
