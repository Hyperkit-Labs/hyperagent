'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[GlobalError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
        An unexpected error occurred. Please try again or refresh the page.
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
        Try again
      </button>
    </div>
  );
}
