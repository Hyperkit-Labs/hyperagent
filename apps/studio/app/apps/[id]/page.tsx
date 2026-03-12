"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { useAppDetailData } from "@/hooks/useAppDetailData";
import { useNetworks } from "@/hooks/useNetworks";
import { prepareDeploymentTransaction, completeDeployment, createQuickDemo, createDebugSandbox } from "@/lib/api";
import { ArrowLeft, FileCode, ExternalLink, Rocket, Loader2, LayoutGrid, GitBranch, Layers, Activity, MessageSquare, Terminal, Bug } from "lucide-react";
import { Shimmer } from "@/components/ai-elements";
import { ROUTES } from "@/constants/routes";
import { FALLBACK_DEFAULT_CHAIN_ID, FALLBACK_DEFAULT_CHAIN_LABEL, getDefaultChainIdFromList } from "@/constants/defaults";
import { getLogs } from "@/lib/api";
import { hasAuditOrSimFailure } from "@/lib/types";

type ContractItem = { bytecode?: string; abi?: unknown; contract_name?: string; [key: string]: unknown };
type DeploymentItem = { contract_address?: string; network?: string; [key: string]: unknown };

type AppTab = "overview" | "workflows" | "deployments" | "activity";

export default function AppDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [tab, setTab] = useState<AppTab>("overview");
  const { networks } = useNetworks();
  const {
    workflow,
    contracts,
    deployments,
    loading,
    error,
    refetch: refetchOverview,
  } = useAppDetailData({
    workflowId: id,
    enabled: !!id,
  });
  const chainOptions = useMemo(
    () =>
      networks
        .filter((n) => n.chain_id != null && n.is_mainnet === false)
        .map((n) => ({ chainId: n.chain_id as number, label: n.name ?? n.id })),
    [networks]
  );
  const initialChainId = getDefaultChainIdFromList(networks);
  const [deployChainId, setDeployChainId] = useState(initialChainId);
  useEffect(() => {
    if (chainOptions.length > 0 && !chainOptions.some((o) => o.chainId === deployChainId)) {
      setDeployChainId(chainOptions[0].chainId);
    }
  }, [chainOptions, deployChainId]);
  const [prepareLoading, setPrepareLoading] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparePayload, setPreparePayload] = useState<unknown>(null);
  const [quickDemoLoading, setQuickDemoLoading] = useState(false);
  const [debugSandboxLoading, setDebugSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<Array<{ timestamp?: string; step_type?: string; status?: string; output_summary?: string; error_message?: string; service?: string; [key: string]: unknown }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);


  useEffect(() => {
    if (tab !== "activity" || !workflow?.workflow_id) return;
    setActivityLoading(true);
    getLogs({ page: 1, page_size: 50 })
      .then((res) => setActivityLogs(res.logs || []))
      .catch(() => setActivityLogs([]))
      .finally(() => setActivityLoading(false));
  }, [tab, workflow?.workflow_id]);

  if (!id) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-[var(--color-semantic-error)]">Missing app ID.</p>
          <Link href={ROUTES.APPS} className="text-[var(--color-primary-light)] text-sm mt-2 inline-block" aria-label="Back to apps">Back to apps</Link>
        </div>
      </div>
    );
  }

  if (loading && !workflow) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-4">
          <Shimmer height="h-8" width="w-48" rounded="md" />
          <Shimmer height="h-4" width="w-full" rounded="sm" />
          <Shimmer height="h-4" width="w-2/3" rounded="sm" />
          <Shimmer height="h-32" width="w-full" rounded="xl" />
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-[var(--color-semantic-error)]">{error ?? "App not found."}</p>
          <Link href={ROUTES.APPS} className="text-[var(--color-primary-light)] text-sm mt-2 inline-block" aria-label="Back to apps">Back to apps</Link>
        </div>
      </div>
    );
  }

  const chatHref = `${ROUTES.CHAT}?appId=${encodeURIComponent(id)}`;

  return (
    <RequireApiSession>
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={ROUTES.APPS}
            className="flex items-center gap-2 text-[var(--color-text-tertiary)] hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Apps
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {contracts.length > 0 && (
              <button
                type="button"
                disabled={quickDemoLoading}
                onClick={async () => {
                  setSandboxError(null);
                  setQuickDemoLoading(true);
                  try {
                    const res = await createQuickDemo(id);
                    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                    else setSandboxError("No sandbox URL returned");
                  } catch (err) {
                    setSandboxError(err instanceof Error ? err.message : "Quick demo failed");
                  } finally {
                    setQuickDemoLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50"
              >
                {quickDemoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Try it Now
              </button>
            )}
            {hasAuditOrSimFailure(workflow) && (
              <button
                type="button"
                disabled={debugSandboxLoading}
                onClick={async () => {
                  setSandboxError(null);
                  setDebugSandboxLoading(true);
                  try {
                    const res = await createDebugSandbox(id);
                    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                    else setSandboxError("No sandbox URL returned");
                  } catch (err) {
                    setSandboxError(err instanceof Error ? err.message : "Debug sandbox failed");
                  } finally {
                    setDebugSandboxLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {debugSandboxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
                Debug in sandbox
              </button>
            )}
            <Link
              href={chatHref}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
            >
              <MessageSquare className="w-4 h-4" />
              Open chat for this app
            </Link>
          </div>
        </div>
        {sandboxError && (
          <p className="text-sm text-[var(--color-semantic-error)]">{sandboxError}</p>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {workflow.name || workflow.intent || "App"}
          </h1>
          <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Workflow: {workflow.workflow_id}</p>
        </div>
        <div className="flex gap-1 border-b border-[var(--color-border-subtle)]">
          {(
            [
              { id: "overview" as const, label: "Overview", icon: LayoutGrid },
              { id: "workflows" as const, label: "Workflows", icon: GitBranch },
              { id: "deployments" as const, label: "Deployments", icon: Layers },
              { id: "activity" as const, label: "Activity", icon: Activity },
            ] as const
          ).map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setTab(tabId)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                tab === tabId
                  ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] border-b-transparent -mb-px"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        {tab === "overview" && (
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileCode className="w-5 h-5 text-[var(--color-semantic-violet)]" />
            <h2 className="font-medium text-white">Contracts & deployments</h2>
          </div>
          {loading && (
            <div className="text-[var(--color-text-tertiary)] text-sm">Loading contracts...</div>
          )}
          {!loading && contracts.length === 0 && deployments.length === 0 && (
            <p className="text-[var(--color-text-tertiary)] text-sm">No contracts or deployments yet. Run the workflow to generate and deploy.</p>
          )}
          {!loading && (contracts.length > 0 || deployments.length > 0) && (
            <ul className="space-y-2 text-sm">
              {contracts.map((c, i) => (
                <li key={i} className="text-[var(--color-text-tertiary)]">
                  {(c as { contract_name?: string }).contract_name ?? `Contract ${i + 1}`}
                  {(c as { bytecode?: string }).bytecode && (
                    <span className="text-[var(--color-text-muted)] ml-2">(bytecode present)</span>
                  )}
                </li>
              ))}
              {deployments.map((d, i) => (
                <li key={i}>
                  <span className="text-[var(--color-text-tertiary)]">{(d as { network?: string }).network ?? "Deployment"}</span>
                  {" "}
                  <span className="font-mono text-[var(--color-text-tertiary)]">{(d as { contract_address?: string }).contract_address ?? "-"}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 pt-6 border-t border-[var(--color-border-default)]">
            <h3 className="font-medium text-white text-sm mb-2">Prepare deployment</h3>
            <p className="text-[var(--color-text-tertiary)] text-xs mb-3">Get deploy payload for the selected chain (testnet).</p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={deployChainId}
                onChange={(e) => { setDeployChainId(Number(e.target.value)); setPreparePayload(null); setPrepareError(null); }}
                className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                {chainOptions.length === 0 && <option value={FALLBACK_DEFAULT_CHAIN_ID}>{FALLBACK_DEFAULT_CHAIN_LABEL} ({FALLBACK_DEFAULT_CHAIN_ID})</option>}
                {chainOptions.map((opt) => (
                  <option key={opt.chainId} value={opt.chainId}>{opt.label} ({opt.chainId})</option>
                ))}
              </select>
              <button
                type="button"
                disabled={prepareLoading}
                onClick={async () => {
                  setPrepareError(null);
                  setPrepareLoading(true);
                  try {
                    const payload = await prepareDeploymentTransaction(workflow.workflow_id, {
                      chainId: deployChainId,
                      mainnet_confirm: false,
                    });
                    setPreparePayload(payload);
                  } catch (e) {
                    setPrepareError(e instanceof Error ? e.message : "Prepare failed");
                  } finally {
                    setPrepareLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium disabled:opacity-60"
              >
                {prepareLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                {prepareLoading ? "Preparing…" : "Prepare deploy"}
              </button>
            </div>
            {prepareError && <p className="text-[var(--color-semantic-error)] text-sm mt-2">{prepareError}</p>}
            {preparePayload ? (
              <div className="mt-3 glass-panel rounded-lg p-4 space-y-3">
                <p className="text-xs text-[var(--color-text-secondary)]">Deploy payload ready. Review and confirm.</p>
                <pre className="text-[10px] text-[var(--color-text-muted)] font-mono bg-[var(--color-bg-base)] rounded p-2 max-h-32 overflow-auto">
                  {JSON.stringify(preparePayload, null, 2).slice(0, 500)}
                </pre>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await completeDeployment(workflow.workflow_id, {
                        chainId: deployChainId,
                        transactionHash: (preparePayload as Record<string, unknown>).transaction_hash as string || "pending",
                        contractAddress: (preparePayload as Record<string, unknown>).contract_address as string || "",
                        walletAddress: "",
                      });
                      setPreparePayload(null);
                      refetchOverview();
                      setTab("deployments");
                    } catch (e) {
                      setPrepareError(e instanceof Error ? e.message : "Complete deploy failed");
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                >
                  Confirm deployment
                </button>
              </div>
            ) : null}
          </div>
          <Link
            href={`${ROUTES.HOME}?workflow=${encodeURIComponent(workflow.workflow_id)}`}
            className="mt-4 inline-flex items-center gap-2 text-[var(--color-semantic-violet)] hover:text-[var(--color-primary-light)] text-sm font-medium"
          >
            View workflow
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        )}
        {tab === "workflows" && (
          <div className="glass-panel rounded-xl p-6">
            <p className="text-sm text-[var(--color-text-tertiary)] mb-4">Workflow for this app.</p>
            <Link
              href={`${ROUTES.HOME}?workflow=${encodeURIComponent(workflow.workflow_id)}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
            >
              Open workflow
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        )}
        {tab === "deployments" && (
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-medium text-white text-sm mb-2">Deployments</h3>
            {deployments.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No deployments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deployments.map((d, i) => (
                  <li key={i}>
                    <span className="text-[var(--color-text-tertiary)]">{(d as { network?: string }).network ?? "Deployment"}</span>
                    {" "}
                    <span className="font-mono text-[var(--color-text-tertiary)]">{(d as { contract_address?: string }).contract_address ?? "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === "activity" && (
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-[var(--color-text-muted)]" />
              <h3 className="font-medium text-white text-sm">Activity log</h3>
            </div>
            {activityLoading ? (
              <div className="text-[var(--color-text-tertiary)] text-sm">Loading activity...</div>
            ) : activityLogs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No activity recorded yet. Run the workflow to generate logs.</p>
            ) : (
              <ul className="space-y-2 text-sm font-mono">
                {activityLogs.map((log, i) => (
                  <li key={i} className="flex items-start gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                    <span className="text-[var(--color-text-muted)] text-xs whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      log.status === "completed" ? "bg-green-900/30 text-green-400" :
                      log.status === "failed" ? "bg-red-900/30 text-red-400" :
                      "bg-blue-900/30 text-blue-400"
                    }`}>{log.status || "info"}</span>
                    <span className="text-[var(--color-text-tertiary)]">{log.step_type || log.service || "system"}</span>
                    <span className="text-[var(--color-text-primary)] flex-1 truncate">{log.output_summary || log.error_message || ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
    </RequireApiSession>
  );
}
