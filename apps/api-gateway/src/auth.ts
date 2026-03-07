/**
 * JWT auth for gateway. Validates Authorization: Bearer <token> and sets req.userId (sub) and req.walletAddress.
 * Uses AUTH_JWT_SECRET (SIWE-issued tokens). Supabase Auth is not used; Supabase is database-only.
 * In production, AUTH_JWT_SECRET is required and auth is enforced on all /api/v1 except /health and /api/v1/auth/siwe.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface RequestWithUser extends Request {
  userId?: string;
  walletAddress?: string;
}

const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true" || NODE_ENV === "production";

function isPublicPath(path: string): boolean {
  const p = (path || "").split("?")[0];
  return p === "/health" || p === "/" || p === "" || p === "/api/v1/auth/siwe" || p === "/api/v1/config";
}

/** Trace: log auth path for protected routes so 401s can be diagnosed (missing header vs invalid token). */
function traceAuth(
  path: string,
  requestId: string | undefined,
  hasAuth: boolean,
  authScheme: "Bearer" | "none" | "other",
  outcome: "pass" | "401_missing_header" | "401_invalid_token" | "503_no_secret"
): void {
  const payload: Record<string, unknown> = {
    trace: "auth",
    path,
    requestId: requestId ?? null,
    hasAuthorization: hasAuth,
    authScheme,
    outcome,
  };
  console.warn("[auth]", JSON.stringify(payload));
}

export function authMiddleware(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void {
  const path = (req.path || "").split("?")[0];
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (isPublicPath(path)) {
    next();
    return;
  }

  if (!AUTH_JWT_SECRET) {
    if (REQUIRE_AUTH) {
      traceAuth(path, requestId, false, "none", "503_no_secret");
      logSecurityEvent("auth_failure", 503, path, requestId, undefined);
      console.error("[auth] Production requires AUTH_JWT_SECRET");
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
    const payload = jwt.verify(token, AUTH_JWT_SECRET) as { sub?: string; wallet_address?: string };
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
  console.warn("[security]", JSON.stringify(payload));
}
