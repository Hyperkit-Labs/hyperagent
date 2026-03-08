"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, Folder, Key, Plug, ExternalLink, DollarSign, CreditCard, Zap } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { LLMKeysCard } from "@/components/settings/LLMKeysCard";
import { SpendingControlCard } from "@/components/settings/SpendingControlCard";
import { CreditsCard } from "@/components/settings/CreditsCard";
import { isFeatureEnabled } from "@/config/environment";
import { useConfig } from "@/components/providers/ConfigProvider";
import { useNetworks } from "@/hooks/useNetworks";
import { usePlanData } from "@/hooks/usePlanData";
import { useSettingsX402Data } from "@/hooks/useSettingsX402Data";
import { PageTitle } from "@/components/layout/PageTitle";

type SettingsTab = "workspace" | "byok" | "x402" | "integrations" | "plan";

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("byok");
  const x402Enabled = isFeatureEnabled("x402");
  const { config, loading: configLoading } = useConfig();
  const { networks, loading: networksLoading, error: networksError, refetch: refetchNetworks } = useNetworks();
  const [defaultNetwork, setDefaultNetwork] = useState<string>("");
  const {
    plans,
    resources,
    usage,
    loading: planLoading,
    error: planError,
    refetch: refetchPlan,
  } = usePlanData({ enabled: tab === "plan" });
  const {
    balance: x402Balance,
    control: x402Control,
    loading: x402Loading,
    error: x402Error,
    refetch: refetchX402,
  } = useSettingsX402Data({ enabled: tab === "x402" });

  const configError = networksError ?? null;
  const workspaceLoading = configLoading || networksLoading;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDefaultNetwork(localStorage.getItem("hyperagent_default_network") || "");
    }
  }, []);

  const refetchWorkspace = () => {
    refetchNetworks();
  };

  const tabClass = (t: SettingsTab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
      tab === t
        ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] border-b-transparent -mb-px"
        : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
    }`;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[800px] mx-auto space-y-6 animate-enter">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
          <PageTitle title="Settings" />
        </div>
        <div className="flex gap-1 border-b border-[var(--color-border-subtle)] overflow-x-auto">
          <button type="button" onClick={() => setTab("workspace")} className={tabClass("workspace")}>
            <Folder className="w-4 h-4" />Workspace
          </button>
          <button type="button" onClick={() => setTab("byok")} className={tabClass("byok")}>
            <Key className="w-4 h-4" />LLM keys (BYOK)
          </button>
          <button type="button" onClick={() => setTab("x402")} className={tabClass("x402")}>
            <DollarSign className="w-4 h-4" />x402 & Spending
          </button>
          <button type="button" onClick={() => setTab("plan")} className={tabClass("plan")}>
            <CreditCard className="w-4 h-4" />Plan & Pricing
          </button>
          <button type="button" onClick={() => setTab("integrations")} className={tabClass("integrations")}>
            <Plug className="w-4 h-4" />Integrations
          </button>
        </div>

        {tab === "workspace" && (
          <div className="glass-panel rounded-xl p-6 space-y-6">
            {workspaceLoading && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] py-4">
                <Zap className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Loading workspace settings...</span>
              </div>
            )}
            {configError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-red-400">{configError}</p>
                <button type="button" onClick={refetchWorkspace} className="text-xs text-red-400 underline">Retry</button>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Default network</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-3">Select the default blockchain network for new workflows.</p>
              <select
                value={defaultNetwork}
                onChange={(e) => {
                  setDefaultNetwork(e.target.value);
                  localStorage.setItem("hyperagent_default_network", e.target.value);
                }}
                className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-primary)] w-full max-w-xs"
              >
                <option value="">Auto (first testnet)</option>
                {networks.map((n) => (
                  <option key={n.network_id} value={n.network_id}>
                    {n.name || n.network_id} ({n.chain_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Runtime configuration</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="glass-panel rounded-lg p-3">
                  <span className="text-[var(--color-text-muted)]">x402 payments</span>
                  <span className={`ml-2 font-medium ${config?.x402_enabled ? "text-green-400" : "text-[var(--color-text-tertiary)]"}`}>
                    {config?.x402_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="glass-panel rounded-lg p-3">
                  <span className="text-[var(--color-text-muted)]">Monitoring</span>
                  <span className={`ml-2 font-medium ${config?.monitoring_enabled ? "text-green-400" : "text-[var(--color-text-tertiary)]"}`}>
                    {config?.monitoring_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Available networks</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-2">{networks.length} networks configured from the chain registry.</p>
              <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
                {networks.map((n) => (
                  <div key={n.network_id} className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-[var(--color-bg-panel)]">
                    <span className="text-[var(--color-text-primary)]">{n.name}</span>
                    <span className="text-[var(--color-text-muted)]">{n.category} / {n.tier}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "byok" && (
          <div className="glass-panel rounded-xl p-6">
            <LLMKeysCard />
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              You can also manage API keys from the Chat page via the settings icon in the header.
            </p>
          </div>
        )}

        {tab === "x402" && (
          <div className="glass-panel rounded-xl p-6 space-y-6">
            {x402Loading && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] py-4">
                <Zap className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Loading credits and spending...</span>
              </div>
            )}
            {x402Error && !x402Loading && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-red-400">{x402Error}</p>
                <button type="button" onClick={() => void refetchX402()} className="text-xs text-red-400 underline">Retry</button>
              </div>
            )}
            {!x402Loading && (
            <>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Credits (workflow runs)</h3>
              <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
                Top up credits off-chain (fiat, USDC, USDT).
                {config?.credits_per_run != null && config.credits_per_run > 0 ? ` Each run costs ${config.credits_per_run} credits.` : " Each workflow run consumes credits."}
                {" "}x402 is used for external pay-per-call.
              </p>
              <CreditsCard
                balanceFromParent={x402Balance}
                onRefetch={refetchX402}
                creditsPerRun={config?.credits_per_run}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">x402 status</h3>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                x402 payments are {x402Enabled ? "enabled" : "disabled"} (from registry or env).
              </p>
              {x402Enabled && (
                <Link
                  href={ROUTES.PAYMENTS}
                  className="inline-flex items-center gap-2 mt-2 text-sm text-[var(--color-primary-light)] hover:underline"
                >
                  View payments and history
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Spending controls</h3>
              <SpendingControlCard
                controlFromParent={x402Control}
                onRefetch={refetchX402}
              />
            </div>
            </>
            )}
          </div>
        )}

        {tab === "plan" && (
          <div className="glass-panel rounded-xl p-6 space-y-6">
            {planLoading && (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] py-4">
                <Zap className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Loading plan information...</span>
              </div>
            )}
            {planError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-red-400">{planError}</p>
                <button type="button" onClick={refetchPlan} className="text-xs text-red-400 underline">Retry</button>
              </div>
            )}
            {usage && (
              <div className="glass-panel rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">Current plan</span>
                  <span className="text-sm font-semibold text-[var(--color-primary-light)]">{usage.plan_name}</span>
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] space-y-1">
                  {Object.entries(usage.usage).map(([key, val]) => {
                    const limit = usage.limits[key];
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-32 truncate">{key}</span>
                        <div className="flex-1 h-1.5 bg-[var(--color-bg-panel)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--color-primary-light)] rounded-full"
                            style={{ width: limit ? `${Math.min(100, (val / limit) * 100)}%` : "0%" }}
                          />
                        </div>
                        <span>{val}{limit ? ` / ${limit}` : ""}</span>
                      </div>
                    );
                  })}
                </div>
                {usage.features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {usage.features.map((f) => (
                      <span key={f} className="px-2 py-0.5 rounded text-xs bg-[var(--color-bg-panel)] text-[var(--color-text-tertiary)]">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Available plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div key={plan.id} className={`glass-panel rounded-xl p-4 space-y-3 ${usage?.plan === plan.id ? "ring-1 ring-[var(--color-primary-light)]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{plan.name}</span>
                      {usage?.plan === plan.id && (
                        <span className="text-xs text-[var(--color-primary-light)] font-medium">Current</span>
                      )}
                    </div>
                    <ul className="text-xs text-[var(--color-text-tertiary)] space-y-1">
                      {Object.entries(plan.limits).map(([resource, limit]) => (
                        <li key={resource} className="flex justify-between">
                          <span>{resource}</span>
                          <span className="font-mono">{typeof limit === "number" ? limit.toLocaleString() : "Unlimited"}</span>
                        </li>
                      ))}
                      {Object.keys(plan.limits).length === 0 && (
                        <li className="text-[var(--color-primary-light)]">Unlimited</li>
                      )}
                    </ul>
                    {plan.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((f) => (
                          <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {resources.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Resource pricing</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border-subtle)]">
                      <th className="text-left py-2 text-[var(--color-text-muted)] font-medium">Resource</th>
                      <th className="text-left py-2 text-[var(--color-text-muted)] font-medium">Unit</th>
                      <th className="text-right py-2 text-[var(--color-text-muted)] font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--color-border-subtle)] last:border-0">
                        <td className="py-2">
                          <div className="text-[var(--color-text-primary)]">{r.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{r.description}</div>
                        </td>
                        <td className="py-2 text-[var(--color-text-tertiary)]">{r.unit}</td>
                        <td className="py-2 text-right font-mono text-[var(--color-text-primary)]">${r.unit_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "integrations" && (
          <div className="glass-panel rounded-xl p-6 space-y-6">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Connected services</h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { name: "Tenderly", desc: "Simulation and monitoring", env: "TENDERLY_API_KEY", status: config?.integrations?.tenderly_configured ?? config?.monitoring_enabled },
                { name: "Blockchain RPC", desc: "Chain access via registry", env: "Networks configured", status: networks.length > 0 },
                { name: "Supabase", desc: "Database and authentication", env: "SUPABASE_URL", status: true },
                { name: "Pinata / IPFS", desc: "Artifact storage and pinning", env: "PINATA_JWT", status: config?.integrations?.pinata_configured ?? false },
                { name: "Qdrant / VectorDB", desc: "RAG embeddings and search", env: "QDRANT_URL", status: config?.integrations?.qdrant_configured ?? false },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                  <div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{svc.name}</span>
                    <p className="text-xs text-[var(--color-text-muted)]">{svc.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${svc.status ? "bg-green-400" : "bg-[var(--color-text-muted)]"}`} />
                    <span className="text-xs text-[var(--color-text-tertiary)]">{svc.status ? "Connected" : "Not configured"}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Service connections are managed via environment variables. Contact your admin to configure integrations.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-[var(--color-border-subtle)]">
          <Link
            href={ROUTES.CHAT}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-light)]"
          >
            <ExternalLink className="w-4 h-4" />
            Open Chat to build
          </Link>
        </div>
      </div>
    </div>
  );
}
