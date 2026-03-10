"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Link from "next/link";
import { useConnectModal } from "thirdweb/react";
import { Code, HardDrive, Package, Activity, Info, List, Rocket, GitBranch, ArrowRight, Loader2, ExternalLink, ChevronDown, FileCode, Shield, MessageSquare, CheckCircle, PlayCircle } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { createQuickDemo } from "@/lib/api";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { CONNECT_WALLETS } from "@/lib/connectWallets";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLogs } from "@/hooks/useLogs";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { Terminal } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { MetricCard, StatusBadge, LiveIndicator, GlowingBorder, FlickeringGrid } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { AnimatePresence } from "framer-motion";
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
  const trafficData = [
    { name: "Workflows", value: metrics?.workflows?.total ?? 0 },
    { name: "Completed", value: metrics?.workflows?.completed ?? 0 },
    { name: "Failed", value: metrics?.workflows?.failed ?? 0 },
    { name: "Deployments", value: deployments.length },
    { name: "Contracts", value: metrics?.contracts?.deployed ?? 0 },
    { name: "Verified", value: metrics?.contracts?.verified ?? 0 },
  ];
  const maxBar = Math.max(1, ...trafficData.map((d) => d.value));
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
      <div className="relative min-h-screen bg-[var(--color-bg-base)]">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" aria-hidden>
          <FlickeringGrid color="rgba(124, 58, 237, 1)" maxOpacity={1} flickerChance={0.1} squareSize={3} gridGap={6} />
        </div>
        <div className="relative z-10 p-6 lg:p-8">
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
              animateValue: !dashboardLoading && typeof (workflowsTotal ?? workflows?.length ?? 0) === "number",
              trend: (workflowsTotal ?? 0) > 0 ? "up" as const : undefined,
            },
            {
              label: "Deployments",
              value: deployments.length,
              sublabel: "Active",
              icon: <Code className="w-4 h-4 text-[var(--color-primary-mid)]" />,
              sparkline: sparklineDeployments,
              animateValue: true,
              trend: deployments.length > 0 ? "up" as const : undefined,
            },
            {
              label: "Metrics",
              value: dashboardLoading ? "..." : (typeof metrics?.workflows?.total === "number" ? metrics.workflows.total : "-"),
              sublabel: "From API",
              icon: <HardDrive className="w-4 h-4 text-[var(--color-semantic-violet)]" />,
              animateValue: !dashboardLoading && typeof metrics?.workflows?.total === "number",
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
              <MetricCard
                label={card.label}
                value={card.value}
                sublabel={card.sublabel}
                icon={card.icon}
                sparklineData={"sparkline" in card ? card.sparkline : undefined}
                trend={"trend" in card ? card.trend : undefined}
                animateValue={"animateValue" in card ? card.animateValue : undefined}
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex flex-wrap gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <Link
            href={ROUTES.HOME}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary-alpha-30)] hover:text-[var(--color-text-primary)] transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-10)] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Rocket className="w-3.5 h-3.5 group-hover:text-[var(--color-primary-light)] transition-colors" />
            New Workflow
          </Link>
          <Link
            href={ROUTES.CONTRACTS}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary-alpha-30)] hover:text-[var(--color-text-primary)] transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-10)] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 delay-75" />
            <FileCode className="w-3.5 h-3.5 group-hover:text-[var(--color-primary-light)] transition-colors" />
            View Contracts
          </Link>
          <Link
            href={ROUTES.SECURITY}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary-alpha-30)] hover:text-[var(--color-text-primary)] transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-10)] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 delay-150" />
            <Shield className="w-3.5 h-3.5 group-hover:text-[var(--color-primary-light)] transition-colors" />
            Check Security
          </Link>
          <Link
            href={ROUTES.HOME}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary-alpha-30)] hover:text-[var(--color-text-primary)] transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-primary-alpha-10)] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 delay-200" />
            <MessageSquare className="w-3.5 h-3.5 group-hover:text-[var(--color-primary-light)] transition-colors" />
            Open Chat
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <GlowingBorder active={liveLogs.length > 0} className="glass-panel rounded-xl overflow-hidden relative border-0">
            <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)] text-sm">Live Log Stream</h3>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Recent activity from backend (5 most recent)</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {liveLogs.length > 0 && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium animate-pulse-subtle">
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
            <Terminal lines={terminalLines} noScroll className="rounded-none border-0 bg-transparent" />
          </GlowingBorder>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                Traffic Overview
              </h3>
            </div>
            <div className="flex-1 min-h-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary-mid)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-bg-panel)", border: "1px solid var(--color-border-subtle)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--color-text-primary)" }}
                    formatter={(val: number | undefined) => [val ?? 0, "Count"]}
                  />
                  <Bar dataKey="value" fill="url(#barGrad)" radius={[4, 4, 0, 0]}>
                    {trafficData.map((_, i) => (
                      <Cell key={i} className="chart-bar" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.18 }}
        >
          <div className="glass-panel rounded-xl p-5 lg:col-span-1">
            <h3 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm mb-4">
              <Activity className="w-4 h-4 text-[var(--color-primary)]" />
              Activity Timeline
            </h3>
            <div className="space-y-0 relative overflow-hidden">
              <AnimatePresence initial={false}>
              {[
                ...recentDeployments.slice(0, 3).map((d) => ({
                  type: "deploy" as const,
                  label: `Contract deployed`,
                  detail: `${d.network ?? "?"} · ${(d.contractAddress ?? "-").slice(0, 8)}...`,
                  icon: CheckCircle,
                })),
                ...workflows.slice(0, 2).map((w) => ({
                  type: "workflow" as const,
                  label: "Workflow started",
                  detail: w.intent?.slice(0, 30) ?? w.workflow_id?.slice(0, 8) ?? "-",
                  icon: PlayCircle,
                })),
              ]
                .slice(0, 5)
                .map((ev, i) => {
                  const Icon = ev.icon;
                  return (
                    <motion.div 
                      key={`${ev.type}-${ev.detail}-${i}`}
                      initial={{ height: 0, opacity: 0, scale: 0.95 }}
                      animate={{ height: "auto", opacity: 1, scale: 1 }}
                      exit={{ height: 0, opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      className="flex gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-0 overflow-hidden"
                    >
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary-alpha-15)] flex items-center justify-center mt-1">
                        <Icon className="w-3 h-3 text-[var(--color-primary-light)]" />
                      </div>
                      <div className="min-w-0 py-1">
                        <p className="text-xs font-medium text-[var(--color-text-primary)]">{ev.label}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate">{ev.detail}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {recentDeployments.length === 0 && workflows.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] py-4">No recent activity</p>
              )}
            </div>
          </div>
          <div className="glass-panel rounded-xl overflow-hidden lg:col-span-2">
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
          </div>
        </motion.div>
          </div>
        </div>
      </div>
    </RequireApiSession>
  );
}
