"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

export interface ReasoningProps {
  /** Duration in seconds (e.g. "thought for N seconds"). */
  durationSeconds?: number;
  /** Collapsible content (reasoning text or children). */
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Collapsible "thinking" / reasoning block. Aligns with registry Reasoning (thought for N seconds). */
export function Reasoning({
  durationSeconds,
  children,
  defaultOpen = false,
  className = "",
}: ReasoningProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <Brain className="w-4 h-4 shrink-0 text-[var(--color-semantic-violet)]" />
        <span className="text-[11px] font-medium">
          {durationSeconds != null
            ? `Thought for ${durationSeconds}s`
            : "Reasoning"}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 text-[12px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap border-t border-[var(--color-border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
}
