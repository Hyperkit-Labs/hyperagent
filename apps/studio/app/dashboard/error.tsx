"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Dashboard failed to load
      </h2>
      <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
        An error occurred loading the dashboard. Try refreshing or check server
        status.
        {error.digest && (
          <span className="block mt-1 font-mono text-xs opacity-60">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-[var(--color-primary-mid)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
      >
        Retry
      </button>
    </div>
  );
}
