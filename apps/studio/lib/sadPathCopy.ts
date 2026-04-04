/**
 * User-facing copy for failure paths: plain language, one primary action, preserve-work cues.
 */

import type { ApiErrorWithStatus } from "@/lib/api";
import { messageForBootstrapCode } from "@/lib/authErrors";

export function appendRequestIdHint(
  message: string,
  requestId?: string | null,
): string {
  const id = requestId?.trim();
  if (!id) return message;
  return `${message}\n\nReference for support: ${id}`;
}

export function getErrorRequestId(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const r = err as { requestId?: string };
  return typeof r.requestId === "string" && r.requestId.trim()
    ? r.requestId.trim()
    : undefined;
}

/** GET /config bootstrap failures when JWT is still assumed valid (non-401). */
export function bootstrapConfigFailureMessage(
  status: number | undefined,
  _code: string | undefined,
  rawMessage: string,
  requestId?: string | null,
): string {
  let base: string;
  if (status === 429) {
    base =
      "Startup is being rate-limited. Your session is still valid and your work in this browser is safe. Retry in a moment.";
  } else if (status === 503) {
    base =
      "HyperAgent sign-in is not ready right now. Your workspace data in this browser is safe. Retry shortly or check status.";
  } else if (
    status === 408 ||
    (rawMessage && /abort|timed out/i.test(rawMessage))
  ) {
    base =
      "Loading workspace settings timed out. Your draft and route are safe. Check your connection and tap Retry.";
  } else if (status != null && status >= 500) {
    base =
      "We could not load workspace settings right now. Your chat draft and selections on this page are safe. Retry in a moment.";
  } else if (
    rawMessage &&
    rawMessage.length < 200 &&
    !looksLikeRawHttp(rawMessage)
  ) {
    base = `${rawMessage} Your session is unchanged; try Retry.`;
  } else {
    base =
      "We could not finish loading your workspace. Your session is still here; try Retry. If this continues, sign out and sign in again.";
  }
  return appendRequestIdHint(base, requestId);
}

function looksLikeRawHttp(s: string): boolean {
  const lower = s.toLowerCase();
  return (
    lower.includes("internal server") ||
    lower.includes("unauthorized") ||
    lower.startsWith("http ")
  );
}

export const SESSION_EXPIRED_TOAST =
  "Your session expired. Your draft in this browser is still here. Sign in again to continue.";

export const SESSION_EXPIRED_SOON_TOAST =
  "Your session is about to end. Save or send anything important, then sign in again to continue without interruption.";

export const SESSION_INVALIDATED_TOAST =
  "Your session is no longer valid. Your draft in this browser is still here. Sign in again to continue.";

const RETURN_ROUTE_HINT = " Your return route after login is saved.";

/** Wallet / bootstrap on login page (no session yet). */
export function signInFailureMessage(
  status: number | undefined,
  code: string | undefined,
  rawIn: string,
  requestId?: string | null,
): string {
  const raw = rawIn.replace(/\s*\(requestId=[^)]+\)\s*$/i, "").trim();
  if (status === 429) {
    return appendRequestIdHint(
      `Too many sign-in attempts. Wait a moment, then try again.${RETURN_ROUTE_HINT}`,
      requestId,
    );
  }
  if (status === 503 || status === 502) {
    return appendRequestIdHint(
      `Sign-in is temporarily unavailable. Please retry shortly.${RETURN_ROUTE_HINT}`,
      requestId,
    );
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("rejected the request") ||
    lower.includes("denied transaction")
  ) {
    return `Wallet signing was cancelled. Try again when you are ready.${RETURN_ROUTE_HINT}`;
  }
  if (code) {
    const mapped = messageForBootstrapCode(code, raw);
    if (mapped) {
      const withRoute = mapped.includes("return route")
        ? mapped
        : `${mapped.replace(/\s*$/, "")}${RETURN_ROUTE_HINT}`;
      return appendRequestIdHint(withRoute, requestId);
    }
  }
  if (
    lower.includes("missing or invalid authorization") ||
    lower.includes("authorization header")
  ) {
    return `Sign-in was not completed. Connect your wallet and try again.${RETURN_ROUTE_HINT}`;
  }
  if (lower.includes("invalid or expired token")) {
    return `Your wallet session expired. Reconnect and sign in again.${RETURN_ROUTE_HINT}`;
  }
  if (
    lower.includes("[schema_missing]") ||
    lower.includes("schema_missing") ||
    lower.includes("database schema") ||
    (lower.includes("wallet_users") && lower.includes("migration"))
  ) {
    return appendRequestIdHint(
      `The app database is missing required tables. Run Supabase migrations, then try again.${RETURN_ROUTE_HINT}`,
      requestId,
    );
  }
  if (lower.includes("auth not configured")) {
    return appendRequestIdHint(
      `Server sign-in is not configured (AUTH_JWT_SECRET). Ask an operator to fix the gateway.${RETURN_ROUTE_HINT}`,
      requestId,
    );
  }
  if (
    lower.includes("rate limiting required") ||
    lower.includes("rate limiting cannot authenticate") ||
    lower.includes("rate limiting unavailable") ||
    lower.includes("upstash")
  ) {
    return appendRequestIdHint(
      `The gateway cannot enforce rate limits until Upstash Redis is configured. Ask an operator.${RETURN_ROUTE_HINT}`,
      requestId,
    );
  }
  if (lower.includes("invalid signature") || lower.includes("proof")) {
    return `Your wallet proof could not be verified. Sign the message again.${RETURN_ROUTE_HINT}`;
  }
  if (lower.includes("invalid or expired thirdweb")) {
    return `Wallet session expired. Reconnect and sign in again.${RETURN_ROUTE_HINT}`;
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("load failed")
  ) {
    return appendRequestIdHint(
      `We could not reach the server. Check your connection and try again.${RETURN_ROUTE_HINT}`,
      requestId,
    );
  }
  return appendRequestIdHint(
    `We couldn't complete sign-in. Please try again.${RETURN_ROUTE_HINT}`,
    requestId,
  );
}

/** After createWorkflow or similar from home chat. */
export function workflowCreateFailureMessage(err: unknown): string {
  const requestId = getErrorRequestId(err);
  if (
    err instanceof TypeError ||
    (err instanceof Error && /failed to fetch|load failed/i.test(err.message))
  ) {
    return appendRequestIdHint(
      "We couldn't reach the server. Your draft is still here. Check your connection and try again.",
      requestId,
    );
  }
  const status = (err as ApiErrorWithStatus)?.status;
  let base: string;
  if (status === 401 || status === 403) {
    base =
      "Your session expired. Sign in again to resume. Your draft text on this page is saved in this browser until you send it.";
  } else if (status === 402) {
    base =
      "Not enough credits to start a run. Add budget in Payments, then try again. Your draft is still here.";
  } else if (status === 408) {
    base =
      "Starting the workflow timed out. Your draft is still here. Try again.";
  } else if (status === 429) {
    base =
      "Too many requests right now. Wait a moment and try again. Your draft is still here.";
  } else if (status != null && status >= 500) {
    base =
      "We couldn't create the workflow right now. Your draft is still here. Try again in a moment.";
  } else {
    base =
      "We couldn't create the workflow. Your draft is still here. Check the highlighted issues and try again.";
  }
  return appendRequestIdHint(base, requestId);
}

export const NETWORK_REGISTRY_FAILURE =
  "We couldn't load networks right now. Your current page is unchanged. Retry or refresh in a moment.";

export function networkRegistryFailureMessage(err: unknown): string {
  return appendRequestIdHint(NETWORK_REGISTRY_FAILURE, getErrorRequestId(err));
}
