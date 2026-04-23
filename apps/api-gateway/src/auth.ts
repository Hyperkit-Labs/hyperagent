/**
 * JWT auth for gateway. Validates `Authorization: Bearer <token>` (or `rt` cookie)
 * and sets `req.userId` (sub) and `req.walletAddress`.
 *
 * Uses AUTH_JWT_SECRET (SIWE-issued tokens via `authBootstrap.ts`). Supabase Auth
 * is not used; Supabase is database-only. Auth is enforced by default
 * (REQUIRE_AUTH=true or NODE_ENV=production). Set REQUIRE_AUTH=false to disable
 * (dev only).
 *
 * Security hardening:
 *   - JWT verification is pinned to `HS256` (the algorithm used by `authBootstrap.ts`)
 *     to prevent algorithm-confusion attacks.
 *   - 401 responses include an RFC 6750 `WWW-Authenticate: Bearer` challenge and
 *     a stable machine-readable `code` field so clients can react correctly.
 *   - Failed-auth logs are consolidated into a single structured record and
 *     sampled per `(remote, outcome, path)` to resist log-flooding DoS.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  GATEWAY_DEV_ONLY_PUBLIC_PATHS,
  GATEWAY_PUBLIC_PATHS,
} from "@hyperagent/api-contracts";
import { getGatewayEnv } from "@hyperagent/config";
import { log } from "./logger.js";

export interface RequestWithUser extends Request {
  userId?: string;
  walletAddress?: string;
}

type AuthScheme = "Bearer" | "none" | "other" | "cookie";
type AuthOutcome =
  | "pass"
  | "401_missing_header"
  | "401_invalid_token"
  | "503_no_secret";

const JWT_ALGORITHMS: jwt.Algorithm[] = ["HS256"];

/** Normalize path: trim query, collapse slashes, trim trailing slash. */
function normalizePath(input: string): string {
  const noQuery = (input || "").split("?")[0];
  const collapsed = noQuery.replace(/\/+/g, "/");
  const trimmed = collapsed !== "/" ? collapsed.replace(/\/$/, "") : collapsed;
  return trimmed || "/";
}

const PUBLIC_PATHS = new Set<string>(GATEWAY_PUBLIC_PATHS);

const DEV_ONLY_PUBLIC_PATHS = new Set<string>(GATEWAY_DEV_ONLY_PUBLIC_PATHS);

function isPublicPathFromReq(req: Request): boolean {
  const candidates = [
    normalizePath(req.originalUrl || ""),
    normalizePath(req.path || ""),
    normalizePath((req.baseUrl || "") + (req.path || "")),
    normalizePath(req.url || ""),
  ];

  return candidates.some((p) => {
    if (
      p.startsWith("/auth/bootstrap/") ||
      p.startsWith("/api/v1/auth/bootstrap/")
    )
      return true;
    if (PUBLIC_PATHS.has(p)) return true;
    if (DEV_ONLY_PUBLIC_PATHS.has(p) && !getGatewayEnv().isProduction) return true;
    return false;
  });
}

function tokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const raw of parts) {
    const item = raw.trim();
    if (!item) continue;
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    const key = item.slice(0, eq).trim();
    if (key !== "rt") continue;
    const value = item.slice(eq + 1).trim();
    if (!value) return null;
    return decodeURIComponent(value);
  }
  return null;
}

function resolveJwtFromRequest(req: Request): {
  token: string | null;
  hasAuthorization: boolean;
  scheme: AuthScheme;
} {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return { token: auth.slice(7), hasAuthorization: true, scheme: "Bearer" };
  }
  const cookieHeader = (req.headers.cookie as string | undefined) || undefined;
  const cookieToken = tokenFromCookieHeader(cookieHeader);
  if (cookieToken) {
    return { token: cookieToken, hasAuthorization: false, scheme: "cookie" };
  }
  if (auth) {
    return { token: null, hasAuthorization: true, scheme: "other" };
  }
  return { token: null, hasAuthorization: false, scheme: "none" };
}

