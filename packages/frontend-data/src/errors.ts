/**
 * Stable error shape for UI and logging. Use with TanStack Query `meta` or toast copy.
 */
export type NormalizedFetchError = {
  status: number | null;
  code: string;
  message: string;
  cause?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Normalize Axios, fetch failures, Response, and unknown throws into {@link NormalizedFetchError}.
 */
export function normalizeQueryError(error: unknown): NormalizedFetchError {
  if (error == null) {
    return {
      status: null,
      code: "UNKNOWN",
      message: "Unknown error",
    };
  }

  if (typeof error === "string") {
    return { status: null, code: "STRING", message: error };
  }

  if (error instanceof Error) {
    const anyErr = error as Error & {
      response?: { status?: number; data?: unknown };
      status?: number;
      code?: string;
    };

    const status =
      typeof anyErr.response?.status === "number"
        ? anyErr.response.status
        : typeof anyErr.status === "number"
          ? anyErr.status
          : null;

    const code =
      typeof anyErr.code === "string" && anyErr.code.length > 0
        ? anyErr.code
        : "ERROR";

    return {
      status,
      code,
      message: anyErr.message || "Error",
      cause: error,
    };
  }

  if (isRecord(error)) {
    const status =
      typeof error.status === "number"
        ? error.status
        : typeof error.statusCode === "number"
          ? error.statusCode
          : null;
    const message =
      typeof error.message === "string"
        ? error.message
        : typeof error.error === "string"
          ? error.error
          : "Request failed";
    const code =
      typeof error.code === "string" && error.code.length > 0
        ? error.code
        : "OBJECT";
    return { status, code, message, cause: error };
  }

  return {
    status: null,
    code: "UNHANDLED",
    message: String(error),
    cause: error,
  };
}

/**
 * Returns true when a failed request should not be retried (most 4xx except 408, 429).
 */
export function isNonRetryableClientError(error: unknown): boolean {
  const n = normalizeQueryError(error);
  if (n.status == null) return false;
  if (n.status === 408 || n.status === 429) return false;
  if (n.status >= 400 && n.status < 500) return true;
  return false;
}
