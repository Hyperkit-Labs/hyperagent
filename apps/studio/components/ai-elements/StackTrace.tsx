'use client';

import { AlertCircle } from 'lucide-react';

export interface StackTraceProps {
  /** Raw stack trace string (will be split by newlines and optionally parsed). */
  raw: string;
  /** Optional title. */
  title?: string;
  className?: string;
}

/** Parsed or raw stack trace display for run/tool errors. Aligns with registry StackTrace. */
export function StackTrace({ raw, title = 'Stack trace', className = '' }: StackTraceProps) {
  const lines = raw.trim().split('\n').filter(Boolean);

  return (
    <div
      className={`rounded-lg border border-[var(--color-semantic-error)]/30 bg-[var(--color-bg-panel)] overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-semantic-error)]/10">
        <AlertCircle className="w-4 h-4 text-[var(--color-semantic-error)] shrink-0" />
        <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">{title}</span>
      </div>
      <pre className="p-3 text-[11px] font-mono text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre-wrap break-words">
        {lines.map((line, i) => (
          <div key={i} className="leading-relaxed">
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}
