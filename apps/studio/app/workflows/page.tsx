"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, Bug } from "lucide-react";
import {
  Search,
  Activity,
  ArrowDown,
  MoreVertical,
  ArrowRightLeft,
  Image as ImageIcon,
  Landmark,
  Coins,
  Plus,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useWorkflows } from "@/hooks/useWorkflows";
import { cancelWorkflow, createQuickDemo, createDebugSandbox } from "@/lib/api";
import { toast } from "sonner";
import type { Workflow } from "@/lib/types";
import { hasAuditOrSimFailure } from "@/lib/types";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { ShimmerGrid } from "@/components/ai-elements";
import { EmptyState } from "@/components/ui";

function formatUpdatedAt(updated_at?: string): string {
  if (!updated_at) return "Unknown";
  const d = new Date(updated_at);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "Just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

function networkBadgeClass(network?: string): string {
  const n = (network || "").toLowerCase();
  if (n.includes("mantle") || n.includes("hyperion")) return "bg-[var(--color-primary-alpha-10)] text-[var(--color-semantic-violet)] border-[var(--color-primary-alpha-20)]";
  if (n.includes("avax") || n.includes("avalanche")) return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-[#1c1917] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]";
}

function statusBadgeClass(status: string): string {
  const s = status?.toLowerCase() || "";
  if (s === "completed" || s === "deployed" || s === "success") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (s === "failed" || s === "error") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (s === "running" || s === "building") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-[#18181b] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]";
}

function iconForWorkflow(w: Workflow): React.ReactNode {
  const type = (w.contract_type || w.intent || "").toLowerCase();
  if (type.includes("nft") || type.includes("token")) return <ImageIcon className="w-5 h-5 text-pink-400" aria-hidden />;
  if (type.includes("dao") || type.includes("gov")) return <Landmark className="w-5 h-5 text-red-400" aria-hidden />;
  if (type.includes("staking") || type.includes("vault")) return <Coins className="w-5 h-5 text-orange-400" aria-hidden />;
  return <ArrowRightLeft className="w-5 h-5 text-indigo-400" aria-hidden />;
}

function iconBgClass(w: Workflow): string {
  const type = (w.contract_type || w.intent || "").toLowerCase();
  if (type.includes("nft")) return "bg-pink-500/10 border-pink-500/20";
  if (type.includes("dao")) return "bg-red-500/10 border-red-500/20";
  if (type.includes("staking")) return "bg-orange-500/10 border-orange-500/20";
  return "bg-indigo-500/10 border-indigo-500/20";
}

type SortField = "updated_at" | "created_at" | "name";

export default function WorkflowsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "kanban">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [networkFilter, setNetworkFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("updated_at");
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [quickDemoLoading, setQuickDemoLoading] = useState<string | null>(null);
  const [debugSandboxLoading, setDebugSandboxLoading] = useState<string | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { workflows, loading, error, refetch } = useWorkflows({
    filters: { limit: 100, status: statusFilter || undefined },
  });

  const toggleSelectWorkflow = (id: string) => {
    setSelectedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = workflows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (w) =>
          (w.intent || "").toLowerCase().includes(q) ||
          (w.name || "").toLowerCase().includes(q) ||
          (w.workflow_id || "").toLowerCase().includes(q)
      );
    }
    if (networkFilter) {
      list = list.filter((w) => (w.network || "").toLowerCase().includes(networkFilter.toLowerCase()));
    }
    if (typeFilter) {
      list = list.filter((w) => (w.contract_type || w.intent || "").toLowerCase().includes(typeFilter.toLowerCase()));
    }
    return [...list].sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || a.intent || "").localeCompare(b.name || b.intent || "");
      }
      const aDate = new Date(sortBy === "created_at" ? (a.created_at || 0) : (a.updated_at || a.created_at || 0)).getTime();
      const bDate = new Date(sortBy === "created_at" ? (b.created_at || 0) : (b.updated_at || b.created_at || 0)).getTime();
      return bDate - aDate;
    });
  }, [workflows, search, sortBy]);

  return (
    <RequireApiSession>
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto flex flex-col">
        <div className="flex flex-col gap-6 mb-8 animate-enter">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight mb-1">Projects</h1>
              <p className="text-[var(--color-text-tertiary)] text-xs">Manage your dApps, contracts, and deployments.</p>
            </div>
          </div>

          <ApiErrorBanner error={error ?? sandboxError ?? null} onRetry={() => { refetch(); setSandboxError(null); }} />

          <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-[var(--color-border-subtle)] pb-4">
            <div className="relative w-64 group">
              <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] rounded-lg py-1.5 pl-9 pr-4 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-primary-alpha-50)] focus:ring-1 focus:ring-[var(--color-primary-alpha-20)] transition-all placeholder:text-[var(--color-text-muted)]"
              />
            </div>
            <div className="h-6 w-px bg-[var(--color-border-subtle)] mx-1" />
            <div className="relative group flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] text-xs text-[var(--color-text-secondary)] transition-colors"
                aria-label="Filter by status"
              >
                <option value="">Status</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] text-xs text-[var(--color-text-secondary)] transition-colors"
            >
              <option value="">All Networks</option>
              <option value="mantle">Mantle</option>
              <option value="avalanche">Avalanche</option>
              <option value="base">Base</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] text-xs text-[var(--color-text-secondary)] transition-colors"
            >
              <option value="">All Types</option>
              <option value="nft">NFT</option>
              <option value="token">Token</option>
              <option value="dao">DAO / Governance</option>
            </select>
            <div className="flex-1" />
            <div className="flex items-center gap-1 bg-[var(--color-bg-panel)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded text-xs transition-colors ${viewMode === "grid" ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded text-xs transition-colors ${viewMode === "kanban" ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}
              >
                Kanban
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="bg-transparent text-xs font-medium text-[var(--color-text-primary)] border-none focus:ring-0 cursor-pointer"
              >
                <option value="updated_at">Last Active</option>
                <option value="created_at">Created</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
          {selectedWorkflows.size > 0 && (
            <div className="bg-[var(--color-bg-panel)] border border-[var(--color-primary-alpha-30)] rounded-lg p-3 flex items-center justify-between shadow-lg animate-enter">
              <span className="text-xs font-medium">{selectedWorkflows.size} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={async () => {
                    if (!window.confirm(`Cancel ${selectedWorkflows.size} selected workflow(s)? This cannot be undone.`)) return;
                    setBulkLoading(true);
                    let ok = 0;
                    let fail = 0;
                    for (const id of selectedWorkflows) {
                      try { await cancelWorkflow(id); ok++; } catch { fail++; }
                    }
                    setBulkLoading(false);
                    setSelectedWorkflows(new Set());
                    refetch();
                    if (fail) toast.error(`Cancelled ${ok}, failed ${fail}.`);
                    else toast.success(`Cancelled ${ok} workflow(s).`);
                  }}
                  className="text-xs px-3 py-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Cancel Selected
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={async () => {
                    if (!window.confirm(`Re-run ${selectedWorkflows.size} selected workflow(s)?`)) return;
                    setBulkLoading(true);
                    let ok = 0;
                    let fail = 0;
                    for (const id of selectedWorkflows) {
                      const wf = workflows.find(w => w.workflow_id === id);
                      if (!wf?.intent) { fail++; continue; }
                      try {
                        await createQuickDemo(id);
                        ok++;
                      } catch { fail++; }
                    }
                    setBulkLoading(false);
                    setSelectedWorkflows(new Set());
                    refetch();
                    if (fail) toast.error(`Re-ran ${ok}, failed ${fail}.`);
                    else toast.success(`Re-ran ${ok} workflow(s).`);
                  }}
                  className="text-xs px-3 py-1.5 bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded border border-[var(--color-border-subtle)] disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Re-run Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && !filtered.length && <ShimmerGrid count={6} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<ArrowRightLeft className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title={search.trim() ? "No matching projects" : "No projects yet"}
            description={search.trim() ? `No projects match "${search.trim()}". Try a different search or clear the filter.` : "Create your first project from the chat. Describe your smart contract and we will generate it."}
            suggestions={search.trim() ? undefined : ["Deploy an ERC20 token", "Create a simple NFT contract"]}
            action={
              <Link
                href={ROUTES.CHAT}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project
              </Link>
            }
          />
        )}

        {!loading && filtered.length > 0 ? (
          <div className="space-y-4">
            {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
              {filtered.map((w, i) => {
                const isSelected = selectedWorkflows.has(w.workflow_id);
                const wRecord = w as unknown as Record<string, unknown>;
                const stages = wRecord.stages
                  ? (wRecord.stages as { stage: string }[]).map(s => s.stage)
                  : ["spec", "design", "codegen", "audit", "deploy"];
                const completedStages = wRecord.stages
                  ? (wRecord.stages as { stage: string; status: string }[]).filter(s => s.status === "completed").length
                  : (w.status === "completed" || w.status === "success" || w.status === "deployed" ? stages.length : 0);
                const sIndex = completedStages;
                
                return (
                <div
                  key={w.workflow_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedWorkflow(w)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedWorkflow(w)}
                  className={`animate-enter relative group cursor-pointer ${i === 0 ? "delay-75" : i === 1 ? "delay-100" : i === 2 ? "delay-150" : "delay-200"} ${selectedWorkflow?.workflow_id === w.workflow_id ? "ring-2 ring-[var(--color-primary-alpha-50)] rounded-xl" : ""}`}
                >
                  <div className={`glass-panel glass-panel-hover p-5 rounded-xl flex flex-col h-full transition-all ${isSelected ? 'border-[var(--color-primary)] bg-[var(--color-primary-alpha-10)]' : ''}`}>
                    <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectWorkflow(w.workflow_id)}
                        className="w-4 h-4 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-primary)] focus:ring-[var(--color-primary-alpha-50)] cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-start mb-4 pr-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${iconBgClass(w)}`}>
                          {iconForWorkflow(w)}
                        </div>
                        <div>
                          <motion.h3
                            layoutId={`workflow-title-${w.workflow_id}`}
                            className="text-sm font-semibold text-[var(--color-text-primary)] truncate max-w-[140px]"
                          >
                            {w.intent?.slice(0, 32) || w.name || "Untitled"}
                            {(w.intent?.length || 0) > 32 ? "..." : ""}
                          </motion.h3>
                          <div className="text-[10px] text-[var(--color-text-tertiary)]">{formatUpdatedAt(w.updated_at)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1.5 border ${networkBadgeClass(w.network)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                        {w.network || "Default"}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1.5 border ${statusBadgeClass(w.status || "")}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                        {w.status || "Unknown"}
                      </span>
                    </div>
                    
                    <div className="mb-4 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded-lg p-2">
                      <div className="flex justify-between text-[9px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">
                        <span>Pipeline Progress</span>
                        <span>{sIndex}/5 Stages</span>
                      </div>
                      <div className="flex gap-1">
                        {stages.map((_, idx) => (
                          <div key={idx} className={`h-1.5 flex-1 rounded-full ${idx < sIndex ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-bg-hover)]'}`} />
                        ))}
                      </div>
                    </div>

                    <div className="mb-4 bg-[#0d1117] rounded border border-[var(--color-border-subtle)] p-2 overflow-hidden h-16 relative">
                      <div className="text-[8px] font-mono text-[var(--color-text-secondary)] whitespace-pre opacity-70">
                        {`// Code preview
contract ${w.name?.replace(/\s/g, "") || "MyContract"} {
  uint256 public count;
  function update() external {}
}`}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none" />
                    </div>

                    <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setSandboxError(null);
                            setQuickDemoLoading(w.workflow_id);
                            try {
                              const res = await createQuickDemo(w.workflow_id);
                              if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                              else setSandboxError("No sandbox URL returned");
                            } catch (err) {
                              setSandboxError(err instanceof Error ? err.message : "Quick demo failed");
                            } finally {
                              setQuickDemoLoading(null);
                            }
                          }}
                          disabled={quickDemoLoading !== null}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[var(--color-border-subtle)] text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                          title="Try in sandbox"
                        >
                          {quickDemoLoading === w.workflow_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                          Try it Now
                        </button>
                        {hasAuditOrSimFailure(w) && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSandboxError(null);
                              setDebugSandboxLoading(w.workflow_id);
                              try {
                                const res = await createDebugSandbox(w.workflow_id);
                                if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                                else setSandboxError("No sandbox URL returned");
                              } catch (err) {
                                setSandboxError(err instanceof Error ? err.message : "Debug sandbox failed");
                              } finally {
                                setDebugSandboxLoading(null);
                              }
                            }}
                            disabled={debugSandboxLoading !== null}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-amber-500/30 text-[10px] font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                            title="Debug in sandbox"
                          >
                            {debugSandboxLoading === w.workflow_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bug className="w-3 h-3" />}
                            Debug sandbox
                          </button>
                        )}
                      </div>
                      <Link
                        href={ROUTES.WORKFLOW_ID(w.workflow_id)}
                        className="btn-primary-gradient px-4 py-1.5 rounded-full text-xs font-medium text-white transition-all hover:scale-105 w-fit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open in Studio
                      </Link>
                    </div>
                  </div>
                </div>
              )})}
            </div>
            )}
            
            {viewMode === "kanban" && (
              <div className="flex gap-4 overflow-x-auto pb-6">
                {["pending", "running", "completed", "failed"].map(statusGroup => {
                  const statusWorkflows = filtered.filter(w => {
                    const s = (w.status || "").toLowerCase();
                    if (statusGroup === "completed") return s === "completed" || s === "success" || s === "deployed";
                    if (statusGroup === "running") return s === "running" || s === "building";
                    if (statusGroup === "failed") return s === "failed" || s === "error";
                    return s === "pending" || s === "created" || !s;
                  });
                  return (
                    <div key={statusGroup} className="w-80 shrink-0 bg-[var(--color-bg-base)] rounded-xl border border-[var(--color-border-subtle)] p-4 flex flex-col h-[600px]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-medium text-[var(--color-text-primary)] uppercase tracking-wider capitalize">{statusGroup}</h3>
                        <span className="text-[10px] bg-[var(--color-bg-panel)] px-2 py-0.5 rounded-full text-[var(--color-text-muted)]">{statusWorkflows.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {statusWorkflows.map(w => (
                          <div key={w.workflow_id} className="glass-panel p-3 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-primary-alpha-50)] cursor-pointer transition-colors" onClick={() => router.push(ROUTES.WORKFLOW_ID(w.workflow_id))}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-[var(--color-text-primary)] truncate block w-full">{w.name || w.intent?.slice(0, 20) || "Untitled"}</span>
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)] flex items-center justify-between">
                              <span>{formatUpdatedAt(w.updated_at)}</span>
                              <span className={`px-1.5 py-0.5 rounded border ${networkBadgeClass(w.network)}`}>
                                {w.network || "Default"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Link href={ROUTES.CHAT} className="animate-enter delay-200 cursor-pointer block">
              <div className="h-full min-h-[200px] border border-dashed border-[var(--color-border-subtle)] rounded-xl flex flex-col items-center justify-center p-6 hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border-default)] transition-all">
                <div className="w-12 h-12 rounded-full bg-[var(--color-bg-panel)] flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-[var(--color-text-muted)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-muted)]">Create Project</span>
              </div>
            </Link>
          </div>
        ) : null}
      </div>
      </div>
    </div>
    </RequireApiSession>
  );
}
