"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { useRouter } from "next/navigation";
import {
  Search,
  List,
  LayoutGrid,
  BrainCircuit,
  ShieldCheck,
  Rocket,
  PenTool,
  Play,
  Pencil,
  FileText,
  Folder,
  X,
} from "lucide-react";
import { useAgents } from "@/hooks/useAgents";
import { useMetrics } from "@/hooks/useMetrics";
import { ROUTES } from "@/constants/routes";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { ShimmerGrid } from "@/components/ai-elements";
import { EmptyState, RadialProgress } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";

type AgentCategory = "all" | "generators" | "auditors" | "deployers";

function agentCategory(name?: string): AgentCategory {
  const n = (name || "").toLowerCase();
  if (n.includes("audit") || n.includes("security") || n.includes("slither"))
    return "auditors";
  if (n.includes("deploy") || n.includes("deployment")) return "deployers";
  return "generators";
}

function agentIcon(name?: string): {
  Icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
} {
  const n = (name || "").toLowerCase();
  if (n.includes("audit") || n.includes("security"))
    return { Icon: ShieldCheck, bgClass: "bg-blue-500/10 border-blue-500/20" };
  if (n.includes("deploy"))
    return { Icon: Rocket, bgClass: "bg-orange-500/10 border-orange-500/20" };
  if (n.includes("frontend") || n.includes("ui"))
    return { Icon: PenTool, bgClass: "bg-pink-500/10 border-pink-500/20" };
  return {
    Icon: BrainCircuit,
    bgClass: "bg-purple-500/10 border-purple-500/20",
  };
}

