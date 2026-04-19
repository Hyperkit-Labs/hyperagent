"use client";

import { cn } from "@/lib/utils";

export function DenseFormField({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p
          id={`${id}-hint`}
          className="text-[11px] text-[var(--color-text-muted)]"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-err`}
          className="text-[11px] text-[var(--color-semantic-error)]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
