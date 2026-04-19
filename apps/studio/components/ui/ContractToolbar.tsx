"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/** Dense Figma-like action strip (Kokonut toolbar pattern). */
export function ContractToolbar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-1 shadow-sm",
        className,
      )}
      role="toolbar"
      aria-label="Contract actions"
    >
      {children}
    </div>
  );
}

export function ContractToolbarButton({
  children,
  className = "",
  asChild = false,
  ...rest
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
