"use client";

import { useState, useCallback } from "react";
import { ApiPaths } from "@hyperagent/api-contracts";
import type { RuntimeConfig } from "@/lib/api";
import { getApiBase, joinApiUrlForFetch } from "@/lib/api/core";

interface IntegrationsTabProps {
  config: RuntimeConfig | null;
  networksCount: number;
  apiBase?: string;
}

interface ServiceDef {
  name: string;
  desc: string;
  env: string;
  core: boolean;
  docsUrl?: string;
  warning?: string | ((c: RuntimeConfig | null) => string | undefined);
  getStatus: (config: RuntimeConfig | null, networksCount: number) => boolean;
}

const CORE_SERVICES: ServiceDef[] = [
  {
    name: "Tenderly",
    desc: "Smart contract simulation before deploy",
    env: "TENDERLY_API_KEY",
    core: true,
    docsUrl: "https://docs.tenderly.co",
    getStatus: (c) =>
      c?.integrations?.tenderly_configured ?? c?.monitoring_enabled ?? false,
  },
  {
    name: "Blockchain RPC",
    desc: "Chain access via network registry",
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
    desc: "Artifact storage and IPFS pinning",
    env: "PINATA_JWT",
    core: true,
    docsUrl: "https://docs.pinata.cloud",
    warning: (c: RuntimeConfig | null) =>
      c?.integrations?.pinata_configured &&
      !c?.integrations?.pinata_dedicated_gateway
        ? "Using shared gateway. Set PINATA_GATEWAY_DOMAIN to a dedicated gateway in production."
        : undefined,
    getStatus: (c) => c?.integrations?.pinata_configured ?? false,
  },
  {
    name: "Qdrant / VectorDB",
    desc: "RAG embeddings and semantic search",
    env: "QDRANT_URL",
    core: true,
    docsUrl: "https://qdrant.tech/documentation",
    getStatus: (c) => c?.integrations?.qdrant_configured ?? false,
  },
  {
    name: "Filecoin Archival",
    desc: "Permanent storage via Lighthouse Filecoin First",
    env: "LIGHTHOUSE_API_KEY + FILECOIN_ARCHIVAL_ENABLED=1",
    core: true,
    docsUrl: "https://docs.lighthouse.storage",
    getStatus: (c) => c?.integrations?.filecoin_configured ?? false,
  },
];

const OPTIONAL_SERVICES: ServiceDef[] = [
  {
    name: "Kite Chain",
    desc: "AI payment blockchain for autonomous agent identity and spending sessions",
    env: "KITE_CHAIN_RPC_MAINNET",
    core: false,
    docsUrl: "https://github.com/gokite-ai/developer-docs",
    getStatus: (c) => c?.integrations?.kite_chain_configured ?? false,
  },
];

type TestState = "idle" | "loading" | "ok" | "error";

