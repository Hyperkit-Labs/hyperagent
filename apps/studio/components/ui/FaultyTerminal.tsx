"use client";

import { cn } from "@/lib/utils";

export function FaultyTerminal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.07] mix-blend-screen animate-fault-scan"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.15) 3px)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-30 animate-fault-flicker"
        aria-hidden
      />
      <div className="relative z-0">{children}</div>
    </div>
  );
}
