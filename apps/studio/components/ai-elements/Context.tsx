"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";

export interface ContextUsage {
  /** Input tokens (prompt). */
  inputTokens?: number;
  /** Output tokens (completion). */
  outputTokens?: number;
  /** Total tokens. */
  totalTokens?: number;
  /** Optional label (e.g. model name). */
  label?: string;
}

export interface ContextProps {
  /** Token/usage breakdown. */
  usage?: ContextUsage;
  /** Optional trigger label. */
  title?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Token/context usage display. Aligns with registry Context (trigger + breakdown for BYOK usage). */
export function Context({
  usage,
  title = "Context",
  defaultOpen = false,
  children,
  className = "",
}: ContextProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasUsage =
    usage &&
    (usage.inputTokens != null ||
      usage.outputTokens != null ||
      usage.totalTokens != null);

  return (
    <div
      className={`rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <Database className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />
        <span className="text-[11px] font-medium">{title}</span>
        {usage?.label && (
          <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
            {usage.label}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--color-border-subtle)]">
          {hasUsage && usage && (
            <div className="flex flex-wrap gap-4 text-[11px] text-[var(--color-text-tertiary)] pt-2">
              {usage.inputTokens != null && (
                <span>Input: {usage.inputTokens.toLocaleString()} tokens</span>
              )}
              {usage.outputTokens != null && (
                <span>
                  Output: {usage.outputTokens.toLocaleString()} tokens
                </span>
              )}
              {usage.totalTokens != null && (
                <span>Total: {usage.totalTokens.toLocaleString()} tokens</span>
              )}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
