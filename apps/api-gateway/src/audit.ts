/**
 * Structured audit logging. Writes security events to the security_audit_log table in Supabase
 * and to the pino JSON log stream. Fire-and-forget to avoid blocking request flows.
 */
import type { Request } from "express";
import type { RequestWithUser } from "./auth.js";
import { getSupabaseAdmin } from "./authBootstrap.js";
import { log } from "./logger.js";

export type AuditEventType =
  | "auth_bootstrap_success"
  | "auth_bootstrap_failure"
  | "auth_token_expired"
  | "rate_limit_hit"
  | "session_revoked";

interface AuditPayload {
  event_type: AuditEventType;
  event_data?: Record<string, unknown>;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
}

/** Pino / stdout only — Supabase `security_audit_log` keeps full values. */
function maskIpForLog(ip: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    parts[3] = "0";
    return parts.join(".");
  }
  if (ip.includes(":")) return "[ipv6:redacted]";
  return ip;
}

function shortenWalletForLog(addr: string): string {
  return /^0x[a-fA-F0-9]{40}$/.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function auditPayloadForLog(entry: AuditPayload): AuditPayload {
  const out: AuditPayload = {
    ...entry,
    ip_address: entry.ip_address ? maskIpForLog(String(entry.ip_address)) : entry.ip_address,
    user_agent:
      entry.user_agent && entry.user_agent.length > 120
        ? `${entry.user_agent.slice(0, 120)}…`
        : entry.user_agent,
  };
  if (out.event_data && typeof out.event_data.wallet === "string") {
    out.event_data = { ...out.event_data, wallet: shortenWalletForLog(out.event_data.wallet) };
  }
  return out;
}

function extractRequestMeta(req: Request): Pick<AuditPayload, "ip_address" | "user_agent" | "request_id"> {
  // `req.ip` is derived from the trusted proxy chain (see `app.set("trust proxy", 1)`).
  // Reading raw `x-forwarded-for` here would let any unauthenticated client spoof
  // the audit-log IP, which defeats the point of the audit log.
  return {
    ip_address: req.ip || req.socket.remoteAddress,
    user_agent: (req.headers["user-agent"] as string) || undefined,
    request_id: (req as Request & { requestId?: string }).requestId,
  };
}

export function emitAuditEvent(
  req: Request,
  eventType: AuditEventType,
  eventData?: Record<string, unknown>,
): void {
  const userId = (req as RequestWithUser).userId;
  const meta = extractRequestMeta(req);

  const entry: AuditPayload = {
    event_type: eventType,
    event_data: eventData,
    user_id: userId,
    ...meta,
  };

  log.info({ audit: true, ...auditPayloadForLog(entry) }, `audit:${eventType}`);

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  supabase
    .from("security_audit_log")
    .insert({
      user_id: userId ?? null,
      event_type: eventType,
      event_data: eventData ?? null,
      ip_address: meta.ip_address ?? null,
      user_agent: meta.user_agent ?? null,
      request_id: meta.request_id ?? null,
    })
    .then(({ error }) => {
      if (error) log.warn({ err: error.message }, "audit log insert failed");
    });
}
