"use client";

import { cn } from "@/lib/utils";

export interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  /** Stronger blur and border (Kokonut / React Bits “fluid glass” style) */
  intensity?: "soft" | "medium" | "strong";
}

export function LiquidGlass({
  children,
  className,
  intensity = "medium",
}: LiquidGlassProps) {
  const blur =
    intensity === "soft"
      ? "backdrop-blur-md"
      : intensity === "strong"
        ? "backdrop-blur-3xl saturate-150"
        : "backdrop-blur-2xl saturate-125";
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent shadow-[0_8px_40px_rgba(0,0,0,0.35)]",
        blur,
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
        style={{
          background:
            "linear-gradient(135deg, rgba(167,139,250,0.12) 0%, transparent 45%, rgba(99,102,241,0.08) 100%)",
        }}
        aria-hidden
      />
      <div className="relative z-[1] h-full min-h-0">{children}</div>
    </div>
  );
}

/** Alias matching React Bits naming */
export const FluidGlass = LiquidGlass;
