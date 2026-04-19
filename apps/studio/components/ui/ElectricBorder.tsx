"use client";

import { cn } from "@/lib/utils";

export function ElectricBorder({
  children,
  className = "",
  active = true,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  if (!active) {
    return (
      <div
        className={cn(
          "rounded-xl border border-[var(--color-border-subtle)]",
          className,
        )}
      >
        {children}
      </div>
    );
  }
  return (
    <div className={cn("relative rounded-xl p-px overflow-hidden", className)}>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 animate-spin"
        style={{
          animationDuration: "4s",
          background:
            "conic-gradient(from 90deg, var(--color-primary-mid), var(--color-semantic-violet), var(--color-primary), var(--color-primary-mid))",
        }}
        aria-hidden
      />
      <div className="relative rounded-[11px] bg-[var(--color-bg-panel)]">
        {children}
      </div>
    </div>
  );
}
