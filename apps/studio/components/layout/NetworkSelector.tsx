"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useNetworks } from "@/hooks/useNetworks";
import { useSelectedNetwork } from "@/components/providers/SelectedNetworkProvider";
import type { NetworkConfig } from "@/lib/api";

const PRIMARY_TIERS = ["canonical", "primary", "preferred"];

function isPrimary(net: NetworkConfig) {
  return net.tier && PRIMARY_TIERS.includes(net.tier);
}

export function NetworkSelector() {
  const { networks, loading, error } = useNetworks();
  const { selectedNetworkId, setSelectedNetworkId } = useSelectedNetwork();
  const [open, setOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = "studio-network-listbox";

  const mainnets = networks.filter((n) => n.is_mainnet === true);
  const testnets = networks.filter((n) => n.is_mainnet === false);
  const selected =
    networks.find(
      (n) => n.id === selectedNetworkId || n.network_id === selectedNetworkId,
    ) ?? null;

  const handleSelect = (net: NetworkConfig) => {
    setSelectedNetworkId(net.id ?? net.network_id ?? "");
    setOpen(false);
    triggerRef.current?.focus();
  };
  const popularMain = mainnets.filter(isPrimary);
  const supportedMain = mainnets.filter((n) => !isPrimary(n));
  const popularTest = testnets.filter(isPrimary);
  const supportedTest = testnets.filter((n) => !isPrimary(n));
  const sections = [
    { id: "primary-mainnet", label: "Primary (mainnet)", items: popularMain },
    { id: "mainnet", label: "Mainnet", items: supportedMain },
    { id: "primary-testnet", label: "Primary (testnet)", items: popularTest },
    { id: "testnet", label: "Testnet", items: supportedTest },
  ].filter((section) => section.items.length > 0);
  const optionList = sections.flatMap((section) => section.items);
  const selectedIndex = Math.max(
    0,
    optionList.findIndex((net) => net.id === selected?.id),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveOptionIndex(selectedIndex);
    const timer = window.setTimeout(() => {
      optionRefs.current[selectedIndex]?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, selectedIndex]);

  const label = selected ? selected.name : "Select Network";

  function focusOption(index: number) {
    if (optionList.length === 0) return;
    const safeIndex =
      ((index % optionList.length) + optionList.length) % optionList.length;
    setActiveOptionIndex(safeIndex);
    optionRefs.current[safeIndex]?.focus();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (
            event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        disabled={loading}
        aria-label="Select network"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
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
        <ChevronDown
          className={`w-3 h-3 text-[var(--color-text-dim)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !loading && !error && (
        <div
          id={listboxId}
          className="absolute top-full right-0 mt-1.5 w-72 max-h-[360px] overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xl z-50 py-2"
          role="listbox"
          aria-label="Networks"
          onKeyDown={(event) => {
            switch (event.key) {
              case "ArrowDown":
                event.preventDefault();
                focusOption(activeOptionIndex + 1);
                break;
              case "ArrowUp":
                event.preventDefault();
                focusOption(activeOptionIndex - 1);
                break;
              case "Home":
                event.preventDefault();
                focusOption(0);
                break;
              case "End":
                event.preventDefault();
                focusOption(optionList.length - 1);
                break;
              case "Enter":
              case " ":
                event.preventDefault();
                if (optionList[activeOptionIndex]) {
                  handleSelect(optionList[activeOptionIndex]);
                }
                break;
              case "Escape":
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
                break;
              default:
                break;
            }
          }}
        >
          {sections.map((section, sectionIndex) => (
            <div key={section.id}>
              {sectionIndex > 0 ? (
                <div className="border-t border-[var(--color-border-subtle)] my-2" />
              ) : null}
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                {section.label}
              </div>
              <ul className="px-2 pb-2 max-h-[180px] overflow-y-auto">
                {section.items.map((net) => {
                  const optionIndex = optionList.findIndex(
                    (item) => item.id === net.id,
                  );
                  const isSelected = selected?.id === net.id;
                  return (
                    <li key={net.id}>
                      <button
                        ref={(node) => {
                          optionRefs.current[optionIndex] = node;
                        }}
                        type="button"
                        onClick={() => handleSelect(net)}
                        role="option"
                        tabIndex={optionIndex === activeOptionIndex ? 0 : -1}
                        aria-selected={isSelected}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[13px] transition-colors ${
                          isSelected
                            ? "bg-[var(--color-primary-alpha-10)] text-[var(--color-primary-light)] border border-[var(--color-primary-alpha-20)]"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-panel)]"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        {net.name ?? net.id}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {networks.length === 0 && !loading && (
            <>
              <div className="border-t border-[var(--color-border-subtle)] my-2" />
              <div className="px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
                No networks in registry.
              </div>
            </>
          )}
          <div className="border-t border-[var(--color-border-subtle)] mt-2 pt-2 px-3"></div>
        </div>
      )}
    </div>
  );
}
