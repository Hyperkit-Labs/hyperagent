"use client";

import { cn } from "@/lib/utils";

/** Subtle dotted field (React Bits DotGrid–style) for hero backgrounds. */
export function DotGridBackground({
  className = "",
  dotSize = 1,
  gap = 20,
  color = "rgba(167, 139, 250, 0.2)",
}: {
  className?: string;
  dotSize?: number;
  gap?: number;
  color?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      aria-hidden
      style={{
        backgroundImage: `radial-gradient(circle, ${color} ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gap}px ${gap}px`,
      }}
    />
  );
}