/* ------------------------------------------------------------------ */
/*  Log sampling for auth failures.                                   */
/*  Repeated failures from the same source flood logs; keep the first */
/*  N per window and emit periodic summaries for the rest.            */
/* ------------------------------------------------------------------ */
const AUTH_FAILURE_WINDOW_MS = 60_000;
const AUTH_FAILURE_MAX_PER_WINDOW = 5;
const AUTH_FAILURE_COUNTERS_MAX = 1024;
const AUTH_FAILURE_SUMMARY_EVERY = 100;

interface AuthFailureCounter {
  /** Total failures observed inside the current window. */
  count: number;
  /** Failures since the last emitted log line for this key. */
  pendingSuppressed: number;
  windowStart: number;
}

const authFailureCounters = new Map<string, AuthFailureCounter>();

function authFailureSampleDecision(
  key: string,
  now: number,
): { shouldLog: boolean; suppressed: number; resetWindow: boolean } {
  const existing = authFailureCounters.get(key);
  if (!existing || now - existing.windowStart > AUTH_FAILURE_WINDOW_MS) {
    if (authFailureCounters.size >= AUTH_FAILURE_COUNTERS_MAX) {
      // naive eviction: drop the oldest window
      let oldestKey: string | undefined;
      let oldestStart = Infinity;
      for (const [k, v] of authFailureCounters) {
        if (v.windowStart < oldestStart) {
          oldestStart = v.windowStart;
          oldestKey = k;
        }
      }
      if (oldestKey !== undefined) authFailureCounters.delete(oldestKey);
    }
    authFailureCounters.set(key, {
      count: 1,
      pendingSuppressed: 0,
      windowStart: now,
    });
    return { shouldLog: true, suppressed: 0, resetWindow: true };
  }
  existing.count += 1;
  if (existing.count <= AUTH_FAILURE_MAX_PER_WINDOW) {
    return { shouldLog: true, suppressed: 0, resetWindow: false };
  }
  existing.pendingSuppressed += 1;
  // Emit a periodic summary flush so operators still see traffic exists.
  if (existing.count % AUTH_FAILURE_SUMMARY_EVERY === 0) {
    const suppressed = existing.pendingSuppressed;
    existing.pendingSuppressed = 0;
    return { shouldLog: true, suppressed, resetWindow: false };
  }
  return { shouldLog: false, suppressed: 0, resetWindow: false };
}

/** Exposed for tests only. */
export function __resetAuthFailureCountersForTest(): void {
  authFailureCounters.clear();
}

/** Exposed for tests only. */
export function __authFailureSampleForTest(
  key: string,
  now: number = Date.now(),
): { shouldLog: boolean; suppressed: number } {
  const { shouldLog, suppressed } = authFailureSampleDecision(key, now);
  return { shouldLog, suppressed };
}

function clientRemoteKey(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!;
  return req.ip || "unknown";
}

/** Consolidated structured log for an auth decision. */
function logAuthEvent(
  req: Request,
  path: string,
  requestId: string | undefined,
  hasAuth: boolean,
  scheme: AuthScheme,
  outcome: AuthOutcome,
  status: number,
): void {
  // Skip "pass" logs in production; those are noisy and never actionable.
  if (getGatewayEnv().isProduction && outcome === "pass") return;

  const now = Date.now();
  const basePayload: Record<string, unknown> = {
    event: "auth_decision",
    outcome,
    status,
    path,
    requestId: requestId ?? null,
    hasAuthorization: hasAuth,
    authScheme: scheme,
  };

  if (outcome === "pass") {
    log.debug(basePayload, "auth decision");
    return;
  }

  // Sample failures to avoid log floods from retry loops / misconfigured clients.
  const remote = clientRemoteKey(req);
  const sampleKey = `${remote}|${outcome}|${path}`;
  const decision = authFailureSampleDecision(sampleKey, now);
  if (!decision.shouldLog) return;

  if (decision.suppressed > 0) {
    basePayload.suppressedSinceLastLog = decision.suppressed;
    basePayload.sampleWindowMs = AUTH_FAILURE_WINDOW_MS;
  }
  log.warn(basePayload, "auth decision");
}

