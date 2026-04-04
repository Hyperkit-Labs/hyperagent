"use client";

import { motion } from "framer-motion";

export interface ToolEmptyStateProps {
  title: string;
  description: string;
  suggestions?: string[];
  className?: string;
}

export function ToolEmptyState({
  title,
  description,
  suggestions,
  className = "",
}: ToolEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`.trim()}
      role="status"
      aria-label={title}
    >
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-10 h-10 rounded-lg bg-[var(--color-primary-alpha-10)] border border-[var(--color-primary-alpha-20)] flex items-center justify-center mb-3"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-[var(--color-primary-light)]"
        >
          <circle
            cx="8.5"
            cy="8.5"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M13 13L17 17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      <p className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">
        {title}
      </p>
      <p className="text-[var(--color-text-tertiary)] text-xs leading-relaxed max-w-xs">
        {description}
      </p>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
          {suggestions.map((s) => (
            <span
              key={s}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
