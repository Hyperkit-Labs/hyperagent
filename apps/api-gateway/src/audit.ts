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
  | "byok_key_saved"
  | "byok_key_deleted"
  | "byok_key_validated"
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

function extractRequestMeta(req: Request): Pick<AuditPayload, "ip_address" | "user_agent" | "request_id"> {
  return {
    ip_address: req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress,
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

  log.info({ audit: true, ...entry }, `audit:${eventType}`);

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
