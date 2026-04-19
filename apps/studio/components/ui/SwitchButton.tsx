"use client";

import { cn } from "@/lib/utils";

export function SwitchButton<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-1",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.id
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
