"use client";

import { type ReactNode } from "react";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center max-w-sm mx-auto ${className}`.trim()}
      role="status"
      aria-label={`${title}. ${description}`}
    >
      <div className="w-14 h-14 rounded-xl bg-[var(--color-primary-alpha-10)] border border-[var(--color-primary-alpha-20)] flex items-center justify-center mb-4 text-[var(--color-primary-light)]">
        {icon}
      </div>
      <p className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">{title}</p>
      <p className="text-[var(--color-text-tertiary)] text-xs mb-5">{description}</p>
      {action ?? null}
    </div>
  );
}
