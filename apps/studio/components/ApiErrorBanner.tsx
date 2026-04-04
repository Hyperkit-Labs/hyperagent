"use client";

import { RefreshCw } from "lucide-react";

export interface ApiErrorBannerProps {
  /** Error message to show. Renders nothing when null/empty. */
  error: string | null;
  /** Optional retry callback; when set, a Retry button is shown. */
  onRetry?: () => void;
  className?: string;
}

export function ApiErrorBanner({
  error,
  onRetry,
  className = "",
}: ApiErrorBannerProps) {
  if (!error?.trim()) return null;

  return (
    <div
      className={`rounded-xl border border-[var(--color-semantic-error)]/30 bg-[var(--color-semantic-error)]/10 px-4 py-3 text-sm text-[var(--color-semantic-error)] ${className}`}
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex-1 min-w-0 whitespace-pre-line">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-semantic-error)]/50 bg-[var(--color-semantic-error)]/20 text-[var(--color-semantic-error)] text-xs font-medium hover:bg-[var(--color-semantic-error)]/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
