"use client";

export const CRITICAL_ROUTE_SETTLE_TIMEOUT_MS = 5_000;

export class AsyncTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(
      `${label} did not respond within ${Math.round(timeoutMs / 1000)}s. Retry to continue.`,
    );
    this.name = "AsyncTimeoutError";
  }
}

export async function withAsyncTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new AsyncTimeoutError(label, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
