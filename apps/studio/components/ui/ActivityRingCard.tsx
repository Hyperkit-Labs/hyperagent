"use client";

import { cn } from "@/lib/utils";

export interface ActivityRingCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  /** 0–100 completion for ring */
  progress: number;
  className?: string;
}

/** Compact “activity rings” summary (Kokonut / Apple-style abstraction). */
export function ActivityRingCard({
  label,
  value,
  sublabel,
  progress,
  className = "",
}: ActivityRingCardProps) {
  const p = Math.min(100, Math.max(0, progress));
  const c = 2 * Math.PI * 16;
  const off = c * (1 - p / 100);
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4",
        className,
      )}
    >
      <div className="relative h-14 w-14 shrink-0">
        <svg className="-rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="var(--color-border-subtle)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="var(--color-primary-mid)"
            strokeWidth="3"
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[var(--color-primary-light)]">
          {Math.round(p)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
          {value}
        </p>
        {sublabel && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
