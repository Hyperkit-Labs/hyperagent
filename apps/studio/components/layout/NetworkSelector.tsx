"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useNetworks } from "@/hooks/useNetworks";
import type { NetworkConfig } from "@/lib/api";

const STORAGE_KEY = "hyperkit_selected_network_id";
const PRIMARY_TIERS = ["canonical", "primary", "preferred"];

function isPrimary(net: NetworkConfig) {
  return net.tier && PRIMARY_TIERS.includes(net.tier);
}

function getStoredNetworkId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredNetworkId(id: string | null) {
  try {
    if (id == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function NetworkSelector() {
  const { networks, loading, error } = useNetworks();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NetworkConfig | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const testnets = networks.filter((n) => n.is_mainnet === false);

  const initialisedRef = useRef(false);
  useEffect(() => {
    if (networks.length === 0) return;
    const storedId = getStoredNetworkId();
    if (storedId) {
      const found = networks.find((n) => n.id === storedId || n.network_id === storedId);
      if (found) {
        setSelected(found);
        initialisedRef.current = true;
      }
    }
    if (!initialisedRef.current && testnets.length > 0) {
      const first = testnets.find(isPrimary) ?? testnets[0];
      setSelected(first);
      initialisedRef.current = true;
    }
  }, [networks, testnets]);

  const handleSelect = (net: NetworkConfig) => {
    setSelected(net);
    setStoredNetworkId(net.id ?? net.network_id ?? null);
    setOpen(false);
  };
  const popular = testnets.filter(isPrimary);
  const supported = testnets.filter((n) => !isPrimary(n));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const label = selected ? selected.name : "Select Network";

  return (
    <div className="relative hidden lg:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-panel)] border border-[var(--color-border-default)] hover:border-[var(--color-primary-alpha-30)] transition-colors group min-w-[140px] justify-between disabled:opacity-60"
      >
        <span className="flex items-center gap-2 truncate">
          {selected && (
            <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
              <span className="absolute w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full z-10" />
            </span>
          )}
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] truncate">
            {loading ? "Loading…" : error ? "Networks unavailable" : label}
          </span>
        </span>
        <ChevronDown className={`w-3 h-3 text-[var(--color-text-dim)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !loading && !error && (
        <div className="absolute top-full right-0 mt-1.5 w-72 max-h-[360px] overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xl z-50 py-2">
          {popular.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                Primary Networks
              </div>
              <ul className="px-2 pb-2">
                {popular.map((net) => (
                  <li key={net.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(net)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[13px] transition-colors ${
                        selected?.id === net.id
                          ? "bg-[var(--color-primary-alpha-10)] text-[var(--color-primary-light)] border border-[var(--color-primary-alpha-20)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-panel)]"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      {net.name ?? net.id}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {supported.length > 0 && (
            <>
              <div className="border-t border-[var(--color-border-subtle)] my-2" />
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                Supported Networks
              </div>
              <ul className="px-2 pb-2 max-h-[180px] overflow-y-auto">
                {supported.map((net) => (
                  <li key={net.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(net)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[13px] transition-colors ${
                        selected?.id === net.id
                          ? "bg-[var(--color-primary-alpha-10)] text-[var(--color-primary-light)] border border-[var(--color-primary-alpha-20)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-panel)]"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      {net.name ?? net.id}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {testnets.length === 0 && !loading && (
            <>
              <div className="border-t border-[var(--color-border-subtle)] my-2" />
              <div className="px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
                No testnets in registry.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
