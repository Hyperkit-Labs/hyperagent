"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased p-8">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <button
          type="button"
          className="mt-4 underline"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
