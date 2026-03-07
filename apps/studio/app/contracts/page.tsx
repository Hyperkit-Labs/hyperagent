"use client";

import { useState } from "react";
import { ROUTES } from "@/constants/routes";
import { useContracts } from "@/hooks/useContracts";
import { contractRead, contractCall } from "@/lib/api";
import { FileCode, Terminal, Loader2, ChevronRight, Send } from "lucide-react";
import Link from "next/link";
import { ShimmerGrid } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { EmptyState, GlassCard } from "@/components/ui";

type ContractEntry = { id: string; workflowId?: string; address?: string; network?: string; name?: string; abi?: unknown[] };

function ContractInteract({ contract }: { contract: ContractEntry }) {
  const [fn, setFn] = useState("");
  const [args, setArgs] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [interactError, setInteractError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRead = async () => {
    if (!fn.trim() || !contract.address) return;
    setLoading(true);
    setResult(null);
    setInteractError(null);
    try {
      const res = await contractRead({
        contract_address: contract.address,
        function_name: fn.trim(),
        function_args: args.trim() ? args.split(",").map((a) => a.trim()) : [],
        network: contract.network || "",
        abi: Array.isArray(contract.abi) ? contract.abi : [],
      });
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setInteractError(e instanceof Error ? e.message : "Read failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async () => {
    if (!fn.trim() || !contract.address) return;
    setLoading(true);
    setResult(null);
    setInteractError(null);
    try {
      const res = await contractCall({
        contract_address: contract.address,
        function_name: fn.trim(),
        function_args: args.trim() ? args.split(",").map((a) => a.trim()) : [],
        network: contract.network || "",
        abi: Array.isArray(contract.abi) ? contract.abi : [],
      });
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setInteractError(e instanceof Error ? e.message : "Call failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={fn}
          onChange={(e) => setFn(e.target.value)}
          placeholder="Function name"
          className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        />
        <input
          type="text"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder="arg1, arg2"
          className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRead}
          disabled={loading || !fn.trim()}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
          Read
        </button>
        <button
          type="button"
          onClick={handleCall}
          disabled={loading || !fn.trim()}
          className="text-xs px-3 py-1.5 rounded-lg btn-primary-gradient text-white disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Write
        </button>
      </div>
      {interactError && <p className="text-xs text-red-400">{interactError}</p>}
      {result && (
        <pre className="text-[10px] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-base)] rounded-lg p-2 max-h-32 overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}

export default function ContractsPage() {
  const { contracts, loading, error, refetch } = useContracts();
  const list = (contracts ?? []) as ContractEntry[];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">Contracts</h1>
            <p className="text-[var(--color-text-tertiary)] text-sm mt-1">Contract addresses and read/write interactions.</p>
          </div>
        </div>
        <ApiErrorBanner error={error} onRetry={refetch} />
        {loading && !list.length && <ShimmerGrid count={6} />}
        {!loading && !error && list.length === 0 && (
          <EmptyState
            icon={<FileCode className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title="No contracts yet"
            description="When you deploy a workflow, contract addresses and read/write actions will appear here."
            action={
              <Link href={ROUTES.HOME} className="px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium">
                Create workflow
              </Link>
            }
          />
        )}
        {!loading && list.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((c) => (
              <div key={c.id} className="glass-panel rounded-xl p-5 transition-all hover:border-[var(--color-border-default)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileCode className="w-8 h-8 text-[var(--color-semantic-violet)] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--color-text-primary)] truncate">{c.name || c.workflowId || c.id}</div>
                      <div className="text-xs text-[var(--color-text-tertiary)] font-mono truncate">{c.address || "-"}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{c.network || ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.address && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] flex items-center gap-1"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        Interact
                      </button>
                    )}
                    <Link
                      href={ROUTES.APPS_ID(c.workflowId || c.id)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                {expandedId === c.id && <ContractInteract contract={c} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
