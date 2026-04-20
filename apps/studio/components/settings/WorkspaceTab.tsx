"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import type { RuntimeConfig, NetworkConfig } from "@/lib/api";
import { WorkspaceTabSkeleton } from "@/components/settings/WorkspaceSettingsSkeleton";

interface WorkspaceTabProps {
  config: RuntimeConfig | null;
  configError: string | null;
  configLoading: boolean;
  networks: NetworkConfig[];
  networksLoading: boolean;
  defaultNetwork: string;
  setDefaultNetwork: (v: string) => void;
  refetchWorkspace: () => void;
}

export function WorkspaceTab({
  config,
  configError,
  configLoading,
  networks,
  networksLoading,
  defaultNetwork,
  setDefaultNetwork,
  refetchWorkspace,
}: WorkspaceTabProps) {
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [pulseDefault, setPulseDefault] = useState(false);
  const prevNetworksCount = useRef(networks.length);

  useEffect(() => {
    if (networks.length > 0 && prevNetworksCount.current === 0) {
      setShowSuccessToast(true);
      setPulseDefault(true);
      const t = setTimeout(() => setShowSuccessToast(false), 3000);
      const p = setTimeout(() => setPulseDefault(false), 800);
      return () => {
        clearTimeout(t);
        clearTimeout(p);
      };
    }
    prevNetworksCount.current = networks.length;
  }, [networks.length]);

  const workspaceLoading = configLoading || networksLoading;
  const defaultLabel = defaultNetwork
    ? (networks.find(
        (n) => n.network_id === defaultNetwork || n.id === defaultNetwork,
      )?.name ?? defaultNetwork)
    : "Auto (first testnet)";

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] backdrop-blur-md p-4 space-y-4 relative overflow-hidden">
      {workspaceLoading && <WorkspaceTabSkeleton />}
      {configError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-red-400">{configError}</p>
          <button
            type="button"
            onClick={refetchWorkspace}
            className="text-xs text-red-400 underline"
          >
            Retry
          </button>
        </div>
      )}
      {!workspaceLoading && !configError && (
        <>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-[var(--color-text-muted)]">Runtime</span>
            <span
              className={`px-2 py-0.5 rounded-full ${
                config?.monitoring_enabled
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              Monitoring {config?.monitoring_enabled ? "enabled" : "disabled"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full ${
                config?.x402_enabled
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              }`}
            >
              x402 {config?.x402_enabled ? "enabled" : "disabled"}
            </span>
            <span
              className={`ml-auto px-2 py-0.5 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] ${
                pulseDefault ? "animate-pulse ring-1 ring-emerald-500/50" : ""
              }`}
            >
              Default: {defaultLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 text-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                  Default network
                </label>
                <select
                  value={defaultNetwork}
                  onChange={(e) => {
                    setDefaultNetwork(e.target.value);
                    localStorage.setItem(
                      "hyperagent_default_network",
                      e.target.value,
                    );
                  }}
                  className="rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm text-[var(--color-text-primary)] w-full"
                >
                  <option value="">Auto (first testnet)</option>
                  {networks.map((n) => (
                    <option key={n.network_id} value={n.network_id}>
                      {n.name || n.network_id} ({n.chain_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-[var(--color-text-muted)]">x402:</span>
                <span
                  className={
                    config?.x402_enabled
                      ? "text-emerald-400"
                      : "text-[var(--color-text-tertiary)]"
                  }
                >
                  {config?.x402_enabled ? "On" : "Off"}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  Monitoring:
                </span>
                <span
                  className={
                    config?.monitoring_enabled
                      ? "text-emerald-400"
                      : "text-[var(--color-text-tertiary)]"
                  }
                >
                  {config?.monitoring_enabled ? "On" : "Off"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Available networks
                </span>
                <Link
                  href={ROUTES.NETWORKS}
                  className="text-[11px] text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
                >
                  Configure registry
                </Link>
              </div>
              {networks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-4 text-xs text-[var(--color-text-muted)]">
                  No networks configured. Add one from the registry to start
                  deploying.
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] max-h-40 overflow-y-auto">
                  {networks.map((n) => (
                    <div
                      key={n.network_id}
                      className="flex items-center justify-between py-2 px-3 text-xs hover:bg-[var(--color-bg-panel)] border-b border-[var(--color-border-subtle)] last:border-0"
                    >
                      <span className="text-[var(--color-text-primary)]">
                        {n.name}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {n.category ?? "-"} / {n.tier ?? "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showSuccessToast && (
            <div
              className="absolute bottom-4 left-4 right-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400"
              role="status"
            >
              First network added. Default network pill updated.
            </div>
          )}
        </>
      )}
    </div>
  );
}
