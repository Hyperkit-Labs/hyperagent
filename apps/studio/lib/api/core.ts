/**
 * Core API client: base URL, fetch, auth headers, error handling.
 * All backend calls go through fetchJson. Use getApiBase() for backend URL.
 */

import { isOptionalPublicApiPathForLogging } from "@hyperagent/api-contracts";
import { getServiceUrl } from "@/config/environment";
import { getStoredSession } from "@/lib/session-store";

export const getApiBase = (): string =>
  getServiceUrl("backend").replace(/\/$/, "");

/** Gateway origin (scheme + host + port) for bootstrap. */
export const getGatewayOrigin = (): string => {
  const base = getApiBase();
  return base.replace(/\/api\/v1\/?$/, "") || base;
};

const API_V1_SUFFIX = "/api/v1";

/** Join `getApiBase()` (…/api/v1) with a path. Accepts `/resource` or `/api/v1/resource` without duplicating the prefix. */
export function joinApiUrlForFetch(baseUrl: string, path: string): string {
  const b = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (b.endsWith(API_V1_SUFFIX) && p.startsWith(API_V1_SUFFIX)) {
    return `${b}${p.slice(API_V1_SUFFIX.length)}`;
  }
  return `${b}${p}`;
}

/** URL for API reference (Swagger UI). */
export const getDocsUrl = (): string => {
  const env =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_DOCS_URL;
  const url = (env && typeof env === "string" ? env.trim() : "") || "";
  if (url) return url.replace(/\/$/, "");
  const apiBase = getApiBase();
  const root = apiBase.replace(/\/api\/v1\/?$/, "");
  return root ? `${root}/docs` : `${apiBase}/../docs`;
};

function readPublicTimeoutMs(envName: string, fallbackMs: number): number {
  if (typeof process === "undefined") return fallbackMs;
  const raw = process.env[envName]?.trim();
  if (!raw) return fallbackMs;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallbackMs;
}

/** Request timeout (ms). Override with `NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS`. */
const API_REQUEST_TIMEOUT_MS = readPublicTimeoutMs(
  "NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS",
  10_000,
);

/** BYOK (Settings llm-keys). Override with `NEXT_PUBLIC_BYOK_REQUEST_TIMEOUT_MS`. */
export const BYOK_REQUEST_TIMEOUT_MS = readPublicTimeoutMs(
  "NEXT_PUBLIC_BYOK_REQUEST_TIMEOUT_MS",
  35_000,
);

/** GET /api/v1/config bootstrap. Override with `NEXT_PUBLIC_CONFIG_BOOTSTRAP_TIMEOUT_MS`. */
export const CONFIG_BOOTSTRAP_TIMEOUT_MS = readPublicTimeoutMs(
  "NEXT_PUBLIC_CONFIG_BOOTSTRAP_TIMEOUT_MS",
  45_000,
);

export const API_UNREACHABLE_MESSAGE =
  "Backend unreachable. Check that the API is running and NEXT_PUBLIC_API_URL is correct.";

export const AUTH_ERROR_MESSAGE =
  "Session expired or not signed in. Please sign in again.";

type AuthHeaderProvider = () => Promise<Record<string, string>>;
let authHeaderProvider: AuthHeaderProvider | null = null;

export function setAuthHeaderProvider(
  provider: AuthHeaderProvider | null,
): void {
  authHeaderProvider = provider;
}

type On401Callback = () => void;
let on401Callback: On401Callback | null = null;

export function setOn401Callback(callback: On401Callback | null): void {
  on401Callback = callback;
}

export function isAbortError(
  error: unknown,
): error is Error & { name: "AbortError" } {
  return error instanceof Error && error.name === "AbortError";
}

