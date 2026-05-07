"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function TableFilterBar({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
