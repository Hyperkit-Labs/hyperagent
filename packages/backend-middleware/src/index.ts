/**
 * Shared Express middleware for HyperAgent backend services.
 * Propagates x-request-id for trace correlation.
 * Optional OTel request spans when OPENTELEMETRY_ENABLED.
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export interface RequestWithId extends Request {
  requestId?: string;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

/**
 * Injects x-request-id into req.requestId. Generates a UUID when the header
 * is missing so every request is traceable. Echoes the ID back via response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = (req.headers[REQUEST_ID_HEADER] as string)?.trim();
  const id = incoming || randomUUID();
  (req as RequestWithId).requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/**
 * Centralized internal-service auth guard.
 * In production, REFUSES all non-health requests when the token is not configured (fail-closed).
 * In development, allows passthrough when token is empty.
 */
export function requireInternalToken(token: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === "/health" || req.path === "/health/live") return next();
    if (!token) {
      if (IS_PRODUCTION) {
        res.status(503).json({ error: "Service not configured: INTERNAL_SERVICE_TOKEN missing" });
        return;
      }
      return next();
    }
    if (req.header("X-Internal-Token") === token) return next();
    res.status(401).json({ error: "Unauthorized" });
  };
}

/**
 * Wraps an async route handler so unhandled errors return a safe 500
 * with requestId, without leaking internal details to clients.
 */
export function safeHandler(
  label: string,
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => void {
  return (req: Request, res: Response) => {
    fn(req, res).catch((e: unknown) => {
      const requestId = (req as RequestWithId).requestId;
      const detail = e instanceof Error ? e.message : String(e);
      const payload = { level: "error", label, requestId, error: detail };
      try {
        process.stderr.write(JSON.stringify(payload) + "\n");
      } catch {
        process.stderr.write(`[${label}] ${detail}\n`);
      }
      if (!res.headersSent) {
        res.status(500).json({
          error: IS_PRODUCTION ? "An internal error occurred" : detail,
          requestId,
        });
      }
    });
  };
}

/**
 * Startup secrets validator. Call on boot; fails fast if any required env var is missing.
 * Logs secret names only (never values).
 */
export function validateRequiredSecrets(
  secrets: readonly string[],
  label: string,
): void {
  const missing: string[] = [];
  for (const name of secrets) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
  if (missing.length > 0) {
    const msg = `[${label}] Missing required secrets: ${missing.join(", ")}`;
    const payload = IS_PRODUCTION
      ? JSON.stringify({ level: "fatal", label, missing })
      : JSON.stringify({ level: "warn", label, missing });
    process.stderr.write(payload + "\n");
    if (IS_PRODUCTION) {
      throw new Error(msg);
    }
  }
}

/**
 * HMAC-sign a user identity header so downstream services can verify the gateway set it.
 * Uses HMAC-SHA256 with IDENTITY_HMAC_SECRET. Format: "userId.hex_signature"
 */
export function signUserId(userId: string, secret: string): string {
  if (!userId || !secret) return userId;
  const { createHmac } = require("crypto") as typeof import("crypto");
  const sig = createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

/**
 * Verify and extract the userId from a signed header. Returns the bare userId if valid, null if tampered.
 */
export function verifySignedUserId(signed: string, secret: string): string | null {
  if (!signed || !secret) return null;
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = signed.substring(0, dot);
  const sig = signed.substring(dot + 1);
  const { createHmac, timingSafeEqual } = require("crypto") as typeof import("crypto");
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  try {
    if (timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return userId;
    }
  } catch {
    return null;
  }
  return null;
}

export { otelRequestSpanMiddleware, getTraceparentHeader } from "./otel.js";
export { createLogger } from "./logger.js";
