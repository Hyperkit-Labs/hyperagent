"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperStatus = "complete" | "current" | "upcoming";

export function StepperTrail({
  steps,
  currentIndex,
  className = "",
}: {
  steps: { id: string; label: string }[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 sm:gap-0 sm:justify-between w-full",
        className,
      )}
      aria-label="Pipeline steps"
    >
      {steps.map((s, i) => {
        let status: StepperStatus = "upcoming";
        if (i < currentIndex) status = "complete";
        else if (i === currentIndex) status = "current";
        return (
          <div
            key={s.id}
            className="flex items-center min-w-0 flex-1 sm:flex-initial"
          >
            <div className="flex flex-col items-center gap-1 min-w-[52px]">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold",
                  status === "complete" &&
                    "border-[var(--color-semantic-success)] bg-emerald-500/15 text-emerald-400",
                  status === "current" &&
                    "border-[var(--color-primary)] bg-[var(--color-primary-alpha-15)] text-[var(--color-primary-light)] animate-pulse",
                  status === "upcoming" &&
                    "border-[var(--color-border-subtle)] text-[var(--color-text-muted)]",
                )}
              >
                {status === "complete" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  i + 1
                )}
              </div>
              <span className="hidden sm:block text-[9px] uppercase tracking-wide text-[var(--color-text-muted)] truncate max-w-[72px] text-center">
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "hidden sm:block h-px flex-1 min-w-[8px] mx-1 self-start mt-[13px]",
                  i < currentIndex
                    ? "bg-[var(--color-semantic-success)]/50"
                    : "bg-[var(--color-border-subtle)]",
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
