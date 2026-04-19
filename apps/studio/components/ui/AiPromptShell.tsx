"use client";

import { cn } from "@/lib/utils";

export function AiPromptShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-primary-alpha-20)] bg-[var(--color-bg-panel)]/60 p-1 shadow-[0_0_0_1px_rgba(167,139,250,0.08),0_12px_40px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <div className="rounded-[14px] border border-white/5 bg-[var(--color-bg-elevated)]/40">
        {children}
      </div>
    </div>
  );
}
