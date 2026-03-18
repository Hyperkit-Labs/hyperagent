"use client";

import { cn } from "@/lib/utils";

export type TimeRangeKey = "7d" | "30d" | "90d" | "all";

const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "ALL" },
];

export interface TimeRangeFilterProps {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
}

export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  return (
    <div className="flex bg-[var(--color-bg-panel)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
      {TIME_RANGES.map((tr) => (
        <button
          key={tr.key}
          type="button"
          onClick={() => onChange(tr.key)}
          className={cn(
            "px-3 py-1 text-[11px] font-medium rounded-md transition-all",
            value === tr.key
              ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          )}
        >
          {tr.label}
        </button>
      ))}
    </div>
  );
}
