"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, Folder, Key, Plug, ExternalLink, DollarSign, CreditCard, Zap } from "lucide-react";
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
      <div className="max-w-[960px] mx-auto space-y-6 animate-enter">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
          <PageTitle title="Settings" />
        </div>
        <div className="flex gap-1 border-b border-[var(--color-border-subtle)] overflow-x-auto overflow-y-hidden">
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
