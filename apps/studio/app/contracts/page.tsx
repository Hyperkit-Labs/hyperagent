"use client";

import { useState, useMemo } from "react";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { ROUTES } from "@/constants/routes";
import { useContracts } from "@/hooks/useContracts";
import { contractRead, contractCall } from "@/lib/api";
import { getExplorerUrl } from "@/lib/utils";
import {
  FileCode,
  Terminal,
  Search,
  Loader2,
  ChevronRight,
  Send,
  Copy,
  CheckCircle2,
  History,
  Fuel,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { ShimmerGrid } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { EmptyState, TableFilterBar } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface AbiItem {
  type?: string;
  name?: string;
  inputs?: { type: string; name: string }[];
  outputs?: { type: string; name: string }[];
  stateMutability?: string;
}
type ContractEntry = {
  id: string;
  workflowId?: string;
  address?: string;
  network?: string;
  name?: string;
  abi?: AbiItem[];
  transactionHash?: string;
  createdAt?: string;
  /** Explorer or backend verification (optional) */
  verified?: boolean;
  /** Deployment or last-tx gas (optional) */
  gasUsed?: number;
};

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function splitFunctionArgs(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Coerced contract call args, including nested arrays for tuple/array ABI types. */
type CoercedFunctionArg = string | boolean | number | CoercedFunctionArg[];

function coerceArg(type: string, rawValue: unknown): CoercedFunctionArg {
  if (type.endsWith("[]")) {
    const elementType = type.slice(0, -2);
    const values = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === "string"
        ? JSON.parse(rawValue)
        : null;
    if (!Array.isArray(values)) {
      throw new Error("Array arguments must be entered as JSON arrays.");
    }
    return values.map((value) => coerceArg(elementType, value));
  }
  const normalizedValue =
    typeof rawValue === "string" ? rawValue.trim() : String(rawValue);
  if (type === "address") {
    if (!ADDRESS_PATTERN.test(normalizedValue)) {
      throw new Error(`Expected an address for ${type}.`);
    }
    return normalizedValue;
  }
  if (type === "bool") {
    if (normalizedValue === "true") return true;
    if (normalizedValue === "false") return false;
    throw new Error("Boolean arguments must be true or false.");
  }
  if (type.startsWith("uint") || type.startsWith("int")) {
    if (!/^-?\d+$/.test(normalizedValue)) {
      throw new Error(`Expected an integer for ${type}.`);
    }
    return normalizedValue;
  }
  if (type.startsWith("bytes")) {
    if (!/^0x[a-fA-F0-9]*$/.test(normalizedValue)) {
      throw new Error(`Expected a hex value for ${type}.`);
    }
    return normalizedValue;
  }
  return normalizedValue;
}

function parseRawArgs(rawArgs: string): unknown[] {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error("Arguments must be a JSON array.");
    }
    return parsed;
  }
  return splitFunctionArgs(trimmed);
}

function validateAndCoerceArgs(
  abiItem: AbiItem | undefined,
  rawArgs: string,
): CoercedFunctionArg[] {
  const values = parseRawArgs(rawArgs);
  const inputs = abiItem?.inputs ?? [];
  if (abiItem && values.length !== inputs.length) {
    throw new Error(
      `Expected ${inputs.length} argument${inputs.length === 1 ? "" : "s"} for ${abiItem.name}.`,
    );
  }
  return values.map((value, index) =>
    coerceArg(inputs[index]?.type ?? "string", value),
  );
}