function categoryLabel(cat: AgentCategory): string {
  if (cat === "generators") return "Generator";
  if (cat === "auditors") return "Auditor";
  if (cat === "deployers") return "Deployer";
  return "Agent";
}

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AgentCategory>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "graph">("list");
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { agents, loading, error, refetch } = useAgents();
  const { metrics } = useMetrics({ timeRange: "7d" });

  const toggleSelectAgent = useCallback((name: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!agents) return;
    if (selectedAgents.size === agents.length) {
      setSelectedAgents(new Set());
    } else {
      setSelectedAgents(new Set(agents.map((a) => a.name ?? "")));
    }
  }, [agents, selectedAgents]);

  const toggleEnabled = useCallback((name: string) => {
    setEnabledMap((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const isEnabled = useCallback(
    (name: string) => (name in enabledMap ? enabledMap[name] : true),
    [enabledMap],
  );

  const filtered = useMemo(() => {
    let list = agents ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => (a.name || "").toLowerCase().includes(q));
    }
    if (category !== "all") {
      list = list.filter((a) => agentCategory(a.name) === category);
    }
    return list;
  }, [agents, search, category]);

  const categories: { id: AgentCategory; label: string }[] = [
    { id: "all", label: "All" },
    { id: "generators", label: "Generators" },
    { id: "auditors", label: "Auditors" },
    { id: "deployers", label: "Deployers" },
  ];

  const selectedAgent = useMemo(
    () =>
      selectedName
        ? filtered.find((a) => (a.name ?? "") === selectedName)
        : null,
    [selectedName, filtered],
  );

  return (
    <RequireApiSession>
      <div className="p-6 lg:p-8 flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0 flex gap-0">
          <div className="flex-1 min-w-0 max-w-5xl mx-auto flex flex-col">
            <div className="flex flex-col gap-6 mb-8 animate-enter">
              <div className="flex justify-between items-end">
                <PageTitle
                  title="HyperAgent Workflows"
                  subtitle="Manage and monitor your autonomous AI agents."
                />
              </div>

              <ApiErrorBanner error={error ?? null} onRetry={refetch} />

              <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2 pr-2 border-r border-[var(--color-border-subtle)]">
                  <input
                    type="checkbox"
                    checked={
                      agents &&
                      agents.length > 0 &&
                      selectedAgents.size === agents.length
                    }
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-primary)] focus:ring-[var(--color-primary-alpha-50)] cursor-pointer"
                    title="Select all"
                  />
                </div>
                <div className="relative w-64 group">
                  <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter agents..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] rounded-lg py-1.5 pl-9 pr-4 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-primary-alpha-50)] focus:ring-1 focus:ring-[var(--color-primary-alpha-20)] transition-all placeholder:text-[var(--color-text-muted)]"
                  />
                </div>
                <div className="h-6 w-px bg-[var(--color-border-subtle)] mx-1" />
                <div className="flex gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        category === c.id
                          ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)]"
                          : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border-transparent"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="List view"
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "list"
                        ? "text-[var(--color-text-primary)] bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Grid view"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "text-[var(--color-text-primary)] bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {loading && !filtered.length && <ShimmerGrid count={6} />}

            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                icon={
                  <BrainCircuit className="w-8 h-8 text-[var(--color-text-muted)]" />
                }
                title={
                  search.trim() ? "No matching agents" : "No agents reported"
                }
                description={
                  search.trim()
                    ? `No agents match "${search.trim()}". Try a different query.`
                    : "Agents appear here after your first pipeline run."
                }
                action={
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/")}
                    className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg"
                  >
                    Create a workflow
                  </button>
                }
              />
            )}

            {!loading && filtered.length > 0 && viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                {filtered.map((agent, i) => {
                  const { Icon, bgClass } = agentIcon(agent.name);
                  const cat = agentCategory(agent.name);
                  const isOk =
                    (agent.status || "").toLowerCase() === "ok" ||
                    (agent.status || "").toLowerCase() === "healthy";
                  return (
                    <div
                      key={agent.name ?? i}
                      className="glass-panel glass-panel-hover p-4 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${bgClass}`}
                        >
                          <Icon className="w-5 h-5 text-current opacity-90" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {agent.name ?? "Agent"}
                            </h3>
                            {isOk && (
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-[var(--color-semantic-success)] shrink-0"
                                title="Healthy"
                              />
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--color-text-tertiary)] px-1.5 py-px rounded bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)]">
                            {categoryLabel(cat)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {agent.status ?? "Unknown"}
                        </span>
                        <button
                          type="button"
                          className="p-2 rounded-md hover:bg-[var(--color-primary-alpha-10)] text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-violet)] transition-colors"
                          title="Run agent"
                          onClick={() =>
                            router.push(
                              `${ROUTES.HOME}?agent=${encodeURIComponent(agent.name ?? "")}`,
                            )
                          }
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && filtered.length > 0 && viewMode === "list" && (
              <div className="flex flex-col gap-3 pb-10">
                {filtered.map((agent, i) => {
                  const { Icon, bgClass } = agentIcon(agent.name);
                  const cat = agentCategory(agent.name);
                  const statusKey = (agent.status || "").toLowerCase();
                  const isOk = statusKey === "ok" || statusKey === "healthy";
                  const enabled = isEnabled(agent.name ?? "");
                  const name = agent.name ?? "Agent";
                  const toggleId = `agent-toggle-${String(agent.name ?? "").replace(/\s/g, "-")}-${i}`;
                  const isSelected = selectedName === (agent.name ?? null);
                  const isChecked = selectedAgents.has(name);
                  const stepIndex =
                    typeof agent.step_index === "number" ? agent.step_index : 0;
                  const progressMap: Record<string, number> = {
                    idle: 100,
                    ok: 100,
                    healthy: 100,
                    running: stepIndex > 0 ? Math.min(90, stepIndex * 15) : 45,
                    busy: 45,
                    failed: 0,
                  };
                  const progress = progressMap[statusKey] ?? (isOk ? 100 : 45);

                  return (
                    <div
                      key={agent.name ?? i}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedName(agent.name ?? null)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setSelectedName(agent.name ?? null)
                      }
                      className={`animate-enter group relative rounded-xl p-4 flex items-center gap-4 transition-all border ${
                        i === 0
                          ? "delay-75"
                          : i === 1
                            ? "delay-100"
                            : i === 2
                              ? "delay-150"
                              : "delay-200"
                      } ${isSelected ? "ring-1 ring-[var(--color-primary-alpha-30)] bg-[var(--color-bg-panel)] border-[var(--color-primary-alpha-20)]" : "glass-panel glass-panel-hover bg-[var(--color-bg-panel)] border-[var(--color-border-subtle)]"}`}
                    >
                      <div
                        className="flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectAgent(name)}
                          className="w-4 h-4 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-primary)] focus:ring-[var(--color-primary-alpha-50)] cursor-pointer"
                        />
                      </div>
                      <div
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${bgClass}`}
                      >
                        <Icon className="w-5 h-5 text-current opacity-90" />
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-12 sm:col-span-4">
                          <div className="flex items-center gap-2">
                            <h3
                              className={`text-sm font-medium ${enabled ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}
                            >
                              {name}
                            </h3>
                            <RadialProgress
                              progress={progress}
                              size={16}
                              strokeWidth={2}
                              color={
                                statusKey === "failed"
                                  ? "var(--color-semantic-error)"
                                  : statusKey === "running" ||
                                      statusKey === "busy"
                                    ? "var(--color-semantic-info)"
                                    : isOk
                                      ? "var(--color-semantic-success)"
                                      : "var(--color-semantic-warning)"
                              }
                            />
                          </div>
                          <div className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`px-1.5 py-px rounded border ${cat === "generators" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : cat === "auditors" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : cat === "deployers" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-[var(--color-primary-alpha-10)] text-[var(--color-semantic-violet)] border-[var(--color-primary-alpha-20)]"}`}
                            >
                              {categoryLabel(cat)}
                            </span>
                            <span>
                              ID: {(agent.name ?? "agt").slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-1">
                            Project
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                            <Folder className="w-3 h-3 text-[var(--color-text-muted)]" />
                            Global
                          </div>
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-1">
                            Last Run
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            -
                          </div>
                        </div>
                        <div className="col-span-12 sm:col-span-2 flex justify-end items-center">
                          <span
                            className={`text-[10px] mr-2 ${enabled ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-muted)]"}`}
                            title="Session toggle"
                          >
                            {enabled ? "Enabled" : "Disabled"}
                          </span>
                          <input
                            type="checkbox"
                            id={toggleId}
                            checked={enabled}
                            onChange={() => toggleEnabled(name)}
                            onClick={(e) => e.stopPropagation()}
                            className="toggle-checkbox"
                            aria-label={
                              enabled
                                ? "Disable agent (session-only)"
                                : "Enable agent (session-only)"
                            }
                            title="Toggle enabled for this session"
                          />
                          <label
                            htmlFor={toggleId}
                            className="toggle-label"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="h-8 w-px bg-[var(--color-border-subtle)] mx-2 shrink-0 hidden sm:block" />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="Run agent"
                          disabled={!enabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `${ROUTES.HOME}?agent=${encodeURIComponent(name)}`,
                            );
                          }}
                          className={`p-2 rounded-md transition-colors ${enabled ? "hover:bg-[var(--color-primary-alpha-10)] text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-violet)]" : "text-[var(--color-text-muted)] cursor-not-allowed opacity-60"}`}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                          title="View details"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedName(name);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <Link
                          href={ROUTES.MONITORING}
                          className="p-2 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                          title="View logs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedAgent && (
            <aside className="hidden xl:flex w-[380px] shrink-0 flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] animate-slide-right">
              <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between bg-[var(--color-bg-panel)]">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center ${agentIcon(selectedAgent.name).bgClass}`}
                  >
                    {(() => {
                      const { Icon } = agentIcon(selectedAgent.name);
                      return (
                        <Icon className="w-4 h-4 text-current opacity-90" />
                      );
                    })()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {selectedAgent.name ?? "Agent"}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      Configuration &amp; History
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedName(null)}
                  className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--color-bg-panel)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1.5">
                      Status
                    </div>
                    <div className="text-xs text-[var(--color-text-primary)] font-medium flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${selectedAgent.status?.toLowerCase() === "healthy" || selectedAgent.status?.toLowerCase() === "ok" ? "bg-[var(--color-semantic-success)]" : "bg-[var(--color-semantic-warning)]"}`}
                      />
                      {selectedAgent.status ?? "Unknown"}
                    </div>
                  </div>
                  <div className="bg-[var(--color-bg-panel)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1.5">
                      Category
                    </div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-[10px] border ${agentCategory(selectedAgent.name) === "generators" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : agentCategory(selectedAgent.name) === "auditors" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : agentCategory(selectedAgent.name) === "deployers" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]"}`}
                    >
                      {categoryLabel(agentCategory(selectedAgent.name))}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3">
                    Execution History (Last 7 Days)
                  </div>
                  <div className="h-24 bg-[var(--color-bg-panel)] rounded-lg border border-[var(--color-border-subtle)] p-3 flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-[var(--color-semantic-success)]">
                        {metrics?.workflows?.completed ?? 0}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        Completed
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-[var(--color-semantic-info)]">
                        {metrics?.workflows?.active ?? 0}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        Active
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-[var(--color-semantic-error)]">
                        {metrics?.workflows?.failed ?? 0}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        Failed
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3 flex items-center justify-between">
                    <span>Configuration</span>
                    <button className="text-[10px] text-[var(--color-primary)] hover:underline">
                      Edit
                    </button>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-3 overflow-x-auto border border-[var(--color-border-subtle)]">
                    <pre className="text-[10px] text-[var(--color-text-secondary)] font-mono leading-relaxed">
                      {JSON.stringify(
                        {
                          model: "gpt-4-turbo-preview",
                          temperature: 0.2,
                          maxTokens: 4096,
                          capabilities: ["solidity", "erc20", "erc721"],
                          tools: ["slither", "mythril"],
                          timeout: "120s",
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center gap-3">
                  <button
                    type="button"
                    className="flex-1 btn-primary-gradient text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" /> Test Agent
                  </button>
                  <Link
                    href={ROUTES.MONITORING}
                    className="flex-1 bg-[var(--color-bg-panel)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-xs px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
                  >
                    View Logs
                  </Link>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </RequireApiSession>
  );
}
