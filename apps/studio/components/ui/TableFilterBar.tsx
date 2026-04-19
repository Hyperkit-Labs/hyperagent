"use client";

import { cn } from "@/lib/utils";

export function TableFilterBar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
