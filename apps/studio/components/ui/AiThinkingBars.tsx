"use client";

import { cn } from "@/lib/utils";

export interface AiThinkingBarsProps {
  className?: string;
  /** Number of bars (default 3) */
  count?: 3 | 4 | 5;
}

/**
 * Lightweight streaming / “thinking” indicator (Kokonut-style AI loading bars).
 * Pure CSS; no extra animation libraries.
 */
export function AiThinkingBars({
  className = "",
  count = 3,
}: AiThinkingBarsProps) {
  const heights = ["h-2", "h-3", "h-2.5", "h-3.5", "h-2"] as const;
  const delays = ["0ms", "120ms", "240ms", "160ms", "80ms"] as const;
  const n = Math.min(count, 5);

  return (
    <div
      className={cn("flex items-end justify-center gap-1.5 py-2", className)}
      role="status"
      aria-live="polite"
      aria-label="Assistant is generating a response"
    >
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-full bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-primary-light)] opacity-70 animate-pulse",
            heights[i % heights.length],
          )}
          style={{
            animationDelay: delays[i % delays.length],
            animationDuration: "0.9s",
          }}
        />
      ))}
    </div>
  );
}
