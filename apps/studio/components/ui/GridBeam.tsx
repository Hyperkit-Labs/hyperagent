"use client";

import { cn } from "@/lib/utils";

export interface GridBeamProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Visually stronger beam */
  emphasis?: boolean;
}

/**
 * Subtle animated gradient beam for section dividers and column splits.
 */
export function GridBeam({
  orientation = "horizontal",
  emphasis = false,
  className = "",
}: GridBeamProps) {
  const isH = orientation === "horizontal";

  return (
    <div
      className={cn(
        "pointer-events-none relative overflow-hidden rounded-full",
        isH ? "h-px w-full" : "h-full min-h-[120px] w-px shrink-0",
        emphasis ? "opacity-100" : "opacity-80",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute",
          isH
            ? "inset-y-0 left-[-35%] h-full w-[170%] animate-grid-beam-h bg-gradient-to-r from-transparent via-[var(--color-primary-mid)] to-transparent"
            : "inset-x-0 top-[-35%] h-[170%] w-full animate-grid-beam-v bg-gradient-to-b from-transparent via-[var(--color-primary-mid)] to-transparent",
          emphasis ? "opacity-100" : "",
        )}
      />
    </div>
  );
}