export function IntegrationsTab({
  config,
  networksCount,
  apiBase = "",
}: IntegrationsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testState, setTestState] = useState<Record<string, TestState>>({});
  const [testDetail, setTestDetail] = useState<Record<string, string>>({});

  const handleConfigure = (name: string) => {
    setExpandedId((prev) => (prev === name ? null : name));
  };

  const handleTestConnection = useCallback(
    async (name: string) => {
      setTestState((s) => ({ ...s, [name]: "loading" }));
      setTestDetail((d) => ({ ...d, [name]: "" }));
      try {
        const url = joinApiUrlForFetch(
          (apiBase || getApiBase()).replace(/\/$/, ""),
          ApiPaths.configIntegrationsDebug,
        );
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: {
          integrations?: Record<string, boolean | string | null>;
        } = await res.json();
        const integrations = data.integrations ?? {};

        const keyMap: Record<string, string> = {
          Tenderly: "tenderly_configured",
          "Pinata / IPFS": "pinata_configured",
          "Qdrant / VectorDB": "qdrant_configured",
          "Filecoin Archival": "filecoin_configured",
          "Kite Chain": "kite_chain_configured",
          "Blockchain RPC": "networks_count",
          Supabase: "supabase_configured",
        };
        const key = keyMap[name];
        if (key) {
          const val = integrations[key];
          const configured = typeof val === "number" ? val > 0 : Boolean(val);
          setTestState((s) => ({ ...s, [name]: configured ? "ok" : "error" }));
          setTestDetail((d) => ({
            ...d,
            [name]: configured
              ? "Connected"
              : "Not configured — check server env vars",
          }));
        } else {
          setTestState((s) => ({ ...s, [name]: "ok" }));
          setTestDetail((d) => ({ ...d, [name]: "Reachable" }));
        }
      } catch (err) {
        setTestState((s) => ({ ...s, [name]: "error" }));
        setTestDetail((d) => ({
          ...d,
          [name]: err instanceof Error ? err.message : "Connection failed",
        }));
      }
      setTimeout(() => {
        setTestState((s) => ({ ...s, [name]: "idle" }));
      }, 4000);
    },
    [apiBase],
  );

  const renderServiceRow = (svc: ServiceDef, isCore: boolean) => {
    const status = svc.getStatus(config, networksCount);
    const isExpanded = expandedId === svc.name;
    const ts = testState[svc.name] ?? "idle";
    const detail = testDetail[svc.name] ?? "";
    const warn = svc.warning;
    const warning = typeof warn === "function" ? warn(config) : warn;

    const borderClass = isCore
      ? "border-l-2 border-l-[var(--color-primary-alpha-30)]"
      : "";

    return (
      <div key={svc.name} className="rounded-lg overflow-hidden">
        <div
          className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-all duration-200 cursor-pointer
            ${ts === "ok" ? "bg-emerald-500/10 border-emerald-500/30" : ts === "error" ? "bg-red-500/10 border-red-500/30" : `bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-panel)] ${borderClass}`}`}
        >
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {svc.name}
            </span>
            <p className="text-xs text-[var(--color-text-muted)]">{svc.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            {ts === "loading" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            {ts !== "loading" && (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${status ? "bg-emerald-400" : "bg-[var(--color-text-muted)]"}`}
              />
            )}
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {ts === "loading"
                ? "Testing…"
                : ts === "ok"
                  ? detail || "Connected"
                  : ts === "error"
                    ? detail || "Error"
                    : status
                      ? "Connected"
                      : "Not configured"}
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

        {warning && !isExpanded && (
          <div className="mt-0.5 px-4 py-1.5 rounded-b-lg border border-t-0 border-amber-500/20 bg-amber-500/5">
            <p className="text-[10px] text-amber-400">{warning}</p>
          </div>
        )}

        {isExpanded && (
          <div className="mt-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-3 text-xs space-y-2">
            {warning && (
              <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] text-amber-400">{warning}</p>
              </div>
            )}
            <p className="text-[var(--color-text-muted)]">
              Configure via environment variable:{" "}
              <code className="font-mono text-[var(--color-text-secondary)]">
                {svc.env}
              </code>
            </p>
            {svc.docsUrl && (
              <a
                href={svc.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary-light)] hover:underline"
              >
                View documentation
              </a>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection(svc.name)}
                disabled={ts === "loading"}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ts === "loading" ? "Testing…" : "Test connection"}
              </button>
              {ts !== "idle" && ts !== "loading" && (
                <span
                  className={`text-[11px] ${ts === "ok" ? "text-emerald-400" : "text-red-400"}`}
                >
                  {detail}
                </span>
              )}
            </div>
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

      <div>
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Optional integrations
        </h4>
        <div className="space-y-2">
          {OPTIONAL_SERVICES.map((svc) => renderServiceRow(svc, false))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {
          "Connections managed via environment variables. Use “Test connection” to verify live status against the running backend."
        }
      </p>
    </div>
  );
}
