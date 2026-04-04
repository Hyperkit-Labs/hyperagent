"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Dot } from "lucide-react";

export type ChainOfThoughtStepStatus = "complete" | "active" | "pending";

export interface ChainOfThoughtStepProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  status?: ChainOfThoughtStepStatus;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export interface ChainOfThoughtProps {
  title?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ChainOfThoughtStep({
  label,
  description,
  status = "complete",
  icon,
  children,
}: ChainOfThoughtStepProps) {
  const statusClass =
    status === "active"
      ? "text-[var(--color-text-primary)]"
      : status === "pending"
        ? "text-[var(--color-text-muted)] opacity-60"
        : "text-[var(--color-text-tertiary)]";

  return (
    <div className="flex gap-3 py-2">
      <div className={`shrink-0 mt-0.5 ${statusClass}`}>
        {icon ?? <Dot className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-medium text-[13px] ${statusClass}`}>{label}</div>
        {description && (
          <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
            {description}
          </div>
        )}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

export function ChainOfThought({
  title = "Chain of Thought",
  defaultOpen = false,
  children,
  className = "",
}: ChainOfThoughtProps) {
  const [open, setOpen] = useState(defaultOpen);

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
        <span className="text-[11px] font-semibold">{title}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-[var(--color-border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
}
