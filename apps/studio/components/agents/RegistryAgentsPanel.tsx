"use client";

import { useState } from "react";
import { RefreshCw, Database, Shield } from "lucide-react";
import { syncErc8004Registry } from "@/lib/api/agentRegistry";
import { getErrorMessage } from "@/lib/api";
import { useRegistryAgents } from "@/hooks/useRegistryAgents";
import type { RegistryAgentRow } from "@/lib/api/agentRegistry";

function capsText(row: RegistryAgentRow): string {
  const c = row.capabilities;
  if (Array.isArray(c)) return c.join(", ");
  if (c && typeof c === "object") return JSON.stringify(c);
  return "";
}

export function RegistryAgentsPanel() {
  const { agents: rows, loading, error, refetch } = useRegistryAgents(100);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const onSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncErc8004Registry();
      await refetch();
    } catch (e) {
      const msg = getErrorMessage(e, "Sync request failed");
      const status = (e as Error & { status?: number })?.status;
      if (status === 501) {
        setSyncError(
          `${msg} On-chain registry sync is not deployed yet; this button will succeed only after the indexer ships.`,
        );
      } else {
        setSyncError(msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const banner = syncError || error;

  return (
    <section className="mt-10 pt-8 border-t border-[var(--color-border-subtle)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--color-text-muted)]" />
            A2A registry index
          </h2>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 max-w-xl">
            Operational mirror in Supabase (ERC-8004 pointers, capabilities).
            On-chain registration and A2A transport are separate layers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onSync()}
            disabled={syncing}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            {syncing ? "Syncing…" : "Sync ERC-8004 mirror"}
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div className="mb-3 text-xs text-[var(--color-semantic-error)] rounded-lg border border-[var(--color-semantic-error)]/30 bg-[var(--color-semantic-error)]/5 px-3 py-2">
          {banner}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="text-xs text-[var(--color-text-muted)] py-6">
          Loading registry index…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-[var(--color-text-muted)] py-6 rounded-lg border border-dashed border-[var(--color-border-subtle)] px-4">
          No mirrored agents yet. Register via the orchestrator API or run sync
          after on-chain indexing is wired.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border-subtle)]">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]">
                <th className="p-2 font-medium text-[var(--color-text-muted)]">
                  Name
                </th>
                <th className="p-2 font-medium text-[var(--color-text-muted)]">
                  Service
                </th>
                <th className="p-2 font-medium text-[var(--color-text-muted)]">
                  Chain
                </th>
                <th className="p-2 font-medium text-[var(--color-text-muted)]">
                  Status
                </th>
                <th className="p-2 font-medium text-[var(--color-text-muted)]">
                  Capabilities
                </th>
                <th className="p-2 font-medium text-[var(--color-text-muted)]">
                  CID
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--color-border-subtle)]/60 hover:bg-[var(--color-bg-hover)]/50"
                >
                  <td className="p-2 text-[var(--color-text-primary)] font-mono text-[10px]">
                    {r.name ?? "—"}
                  </td>
                  <td className="p-2 text-[var(--color-text-secondary)]">
                    {r.owner_service ?? "—"}
                  </td>
                  <td className="p-2 font-mono">{r.chain_id ?? "—"}</td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)]">
                      {r.status ?? "—"}
                    </span>
                  </td>
                  <td
                    className="p-2 text-[var(--color-text-secondary)] max-w-[200px] truncate"
                    title={capsText(r)}
                  >
                    {capsText(r) || "—"}
                  </td>
                  <td
                    className="p-2 font-mono text-[10px] text-[var(--color-text-tertiary)] max-w-[120px] truncate"
                    title={r.registry_cid ?? ""}
                  >
                    {r.registry_cid ? `${r.registry_cid.slice(0, 10)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
