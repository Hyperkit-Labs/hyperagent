"use client";

import { cn } from "@/lib/utils";

export function ScrollStack({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 px-1">
          {title}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
        {children}
      </div>
    </div>
  );
}

export function ScrollStackCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "snap-start shrink-0 w-[min(280px,85vw)] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-3 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
