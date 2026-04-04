"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Suggested prompts or next steps (e.g. "Deploy an ERC20 token") */
  suggestions?: string[];
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  suggestions,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center max-w-sm mx-auto ${className}`.trim()}
      role="status"
      aria-label={`${title}. ${description}`}
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="w-14 h-14 rounded-xl bg-[var(--color-primary-alpha-10)] border border-[var(--color-primary-alpha-20)] flex items-center justify-center mb-4 text-[var(--color-primary-light)]"
      >
        {icon}
      </motion.div>
      <p className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">
        {title}
      </p>
      <p className="text-[var(--color-text-tertiary)] text-xs mb-3">
        {description}
      </p>
      {suggestions && suggestions.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Try: &quot;{suggestions[0]}&quot;
          {suggestions.length > 1 ? ` or &quot;${suggestions[1]}&quot;` : ""}
        </p>
      )}
      {action ?? null}
    </div>
  );
}
