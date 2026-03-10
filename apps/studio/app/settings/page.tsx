"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, Folder, Key, Plug, ExternalLink, DollarSign, CreditCard } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { LLMKeysCard } from "@/components/settings/LLMKeysCard";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";
import { X402SpendingTab } from "@/components/settings/X402SpendingTab";
import { PlanPricingTab } from "@/components/settings/PlanPricingTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hyperagent_default_network") || "";
      queueMicrotask(() => setDefaultNetwork(stored));
    }
  }, []);

  const refetchWorkspace = () => {
    refetchNetworks();
  };

  const tabClass = (t: SettingsTab) =>
    `px-4 py-3 text-sm font-medium rounded-lg transition-colors flex items-center gap-3 w-full text-left ${
      tab === t
        ? "bg-[var(--color-bg-panel)] text-[var(--color-primary-light)] border border-[var(--color-border-subtle)] md:shadow-sm"
        : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
    }`;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto animate-enter">
        <div className="flex items-center gap-2 mb-8">
          <SettingsIcon className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
          <PageTitle title="Settings" />
        </div>
        
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
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
            </nav>
            
            <div className="mt-8 pt-6 border-t border-[var(--color-border-subtle)] hidden md:block">
              <Link
                href={ROUTES.CHAT}
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-light)]"
              >
                <ExternalLink className="w-4 h-4" />
                Open Chat to build
              </Link>
            </div>
          </aside>

          <main className="flex-1 min-w-0 space-y-6">
          {tab === "workspace" && (
          <WorkspaceTab
            config={config}
            configError={configError}
            configLoading={configLoading}
            networks={networks}
            networksLoading={networksLoading}
            defaultNetwork={defaultNetwork}
            setDefaultNetwork={setDefaultNetwork}
            refetchWorkspace={refetchWorkspace}
          />
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
          <X402SpendingTab
            x402Enabled={x402Enabled}
            x402Loading={x402Loading}
            x402Error={x402Error}
            x402Balance={x402Balance}
            x402Control={x402Control}
            config={config}
            refetchX402={refetchX402}
          />
        )}

        {tab === "plan" && (
          <PlanPricingTab
            plans={plans}
            resources={resources}
            usage={usage}
            planLoading={planLoading}
            planError={planError}
            refetchPlan={refetchPlan}
          />
        )}

        {tab === "integrations" && (
            <IntegrationsTab config={config} networksCount={networks.length} />
          )}

          {/* Danger Zone */}
          <div className="mt-12 pt-8 border-t border-red-900/30">
            <h3 className="text-lg font-medium text-red-500 mb-4">Danger Zone</h3>
            <div className="glass-panel border-red-900/30 rounded-xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Revoke All Keys</h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Remove all LLM API keys from this workspace.</p>
                </div>
                <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium rounded-lg border border-red-500/20 transition-colors shrink-0">
                  Revoke Keys
                </button>
              </div>
              <div className="h-px bg-red-900/30 w-full" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Delete Workspace</h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Permanently delete this workspace and all associated data.</p>
                </div>
                <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors shrink-0">
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
          </main>
        </div>
      </div>
    </div>
  );
}
