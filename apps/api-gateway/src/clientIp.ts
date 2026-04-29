/**
 * Resolve the upstream client IP for a request.
 *
 * The gateway runs with `app.set("trust proxy", 1)` (see `index.ts`), which
 * makes Express derive `req.ip` from the left-most non-trusted-proxy address
 * in the `X-Forwarded-For` chain. Reading the raw `X-Forwarded-For` header
 * here would let an attacker mint a unique value per request and bypass any
 * IP-based control (rate limits, log sampling, audit logging).
 *
 * Always prefer `req.ip`. Fall back to the raw socket address only when
 * Express did not populate `req.ip` (e.g. exotic test harnesses without a
 * real socket). Never fall back to header-derived values.
 */
import type { Request } from "express";

export function clientRemoteIp(req: Request): string {
  if (req.ip && req.ip.length > 0) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  return "unknown";
}
