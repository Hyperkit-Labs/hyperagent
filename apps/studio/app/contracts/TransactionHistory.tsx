"use client";

import { useEffect, useState } from "react";
import { getWorkflowDeployments, reportApiError } from "@/lib/api";
import { getExplorerUrl } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface DeploymentRow {
  network?: string;
  contract_address?: string;
  transaction_hash?: string;
  [key: string]: unknown;
}

export function TransactionHistory({ workflowId }: { workflowId: string }) {
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await getWorkflowDeployments(workflowId);
        const list = res.deployments ?? [];
        if (!cancelled) setDeployments(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) reportApiError(err, { path: `TransactionHistory/${workflowId}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [workflowId]);

  if (loading) {
    return (
      <div className="animate-pulse h-20 bg-[var(--color-bg-panel)] rounded-lg mt-4" />
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="text-xs text-[var(--color-text-muted)] mt-4 py-2">
        No deployment history found.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-[12px] border-t border-[var(--color-border-subtle)]">
        <thead>
          <tr className="text-[var(--color-text-secondary)] text-left">
            <th className="py-2 font-medium">Network</th>
            <th className="py-2 font-medium">Address</th>
            <th className="py-2 font-medium">Tx Hash</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((d, i) => {
            const network = (d.network as string) ?? "";
            const txHash = (d.transaction_hash as string) ?? "";
            const addr = (d.contract_address as string) ?? "";
            const explorerUrl = network && txHash ? getExplorerUrl(network, "tx", txHash) : null;

            return (
              <tr key={i} className="border-t border-[var(--color-border-subtle)]">
                <td className="py-2 text-[var(--color-text-secondary)]">{network || "—"}</td>
                <td className="py-2 font-mono text-[var(--color-text-secondary)] truncate max-w-[120px]" title={addr}>
                  {addr ? `${addr.slice(0, 10)}...` : "—"}
                </td>
                <td className="py-2 font-mono">
                  {explorerUrl && txHash ? (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-primary-light)] hover:underline inline-flex items-center gap-1"
                    >
                      {txHash.slice(0, 8)}...
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">{txHash ? `${txHash.slice(0, 8)}...` : "—"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
