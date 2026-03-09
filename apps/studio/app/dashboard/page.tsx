"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useConnectModal } from "thirdweb/react";
import { Code, HardDrive, Package, Activity, Info, List, Rocket, GitBranch, ArrowRight, Loader2, ExternalLink, ChevronDown } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { createQuickDemo } from "@/lib/api";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { CONNECT_WALLETS } from "@/lib/connectWallets";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLogs } from "@/hooks/useLogs";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { Terminal } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { MetricCard, StatusBadge, LiveIndicator } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import type { Workflow } from "@/lib/types";

function DashboardCTAs({
  workflows,
  quickDemoLoading,
  onQuickDemo,
}: {
  workflows: Workflow[];
  quickDemoLoading: boolean;
  onQuickDemo: () => Promise<void>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Link
        href={ROUTES.HOME}
        className="px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-xs font-medium transition-all flex items-center gap-2"
      >
        <Rocket className="w-3.5 h-3.5" />
        New workflow
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-1"
        >
          More <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </button>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full mt-1 z-50 py-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shadow-xl min-w-[140px]">
              <button
                type="button"
                onClick={() => { onQuickDemo(); setMoreOpen(false); }}
                disabled={quickDemoLoading || workflows.length === 0}
                title={workflows.length === 0 ? "Create a workflow first" : undefined}
                className="w-full px-3 py-2 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] flex items-center gap-2 disabled:opacity-50"
              >
                {quickDemoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Try demo
              </button>
              <Link
                href={ROUTES.MONITORING}
                onClick={() => setMoreOpen(false)}
                className="block px-3 py-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
              >
                View logs
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const client = getThirdwebClient();
  const [quickDemoLoading, setQuickDemoLoading] = useState(false);
  const [quickDemoError, setQuickDemoError] = useState<string | null>(null);
  const { connect } = useConnectModal();
  const {
    metrics,
    workflows,
    workflowsTotal,
    deployments,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardData({ workflowsLimit: 10 });
  const { logs: liveLogs } = useLogs({ autoRefresh: true, filters: { page_size: 5 } });
  const recentDeployments = deployments.slice(0, 5);
  const apiError = dashboardError;
  const refetchAll = refetchDashboard;
  const barValues = [
    metrics?.workflows?.total ?? 0,
    metrics?.workflows?.completed ?? 0,
    metrics?.workflows?.failed ?? 0,
    deployments.length,
    metrics?.contracts?.deployed ?? 0,
    metrics?.contracts?.verified ?? 0,
  ];
  const maxBar = Math.max(1, ...barValues);
  const sparklineWorkflows = [
    { value: Math.max(0, (metrics?.workflows?.total ?? 0) - 2) },
    { value: Math.max(0, (metrics?.workflows?.completed ?? 0) - 1) },
    { value: metrics?.workflows?.total ?? 0 },
    { value: metrics?.workflows?.completed ?? 0 },
    { value: workflowsTotal ?? workflows?.length ?? 0 },
  ];
  const sparklineDeployments = [
    { value: Math.max(0, deployments.length - 3) },
    { value: Math.max(0, deployments.length - 2) },
    { value: Math.max(0, deployments.length - 1) },
    { value: deployments.length },
    { value: deployments.length },
  ];
  const hasActiveWorkflows = typeof metrics?.workflows?.active === "number" && metrics.workflows.active > 0;
  const terminalLines = liveLogs.length > 0
    ? liveLogs.slice(0, 5).map((entry: { message?: string; level?: string; timestamp?: string }) => ({
        timestamp: entry.timestamp ?? "",
        level: entry.level ?? "info",
        message: entry.message ?? "",
      }))
    : recentDeployments.slice(0, 5).map((d) => ({
        timestamp: "",
        level: "info",
        message: `${d.network ?? "?"} | ${d.status} | ${(d.contractAddress ?? "-").slice(0, 10)}...`,
      }));

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
            const w = workflows.find((w) => w.contracts && Object.keys(w.contracts).length > 0) ?? workflows[0];
            if (!w?.workflow_id) {
              setQuickDemoError("Create a workflow first to try the demo");
              return;
            }
            setQuickDemoLoading(true);
            setQuickDemoError(null);
            try {
              const res = await createQuickDemo(w.workflow_id);
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
            <PageTitle breadcrumb="Projects / Overview" title="Project Overview" />
          </div>
          <DashboardCTAs
            workflows={workflows}
            quickDemoLoading={quickDemoLoading}
            onQuickDemo={async () => {
              const w = workflows.find((w) => w.contracts && Object.keys(w.contracts).length > 0) ?? workflows[0];
              if (!w?.workflow_id) {
                setQuickDemoError("Create a workflow first to try the demo");
                return;
              }
              setQuickDemoLoading(true);
              setQuickDemoError(null);
              try {
                const res = await createQuickDemo(w.workflow_id);
                if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                else setQuickDemoError("No sandbox URL returned");
              } catch (e) {
                setQuickDemoError(e instanceof Error ? e.message : "Quick demo failed");
              } finally {
                setQuickDemoLoading(false);
              }
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Workflows",
              value: dashboardLoading ? "..." : (workflowsTotal ?? workflows?.length ?? 0),
              sublabel: "Total in list",
              icon: <div className="w-2 h-2 rounded-full bg-[var(--color-semantic-success)] shadow-[0_0_8px_var(--color-semantic-success)]" />,
              sparkline: sparklineWorkflows,
            },
            {
              label: "Deployments",
              value: deployments.length,
              sublabel: "Active",
              icon: <Code className="w-4 h-4 text-[var(--color-primary-mid)]" />,
              sparkline: sparklineDeployments,
            },
            {
              label: "Metrics",
              value: dashboardLoading ? "..." : (typeof metrics?.workflows?.total === "number" ? metrics.workflows.total : "-"),
              sublabel: "From API",
              icon: <HardDrive className="w-4 h-4 text-[var(--color-semantic-violet)]" />,
            },
            {
              label: "Status",
              value: hasActiveWorkflows ? "Building" : "Idle",
              sublabel: "Platform",
              icon: <Package className="w-4 h-4 text-[var(--color-semantic-violet)]" />,
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <MetricCard label={card.label} value={card.value} sublabel={card.sublabel} icon={card.icon} sparklineData={"sparkline" in card ? card.sparkline : undefined} />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="glass-panel rounded-xl overflow-hidden relative"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-[var(--color-text-primary)] text-sm">Live Log Stream</h3>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Recent activity from backend (5 most recent)</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {liveLogs.length > 0 && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
              <Link
                href={ROUTES.MONITORING}
                className="text-xs font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-1"
              >
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <Terminal lines={terminalLines} noScroll className="rounded-none border-0" />
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.08 } },
            hidden: {},
          }}
        >
          <motion.div
            className="glass-panel rounded-xl p-5 lg:col-span-1 flex flex-col relative"
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          >
            <LiveIndicator live={hasActiveWorkflows} />
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
          </motion.div>

          <motion.div
            className="glass-panel rounded-xl p-5 lg:col-span-2 flex flex-col h-[320px] relative"
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          >
            <LiveIndicator live={hasActiveWorkflows} />
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
          </motion.div>
        </motion.div>

        <motion.div
          className="glass-panel rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
        >
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
                {dashboardLoading ? (
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
                        <StatusBadge status={d.status} />
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
        </motion.div>
      </div>
    </div>
    </RequireApiSession>
  );
}