/* ------------------------------------------------------------------ */
/*  Error responses (RFC 6750 compliant).                             */
/* ------------------------------------------------------------------ */

interface AuthErrorPayload {
  error: string;
  /** Stable machine-readable identifier for client logic. */
  code:
    | "unauthorized.missing_credential"
    | "unauthorized.invalid_token"
    | "service.auth_not_configured";
  message: string;
  requestId?: string;
}

function setWwwAuthenticate(
  res: Response,
  errorCode: "invalid_request" | "invalid_token" | "insufficient_scope" | null,
): void {
  const parts = [`Bearer realm="api-gateway"`];
  if (errorCode) parts.push(`error="${errorCode}"`);
  res.setHeader("WWW-Authenticate", parts.join(", "));
}

function respondUnauthorized(
  res: Response,
  requestId: string | undefined,
  payload: AuthErrorPayload,
  challenge: "invalid_request" | "invalid_token",
): void {
  setWwwAuthenticate(res, challenge);
  res.status(401).json({ ...payload, requestId });
}

/* ------------------------------------------------------------------ */

export function authMiddleware(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const path = normalizePath(req.originalUrl || req.path || "");
  const gw = getGatewayEnv();
  const authJwtSecret = gw.auth.jwtSecret;
  const resolved = resolveJwtFromRequest(req);

  if (isPublicPathFromReq(req)) {
    if (authJwtSecret && resolved.token) {
      try {
        const payload = jwt.verify(resolved.token, authJwtSecret, {
          algorithms: JWT_ALGORITHMS,
        }) as {
          sub?: string;
          wallet_address?: string;
        };
        if (payload?.sub) req.userId = payload.sub;
        if (
          payload?.wallet_address &&
          typeof payload.wallet_address === "string"
        ) {
          req.walletAddress = payload.wallet_address;
        }
      } catch {
        /* public path: best-effort identity only */
      }
    }
    next();
    return;
  }

  if (!authJwtSecret) {
    if (gw.auth.requireAuth) {
      logAuthEvent(req, path, requestId, false, "none", "503_no_secret", 503);
      log.fatal("Production requires AUTH_JWT_SECRET");
      res.status(503).json({
        error: "Service Unavailable",
        code: "service.auth_not_configured",
        message: "Auth not configured",
        requestId,
      });
      return;
    }
    next();
    return;
  }

  if (!resolved.token) {
    logAuthEvent(
      req,
      path,
      requestId,
      resolved.hasAuthorization,
      resolved.scheme,
      "401_missing_header",
      401,
    );
    respondUnauthorized(
      res,
      requestId,
      {
        error: "Unauthorized",
        code: "unauthorized.missing_credential",
        message: "Missing or invalid Authorization header",
      },
      "invalid_request",
    );
    return;
  }

  try {
    const payload = jwt.verify(resolved.token, authJwtSecret, {
      algorithms: JWT_ALGORITHMS,
    }) as {
      sub?: string;
      wallet_address?: string;
    };
    if (payload?.sub) {
      req.userId = payload.sub;
    }
    if (payload?.wallet_address && typeof payload.wallet_address === "string") {
      req.walletAddress = payload.wallet_address;
    }
    logAuthEvent(req, path, requestId, true, resolved.scheme, "pass", 200);
    next();
  } catch {
    logAuthEvent(
      req,
      path,
      requestId,
      true,
      resolved.scheme,
      "401_invalid_token",
      401,
    );
    respondUnauthorized(
      res,
      requestId,
      {
        error: "Unauthorized",
        code: "unauthorized.invalid_token",
        message: "Invalid or expired token",
      },
      "invalid_token",
    );
  }
}
