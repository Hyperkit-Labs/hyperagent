"use client";

import { useNetworks } from "@/hooks/useNetworks";
import { Globe } from "lucide-react";
import { ShimmerTableRows } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { DataTable, EmptyState, NetworkTopologyMap } from "@/components/ui";

export default function NetworksPage() {
  const { networks, loading, error, refetch } = useNetworks();
  const list = networks ?? [];

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">Networks</h1>
          <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Supported chains and network configuration.</p>
        </div>

        <ApiErrorBanner error={error} onRetry={refetch} />

        {list.length > 0 && (
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Network Topology</h3>
            <NetworkTopologyMap
              centralLabel="Contract"
              networks={list.map((n: { id: string; name?: string }) => ({ id: n.id, name: n.name ?? n.id }))}
            />
          </div>
        )}

        <DataTable
          headers={["Network", "Name", "Chain ID", "Currency"]}
          isEmpty={!loading && list.length === 0}
          isLoading={loading && list.length === 0}
          loading={<ShimmerTableRows rows={5} cols={4} />}
          empty={
            <EmptyState
              icon={<Globe className="w-8 h-8 text-[var(--color-text-muted)]" />}
              title="No networks configured"
              description="Network configuration is provided by the backend."
            />
          }
        >
          {list.map((n: { id: string; name?: string; chain_id?: number; currency?: string }) => (
            <tr key={n.id} className="group hover:bg-[var(--color-bg-panel)] transition-colors">
              <td className="px-6 py-4 font-mono text-[var(--color-text-secondary)]">{n.id}</td>
              <td className="px-6 py-4 text-[var(--color-text-primary)]">{n.name ?? n.id}</td>
              <td className="px-6 py-4 text-[var(--color-text-tertiary)]">{n.chain_id ?? "-"}</td>
              <td className="px-6 py-4 text-[var(--color-text-tertiary)]">{n.currency ?? "-"}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
