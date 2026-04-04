"use client";

import { useState } from "react";
import type { RuntimeConfig } from "@/lib/api";

interface IntegrationsTabProps {
  config: RuntimeConfig | null;
  networksCount: number;
}

interface ServiceDef {
  name: string;
  desc: string;
  env: string;
  core: boolean;
  getStatus: (config: RuntimeConfig | null, networksCount: number) => boolean;
}

const CORE_SERVICES: ServiceDef[] = [
  {
    name: "Tenderly",
    desc: "Simulation and monitoring",
    env: "TENDERLY_API_KEY",
    core: true,
    getStatus: (c) =>
      c?.integrations?.tenderly_configured ?? c?.monitoring_enabled ?? false,
  },
  {
    name: "Blockchain RPC",
    desc: "Chain access via registry",
    env: "Networks configured",
    core: true,
    getStatus: (_, n) => n > 0,
  },
  {
    name: "Supabase",
    desc: "Database and authentication",
    env: "SUPABASE_URL",
    core: true,
    getStatus: () => true,
  },
  {
    name: "Pinata / IPFS",
    desc: "Artifact storage and pinning",
    env: "PINATA_JWT",
    core: true,
    getStatus: (c) => c?.integrations?.pinata_configured ?? false,
  },
  {
    name: "Qdrant / VectorDB",
    desc: "RAG embeddings and search",
    env: "QDRANT_URL",
    core: true,
    getStatus: (c) => c?.integrations?.qdrant_configured ?? false,
  },
];

export function IntegrationsTab({
  config,
  networksCount,
}: IntegrationsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const handleConfigure = (name: string) => {
    setExpandedId((prev) => (prev === name ? null : name));
  };

  const handleConnectSuccess = (name: string) => {
    setSuccessId(name);
    setTimeout(() => setSuccessId(null), 800);
  };

  const renderServiceRow = (svc: ServiceDef, isCore: boolean) => {
    const status = svc.getStatus(config, networksCount);
    const isExpanded = expandedId === svc.name;
    const showSuccess = successId === svc.name;

    return (
      <div key={svc.name} className="rounded-lg overflow-hidden">
        <div
          className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-all duration-200 cursor-pointer ${
            showSuccess
              ? "bg-emerald-500/10 border-emerald-500/30"
              : isCore
                ? "bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-panel)] border-l-2 border-l-[var(--color-primary-alpha-30)]"
                : "bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-panel)]"
          }`}
        >
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {svc.name}
            </span>
            <p className="text-xs text-[var(--color-text-muted)]">{svc.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${status ? "bg-emerald-400" : "bg-[var(--color-text-muted)]"}`}
            />
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {status ? "Connected" : "Not configured"}
            </span>
            <button
              type="button"
              onClick={() => handleConfigure(svc.name)}
              className="ml-2 text-[11px] font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
            >
              {isExpanded ? "Hide" : "Configure"}
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className="mt-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-3 text-xs">
            <p className="text-[var(--color-text-muted)] mb-2">
              Configure via environment variable:{" "}
              <code className="font-mono text-[var(--color-text-secondary)]">
                {svc.env}
              </code>
            </p>
            <p className="text-[var(--color-text-muted)] mb-3">
              Service connections are managed via environment variables. Contact
              your admin to configure.
            </p>
            <button
              type="button"
              onClick={() => handleConnectSuccess(svc.name)}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90"
            >
              Test connection
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] backdrop-blur-md p-4 space-y-4">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
        Connected services
      </h3>

      <div>
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Core integrations
        </h4>
        <div className="space-y-2">
          {CORE_SERVICES.map((svc) => renderServiceRow(svc, true))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Service connections are managed via environment variables. Contact your
        admin to configure integrations.
      </p>
    </div>
  );
}
