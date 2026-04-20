"use client";

import { useState, useCallback } from "react";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { useNetworks } from "@/hooks/useNetworks";
import { testNetworkRpc } from "@/lib/api";
import { Globe, Activity, Loader2, Check, X } from "lucide-react";
import Image from "next/image";
import { ShimmerTableRows } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { DataTable, EmptyState, NetworkTopologyMap } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";

function NetworkLogo({ id }: { id: string }) {
  const lowercaseId = id.toLowerCase();
  let src = "";
  if (lowercaseId.includes("base")) src = "/Base_Logo.png";
  else if (lowercaseId.includes("avalanche") || lowercaseId.includes("avax"))
    src = "/AvalancheLogo_Horizontal_1C_Red.png";
  else if (lowercaseId.includes("mantle")) src = "/MantleNetwork-White.png";
  else if (lowercaseId.includes("skale")) src = "/skale-logo.png";
  else if (lowercaseId.includes("kite")) src = "/kite-logo.svg";

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
  const supportedList = list.filter((network) => {
    const id = network.id.toLowerCase();
    return id.includes("skale") || id.includes("kite");
  });
  const [testing, setTesting] = useState<string | null>(null);
  const [rpcResult, setRpcResult] = useState<
    Record<string, { ok: boolean; latency_ms?: number; error?: string }>
  >({});

  const handleRpcTest = useCallback(async (networkId: string) => {
    setTesting(networkId);
    setRpcResult((prev) => ({
      ...prev,
      [networkId]: { ok: false, error: "Testing..." },
    }));
    try {
      const res = await testNetworkRpc(networkId);
      setRpcResult((prev) => ({
        ...prev,
        [networkId]: {
          ok: res.ok,
          latency_ms: res.latency_ms,
          error: res.error,
        },
      }));
    } catch (e) {
      setRpcResult((prev) => ({
        ...prev,
        [networkId]: {
          ok: false,
          error: e instanceof Error ? e.message : "Request failed",
        },
      }));
    } finally {
      setTesting(null);
    }
  }, []);

  return (
    <RequireApiSession>
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
          <PageTitle
            title="Networks"
            subtitle="SKALE Base and KiteAI networks from the chain registry."
          />

          {!loading && list.length > supportedList.length && (
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-4 py-3 text-xs text-[var(--color-text-tertiary)]">
              Studio currently presents only the supported v0.1.0 SKALE Base
              networks. Additional registry entries remain roadmap or internal
              configuration.
            </div>
          )}

          <ApiErrorBanner error={error} onRetry={refetch} />

          {supportedList.length > 0 && (
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">
                Network Topology
              </h3>
              <NetworkTopologyMap
                centralLabel="Orchestrator"
                networks={supportedList.map(
                  (n: { id: string; name?: string }) => ({
                    id: n.id,
                    name: n.name ?? n.id,
                  }),
                )}
              />
            </div>
          )}

          <DataTable
            headers={["Network", "Chain ID", "Currency", "Actions"]}
            isEmpty={!loading && supportedList.length === 0}
            isLoading={loading && supportedList.length === 0}
            loading={<ShimmerTableRows rows={5} cols={4} />}
            empty={
              <EmptyState
                icon={
                  <Globe className="w-8 h-8 text-[var(--color-text-muted)]" />
                }
                title="No supported networks configured"
                description="Studio expects SKALE Base network configuration from the backend."
              />
            }
          >
            {supportedList.map(
              (n: {
                id: string;
                name?: string;
                chain_id?: number;
                currency?: string;
              }) => (
                <tr
                  key={n.id}
                  className="group hover:bg-[var(--color-bg-panel)] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <NetworkLogo id={n.id} />
                      <div>
                        <div className="text-[var(--color-text-primary)] font-medium">
                          {n.name ?? n.id}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                          {n.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-tertiary)] font-mono">
                    {n.chain_id ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-tertiary)]">
                    {n.currency ?? "-"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleRpcTest(n.id)}
                      disabled={!!testing}
                      className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)] disabled:opacity-60 transition-colors"
                      title="Test RPC connectivity"
                    >
                      {testing === n.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : rpcResult[n.id]?.ok ? (
                        <Check className="w-3.5 h-3.5 text-[var(--color-semantic-success)]" />
                      ) : rpcResult[n.id]?.error ? (
                        <X className="w-3.5 h-3.5 text-[var(--color-semantic-error)]" />
                      ) : (
                        <Activity className="w-3.5 h-3.5" />
                      )}
                      {rpcResult[n.id]?.ok
                        ? `${rpcResult[n.id].latency_ms ?? ""}ms`
                        : rpcResult[n.id]?.error && !rpcResult[n.id].ok
                          ? rpcResult[n.id].error!.length > 20
                            ? "Failed"
                            : rpcResult[n.id].error
                          : "RPC test"}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </DataTable>
        </div>
      </div>
    </RequireApiSession>
  );
}
