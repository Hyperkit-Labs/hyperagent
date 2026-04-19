"use client";

import { cn } from "@/lib/utils";

export interface TeamSelectorMember {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export function TeamSelector({
  members,
  selectedId,
  onSelect,
  className = "",
}: {
  members: TeamSelectorMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="listbox"
      aria-label="Select item"
    >
      {members.map((m) => {
        const sel = selectedId === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={sel}
            onClick={() => onSelect(m.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all min-w-[140px]",
              sel
                ? "border-[var(--color-primary)] bg-[var(--color-primary-alpha-15)] shadow-[0_0_0_1px_var(--color-primary-alpha-30)]"
                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] hover:border-[var(--color-primary-alpha-30)]",
            )}
          >
            {m.icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                {m.icon}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-xs font-medium text-[var(--color-text-primary)] truncate">
                {m.label}
              </span>
              {m.sublabel && (
                <span className="block text-[10px] text-[var(--color-text-muted)] truncate">
                  {m.sublabel}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
