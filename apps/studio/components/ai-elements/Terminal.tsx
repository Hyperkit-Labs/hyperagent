'use client';

import { useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

export interface TerminalLine {
  timestamp?: string;
  level?: string;
  message: string;
}

export interface TerminalProps {
  lines: TerminalLine[];
  /** Optional: on clear (registry-style). */
  onClear?: () => void;
  className?: string;
}

function formatLine(entry: TerminalLine): string {
  const parts = [];
  if (entry.timestamp) parts.push(entry.timestamp);
  if (entry.level) parts.push(`[${entry.level}]`);
  parts.push(entry.message);
  return parts.join(' ');
}

export function Terminal({ lines, onClear, className = '' }: TerminalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = lines.map(formatLine).join('\n');
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`font-mono text-xs max-h-[500px] overflow-hidden flex flex-col bg-[var(--color-bg-base)] rounded-lg border border-[var(--color-border-subtle)] ${className}`}
      role="log"
      aria-label="Console output"
    >
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Copy output"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-semantic-success)]" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="overflow-y-auto divide-y divide-[var(--color-border-subtle)] flex-1 min-h-0">
        {lines.map((entry, i) => (
          <div
            key={i}
            className="flex items-center px-4 py-2.5 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-panel)] transition-colors log-row"
          >
            {entry.timestamp && (
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-24 shrink-0">
                {entry.timestamp}
              </span>
            )}
            {entry.level && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] mr-2 shrink-0">
                {entry.level}
              </span>
            )}
            <span className="text-[var(--color-text-secondary)] truncate flex-1 min-w-0">
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
