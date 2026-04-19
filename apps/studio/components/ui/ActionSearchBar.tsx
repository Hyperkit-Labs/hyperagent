"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionSearchBarProps {
  onClick: () => void;
  placeholder?: string;
  shortcutLabel?: string;
  className?: string;
}

/** Kokonut-style action search trigger (opens command palette). */
export function ActionSearchBar({
  onClick,
  placeholder = "Search or jump…",
  shortcutLabel = "⌘K",
  className = "",
}: ActionSearchBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full max-w-md items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/90 px-3 py-2.5 text-left text-sm text-[var(--color-text-tertiary)] shadow-sm transition-colors hover:border-[var(--color-primary-alpha-30)] hover:text-[var(--color-text-primary)]",
        className,
      )}
      aria-label="Open command palette"
    >
      <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      <span className="flex-1 truncate">{placeholder}</span>
      <kbd className="hidden sm:inline-flex h-6 items-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 font-mono text-[10px] text-[var(--color-text-muted)]">
        {shortcutLabel}
      </kbd>
    </button>
  );
}
