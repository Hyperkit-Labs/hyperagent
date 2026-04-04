/**
 * Central security audit event schema (v1) for gateway, orchestrator, and log shippers.
 * Rows land in Supabase public.security_audit_log with indexed columns + event_data JSONB.
 */

export const SECURITY_AUDIT_SCHEMA_VERSION = "security_audit_v1" as const;

export type SecurityAuditService = "api-gateway" | "orchestrator";

export type SecurityAuditEventCategory =
  | "auth"
  | "rate_limit"
  | "deploy"
  | "waiver"
  | "byok";

export type SecurityAuditSeverity = "info" | "warning" | "error";

export interface SecurityAuditEventV1 {
  schema_version: typeof SECURITY_AUDIT_SCHEMA_VERSION;
  service: SecurityAuditService;
  event_category: SecurityAuditEventCategory;
  event_type: string;
  severity: SecurityAuditSeverity;
  run_id?: string;
  user_id?: string;
  request_id?: string;
  payload?: Record<string, unknown>;
}

export function buildSecurityAuditEventV1(
  partial: Omit<SecurityAuditEventV1, "schema_version">
): SecurityAuditEventV1 {
  return {
    schema_version: SECURITY_AUDIT_SCHEMA_VERSION,
    ...partial,
  };
}