export function getErrorMessage(
  error: unknown,
  fallback = "Request failed",
): string {
  const GENERIC = [
    "an error occurred.",
    "an error occurred",
    "something went wrong",
    "failed to fetch",
  ];
  function isGeneric(s: string): boolean {
    const lower = s.toLowerCase();
    return GENERIC.some((g) => lower === g || lower.startsWith(g));
  }
  const status = (error as ApiErrorWithStatus)?.status;
  if (status !== undefined && STATUS_MESSAGES[status])
    return STATUS_MESSAGES[status];
  if (error instanceof Error) {
    const msg = error.message?.trim() || "";
    if (!msg || isGeneric(msg)) return fallback;
    return msg;
  }
  if (typeof error === "string") {
    const s = (error as string).trim();
    if (!s || isGeneric(s)) return fallback;
    return s;
  }
  return fallback;
}

export interface ApiErrorWithStatus extends Error {
  status?: number;
  code?: string;
  requestId?: string;
}

export interface NormalizeApiErrorOptions {
  wasTimeout?: boolean;
  status?: number;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Invalid request. Check your input and try again.",
  401: AUTH_ERROR_MESSAGE,
  402: "Payment required. Connect a wallet or add budget in Settings to continue.",
  403: "Access denied. You may not have permission for this action.",
  404: "Resource not found. It may have been removed or the link is outdated.",
  408: "Request timed out. Try again when the server is less busy.",
  429: "Too many requests. Wait a moment and try again.",
  500: "Server error. Our team has been notified. Please try again later.",
  502: "Backend unavailable. Check status or try again in a few minutes.",
  503: "Service temporarily unavailable. Please try again shortly.",
};

export function normalizeApiError(
  error: unknown,
  opts?: NormalizeApiErrorOptions,
): string {
  const status = opts?.status ?? (error as ApiErrorWithStatus)?.status;
  if (status !== undefined && STATUS_MESSAGES[status])
    return STATUS_MESSAGES[status];
  if (error instanceof Error) {
    if (isAbortError(error)) {
      return opts?.wasTimeout
        ? "Backend request timed out. Ensure the API is running and NEXT_PUBLIC_API_URL (or backend) is reachable."
        : "Request was cancelled.";
    }
    if (error instanceof TypeError || error.message === "Failed to fetch")
      return API_UNREACHABLE_MESSAGE;
    return error.message;
  }
  if (typeof error === "string") return error;
  return "Request failed. Please try again.";
}

export function reportApiError(
  error: unknown,
  context: { path?: string; [key: string]: unknown },
): void {
  if (isAbortError(error)) return;
  const path = context?.path;
  const isNetworkError =
    error instanceof TypeError &&
    (error.message === "Failed to fetch" || error.message === "Load failed");
  if (isOptionalPublicApiPathForLogging(path) && isNetworkError) {
    // Avoid noisy console on login when the API is down; still surface in dev.
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "production" &&
      typeof console !== "undefined" &&
      console.debug
    ) {
      console.debug(
        "[API] optional public path unreachable (network)",
        path,
        error instanceof Error ? error.message : error,
      );
    }
    return;
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (typeof console !== "undefined" && console.error) {
    console.error("[API]", msg, context);
  }
}

export interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
  /**
   * When true, invoke global on401Callback on 401 (clear session + redirect).
   * Default false: transport stays passive; SessionProvider and explicit callers own auth UX.
   */
  invokeGlobal401OnUnauthorized?: boolean;
  /** @deprecated Use omit invokeGlobal401OnUnauthorized instead. When true, blocks global 401 even if invoke flag is set. */
  suppressOn401?: boolean;
}

let _apiBaseLogged = false;

/**
 * Same as fetchJson but opts into global 401 handling (logout + redirect) for authenticated API calls.
 */
export async function fetchJsonAuthed<T>(
  path: string,
  options?: FetchJsonOptions,
): Promise<T> {
  return fetchJson<T>(path, {
    ...options,
    invokeGlobal401OnUnauthorized: true,
  });
}

