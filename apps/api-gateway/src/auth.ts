/**
 * JWT auth for gateway. Validates Authorization: Bearer <token> and sets req.userId (sub) and req.walletAddress.
 * Uses AUTH_JWT_SECRET (SIWE-issued tokens). Supabase Auth is not used; Supabase is database-only.
 * Auth is enforced by default (REQUIRE_AUTH=true or NODE_ENV=production). Set REQUIRE_AUTH=false to disable (dev only).
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getGatewayEnv } from "@hyperagent/config";
import { log } from "./logger.js";

export interface RequestWithUser extends Request {
  userId?: string;
  walletAddress?: string;
}

/** Normalize path: trim query, collapse slashes, trim trailing slash. */
function normalizePath(input: string): string {
  const noQuery = (input || "").split("?")[0];
  const collapsed = noQuery.replace(/\/+/g, "/");
  const trimmed = collapsed !== "/" ? collapsed.replace(/\/$/, "") : collapsed;
  return trimmed || "/";
}

const PUBLIC_PATHS = new Set([
  "/",
  "/health",
  "/health/live",
  "/api/v1/health",
  "/api/v1/health/live",
  "/auth/bootstrap",
  "/api/v1/auth/bootstrap",
  "/api/v1/config",
  "/api/v1/networks",
  "/api/v1/tokens/stablecoins",
  "/api/v1/platform/track-record",
]);

/** Dev-only paths: excluded from PUBLIC_PATHS in production to avoid leaking debug info. */
const DEV_ONLY_PUBLIC_PATHS = new Set(["/api/v1/config/integrations-debug"]);

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

/** Trace: log auth for non-pass outcomes, or all outcomes in dev. */
function traceAuth(
  path: string,
  requestId: string | undefined,
  hasAuth: boolean,
  authScheme: "Bearer" | "none" | "other",
  outcome: "pass" | "401_missing_header" | "401_invalid_token" | "503_no_secret"
): void {
  if (getGatewayEnv().isProduction && outcome === "pass") return;
  const payload: Record<string, unknown> = {
    trace: "auth",
    path,
    requestId: requestId ?? null,
    hasAuthorization: hasAuth,
    authScheme,
    outcome,
  };
  log.warn(payload, "auth trace");
}

export function authMiddleware(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const path = normalizePath(req.originalUrl || req.path || "");

  if (isPublicPathFromReq(req)) {
    next();
    return;
  }

  const gw = getGatewayEnv();
  const authJwtSecret = gw.auth.jwtSecret;
  if (!authJwtSecret) {
    if (gw.auth.requireAuth) {
      traceAuth(path, requestId, false, "none", "503_no_secret");
      logSecurityEvent("auth_failure", 503, path, requestId, undefined);
      log.fatal("Production requires AUTH_JWT_SECRET");
      res.status(503).json({ error: "Service Unavailable", message: "Auth not configured" });
      return;
    }
    next();
    return;
  }

  const auth = req.headers.authorization;
  const hasAuth = Boolean(auth);
  const authScheme: "Bearer" | "none" | "other" = !auth ? "none" : auth.startsWith("Bearer ") ? "Bearer" : "other";

  if (!auth || !auth.startsWith("Bearer ")) {
    traceAuth(path, requestId, hasAuth, authScheme, "401_missing_header");
    logSecurityEvent("auth_failure", 401, path, requestId, undefined);
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    return;
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, authJwtSecret) as { sub?: string; wallet_address?: string };
    if (payload?.sub) {
      req.userId = payload.sub;
    }
    if (payload?.wallet_address && typeof payload.wallet_address === "string") {
      req.walletAddress = payload.wallet_address;
    }
    traceAuth(path, requestId, true, "Bearer", "pass");
    next();
  } catch {
    traceAuth(path, requestId, true, "Bearer", "401_invalid_token");
    logSecurityEvent("auth_failure", 401, path, requestId, undefined);
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

function logSecurityEvent(
  event: string,
  status: number,
  path: string,
  requestId?: string,
  userId?: string
): void {
  const payload: Record<string, unknown> = { event, status, path };
  if (requestId) payload.requestId = requestId;
  if (userId) payload.userId = userId;
  log.warn(payload, "security event");
}