function ContractInteract({ contract }: { contract: ContractEntry }) {
  const [fn, setFn] = useState("");
  const [args, setArgs] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [interactError, setInteractError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const abiFunctions = (contract.abi || []).filter(
    (item) => item && item.type === "function",
  );

  const handleRead = async () => {
    if (!fn.trim() || !contract.address) return;
    setLoading(true);
    setResult(null);
    setInteractError(null);
    try {
      if (!ADDRESS_PATTERN.test(contract.address)) {
        throw new Error("Contract address is invalid.");
      }
      const functionDefinition = abiFunctions.find(
        (item) => item.name === fn.trim(),
      );
      const parsedArgs = validateAndCoerceArgs(functionDefinition, args.trim());
      const res = await contractRead({
        contract_address: contract.address,
        function_name: fn.trim(),
        function_args: parsedArgs,
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
      if (!ADDRESS_PATTERN.test(contract.address)) {
        throw new Error("Contract address is invalid.");
      }
      const functionDefinition = abiFunctions.find(
        (item) => item.name === fn.trim(),
      );
      const parsedArgs = validateAndCoerceArgs(functionDefinition, args.trim());
      const res = await contractCall({
        contract_address: contract.address,
        function_name: fn.trim(),
        function_args: parsedArgs,
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

  const selectedFnDetails = abiFunctions.find((f) => f.name === fn);
  const paramsPlaceholder =
    selectedFnDetails?.inputs
      ?.map(
        (input: { type: string; name: string }) =>
          `${input.type} ${input.name}`,
      )
      .join(", ") || "arg1, arg2";

  return (
    <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4 space-y-4 animate-enter">
      <div className="flex items-center gap-2">
        {abiFunctions.length > 0 ? (
          <select
            value={fn}
            onChange={(e) => setFn(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-alpha-50)]"
          >
            <option value="">Select function...</option>
            {abiFunctions.map((func, i) => (
              <option key={i} value={func.name}>
                {func.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={fn}
            onChange={(e) => setFn(e.target.value)}
            placeholder="Function name"
            className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-alpha-50)]"
          />
        )}
        <input
          type="text"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder={paramsPlaceholder}
          className="flex-[2] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-alpha-50)]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRead}
          disabled={
            loading ||
            !fn.trim() ||
            selectedFnDetails?.stateMutability === "nonpayable" ||
            selectedFnDetails?.stateMutability === "payable"
          }
          className="text-xs px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] bg-[var(--color-bg-panel)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Terminal className="w-3.5 h-3.5" />
          )}
          Read
        </button>
        <button
          type="button"
          onClick={handleCall}
          disabled={loading || !fn.trim()}
          className="text-xs px-4 py-2 rounded-lg btn-primary-gradient text-white disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-[var(--color-primary-alpha-20)] hover:shadow-[var(--color-primary-alpha-30)] transition-all"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Write
        </button>
      </div>
      {interactError && (
        <div className="text-xs text-[var(--color-semantic-error)] bg-[var(--color-semantic-error)]/10 border border-[var(--color-semantic-error)]/20 p-2 rounded-lg">
          {interactError}
        </div>
      )}
      {result && (
        <div className="mt-2 rounded-lg overflow-hidden border border-[var(--color-border-subtle)] text-[11px]">
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "12px",
              background: "var(--color-bg-base)",
            }}
          >
            {result}
          </SyntaxHighlighter>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2 mb-3 text-[var(--color-text-secondary)]">
          <History className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">
            Deployment Transaction
          </span>
        </div>
        {contract.transactionHash ? (
          <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
            <span className="text-[11px] font-mono text-[var(--color-text-secondary)] truncate">
              {contract.transactionHash.slice(0, 10)}...
              {contract.transactionHash.slice(-8)}
            </span>
            {contract.network && (
              <a
                href={
                  getExplorerUrl(
                    contract.network,
                    "tx",
                    contract.transactionHash,
                  ) ?? "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary-light)] hover:underline flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)]">
            No deployment transaction recorded for this contract.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ContractsPage() {
  const { contracts, loading, error, refetch } = useContracts();
  const list = (contracts ?? []) as ContractEntry[];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contractSearch, setContractSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  const networkOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of list) {
      const n = (c.network || "").trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filteredList = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    return list.filter((c) => {
      if (networkFilter !== "all") {
        const n = (c.network || "").trim();
        if (n !== networkFilter) return false;
      }
      if (!q) return true;
      const hay = [c.name, c.id, c.workflowId, c.address, c.network]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [list, contractSearch, networkFilter]);

  return (
    <RequireApiSession>
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
          <div className="flex items-center justify-between">
            <PageTitle
              title="Contracts"
              subtitle="Contract addresses and read/write interactions."
            />
          </div>
          <ApiErrorBanner error={error} onRetry={refetch} />
          {loading && !list.length && <ShimmerGrid count={6} />}
          {!loading && !error && list.length === 0 && (
            <EmptyState
              icon={
                <FileCode className="w-8 h-8 text-[var(--color-text-muted)]" />
              }
              title="No contracts yet"
              description="When you deploy a workflow, contract addresses and read/write actions will appear here."
              suggestions={[
                "Deploy an ERC20 token",
                "Create a simple NFT contract",
              ]}
              action={
                <Link
                  href={ROUTES.HOME}
                  className="px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium"
                >
                  Create workflow
                </Link>
              }
            />
          )}
          {!loading && list.length > 0 && (
            <>
              <TableFilterBar className="flex-col items-stretch sm:flex-row sm:items-center sm:flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
                  <input
                    type="search"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    placeholder="Filter by name, address, workflow…"
                    className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] pl-8 pr-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-alpha-50)]"
                    aria-label="Filter contracts"
                  />
                </div>
                {networkOptions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNetworkFilter("all")}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-medium border transition-colors ${
                        networkFilter === "all"
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-alpha-15)] text-[var(--color-primary-light)]"
                          : "border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      All networks
                    </button>
                    {networkOptions.map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setNetworkFilter(net)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-medium border transition-colors font-mono ${
                          networkFilter === net
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-alpha-15)] text-[var(--color-primary-light)]"
                            : "border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                )}
              </TableFilterBar>
              {filteredList.length === 0 ? (
                <div className="glass-panel rounded-xl p-8 text-center text-xs text-[var(--color-text-tertiary)]">
                  No contracts match your filters.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setContractSearch("");
                      setNetworkFilter("all");
                    }}
                    className="text-[var(--color-primary-light)] underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredList.map((c) => (
                    <div
                      key={c.id}
                      className="glass-panel rounded-xl p-5 transition-all hover:border-[var(--color-border-default)]"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode className="w-8 h-8 text-[var(--color-semantic-violet)] shrink-0" />
                          <div className="min-w-0 flex flex-col">
                            <div className="font-medium text-[var(--color-text-primary)] truncate flex items-center gap-2">
                              {c.name || c.workflowId || c.id}
                              {c.verified === true && (
                                <span title="Verified">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-semantic-success)]" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--color-text-tertiary)] font-mono truncate flex items-center gap-1.5 mt-0.5">
                              {c.address || "-"}
                              {c.address && (
                                <button
                                  onClick={() =>
                                    navigator.clipboard.writeText(c.address!)
                                  }
                                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                                  title="Copy address"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-3 mt-1.5">
                              <span className="flex items-center gap-1 bg-[var(--color-bg-hover)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
                                {c.network || "Unknown network"}
                              </span>
                              {typeof c.gasUsed === "number" && (
                                <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                                  <Fuel className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                                  Gas: {c.gasUsed.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start mt-1">
                          {c.address && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(expandedId === c.id ? null : c.id)
                              }
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
            </>
          )}
        </div>
      </div>
    </RequireApiSession>
  );
}