export async function fetchJson<T>(
  path: string,
  options?: FetchJsonOptions,
): Promise<T> {
  const { timeoutMs, suppressOn401, invokeGlobal401OnUnauthorized, ...init } =
    options ?? {};
  const shouldFireGlobal401 =
    invokeGlobal401OnUnauthorized === true && suppressOn401 !== true;
  const timeout = timeoutMs ?? API_REQUEST_TIMEOUT_MS;
  const maxRetries = 3;
  const retryDelay = 1000;
  let lastError: Error | null = null;
  const base = () => getApiBase();

  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "development" &&
    !_apiBaseLogged
  ) {
    _apiBaseLogged = true;
    console.log("[API] base=", base(), "path=", path);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let authHeaders: Record<string, string> = {};
      try {
        if (authHeaderProvider) {
          authHeaders = await authHeaderProvider();
        } else if (typeof window !== "undefined") {
          const session = getStoredSession();
          if (session?.access_token) {
            authHeaders = { Authorization: `Bearer ${session.access_token}` };
          }
        }
      } catch (authErr) {
        reportApiError(authErr, { path, context: "authHeaderProvider" });
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(joinApiUrlForFetch(base(), path), {
        ...init,
        signal: init.signal ?? controller.signal,
        credentials: "include",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          ...(init.headers as Record<string, string>),
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        let message = errorText || `HTTP ${res.status}: ${res.statusText}`;
        let apiCode: string | undefined;
        try {
          const j = JSON.parse(errorText) as {
            message?: string;
            error?: string;
            code?: string;
            detail?: string | Array<{ msg?: string }>;
          };
          if (typeof j.message === "string") message = j.message;
          else if (typeof j.error === "string") message = j.error;
          else if (typeof j.detail === "string") message = j.detail;
          else if (
            Array.isArray(j.detail) &&
            j.detail.length > 0 &&
            typeof j.detail[0]?.msg === "string"
          )
            message = j.detail[0].msg;
          if (typeof j.code === "string") apiCode = j.code;
        } catch {
          // keep message as errorText
        }
        const error = new Error(message) as ApiErrorWithStatus & {
          code?: string;
        };
        error.status = res.status;
        if (apiCode) error.code = apiCode;
        const requestId =
          res.headers.get("X-Request-Id") ??
          res.headers.get("x-request-id") ??
          (() => {
            try {
              const j = JSON.parse(errorText);
              return (
                (j as { requestId?: string }).requestId ??
                (j as { request_id?: string }).request_id
              );
            } catch {
              return undefined;
            }
          })();
        if (requestId) error.requestId = requestId;
        if (
          process.env.NODE_ENV === "development" &&
          typeof console !== "undefined"
        ) {
          console.warn(`[API] ${path} → ${res.status}`, message.slice(0, 80));
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 408) {
          if (res.status === 401 && on401Callback && shouldFireGlobal401) {
            try {
              on401Callback();
            } catch {
              // ignore
            }
          }
          reportApiError(error, { path, status: res.status });
          throw error;
        }
        if (attempt < maxRetries - 1) {
          lastError = error;
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (attempt + 1)),
          );
          continue;
        }
        reportApiError(error, { path, status: res.status });
        throw error;
      }

      return res.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (
          process.env.NODE_ENV === "development" &&
          typeof console !== "undefined" &&
          !init.signal
        ) {
          console.warn(`[API] ${path} → timeout after ${timeout}ms`);
        }
        throw error;
      }
      if (attempt < maxRetries - 1 && error instanceof TypeError) {
        lastError = error as Error;
        if (
          typeof process !== "undefined" &&
          process.env.NODE_ENV !== "production" &&
          typeof console !== "undefined" &&
          console.debug
        ) {
          console.debug(
            "[API] retry after transport error",
            path,
            `attempt ${attempt + 1}/${maxRetries}`,
            error.message,
          );
        }
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1)),
        );
        continue;
      }
      const normalized = new Error(normalizeApiError(error));
      reportApiError(error, { path });
      throw normalized;
    }
  }

  const final = lastError
    ? new Error(normalizeApiError(lastError))
    : new Error("Request failed after retries");
  reportApiError(lastError ?? final, { path });
  throw final;
}

export function handleApiError(error: unknown): string {
  return normalizeApiError(error);
}

export function isAuthError(message: string): boolean {
  return (
    message === AUTH_ERROR_MESSAGE ||
    message.includes("401") ||
    message.includes("Unauthorized")
  );
}

export function isCreditsError(error: unknown): boolean {
  return (error as ApiErrorWithStatus)?.status === 402;
}
