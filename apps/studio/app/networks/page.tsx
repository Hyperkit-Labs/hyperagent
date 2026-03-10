"use client";

import { useState } from "react";
import { useNetworks } from "@/hooks/useNetworks";
import { Globe, Activity, Loader2 } from "lucide-react";
import Image from "next/image";
import { ShimmerTableRows } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { DataTable, EmptyState, NetworkTopologyMap } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";

function NetworkLogo({ id }: { id: string }) {
  const lowercaseId = id.toLowerCase();
  let src = "";
  if (lowercaseId.includes("base")) src = "/Base_Logo.png";
  else if (lowercaseId.includes("avalanche") || lowercaseId.includes("avax")) src = "/AvalancheLogo_Horizontal_1C_Red.png";
  else if (lowercaseId.includes("mantle")) src = "/MantleNetwork-White.png";
  else if (lowercaseId.includes("skale")) src = "/skale-logo.png";
  
  if (!src) return <Globe className="w-5 h-5 text-[var(--color-text-muted)]" />;
  
  return (
    <div className="w-6 h-6 relative rounded-full overflow-hidden flex items-center justify-center bg-[var(--color-bg-panel)] p-1 border border-[var(--color-border-subtle)]">
      <Image src={src} alt={id} fill className="object-contain" />
    </div>
  );
}

export default function NetworksPage() {
  const { networks, loading, error, refetch } = useNetworks();
  const list = networks ?? [];
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setTesting(id);
    await new Promise(r => setTimeout(r, 800));
    setTesting(null);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <PageTitle title="Networks" subtitle="Supported chains and network configuration." />

        <ApiErrorBanner error={error} onRetry={refetch} />

        {list.length > 0 && (
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Network Topology</h3>
            <NetworkTopologyMap
              centralLabel="Orchestrator"
              networks={list.map((n: { id: string; name?: string }) => ({ id: n.id, name: n.name ?? n.id }))}
            />
          </div>
        )}

        <DataTable
          headers={["Network", "Chain ID", "Currency", "Actions"]}
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
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <NetworkLogo id={n.id} />
                  <div>
                    <div className="text-[var(--color-text-primary)] font-medium">{n.name ?? n.id}</div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono">{n.id}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-[var(--color-text-tertiary)] font-mono">{n.chain_id ?? "-"}</td>
              <td className="px-6 py-4 text-[var(--color-text-tertiary)]">{n.currency ?? "-"}</td>
              <td className="px-6 py-4">
                <button
                  onClick={() => handleTest(n.id)}
                  disabled={testing === n.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
                >
                  {testing === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  Test RPC
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
