-- Unified security audit stream (v1) columns + signed waiver evidence storage.

alter table public.security_audit_log
  add column if not exists schema_version text default 'security_audit_v1';

alter table public.security_audit_log
  add column if not exists service text;

alter table public.security_audit_log
  add column if not exists event_category text;

alter table public.security_audit_log
  add column if not exists run_id uuid;

alter table public.security_audit_log
  add column if not exists severity text default 'info';

create index if not exists idx_security_audit_log_service
  on public.security_audit_log(service);

create index if not exists idx_security_audit_log_event_category
  on public.security_audit_log(event_category);

create index if not exists idx_security_audit_log_run_id
  on public.security_audit_log(run_id);

create index if not exists idx_security_audit_log_schema_version
  on public.security_audit_log(schema_version);

-- Human-signed waiver evidence (HMAC or Ed25519); referenced from finding waiver.evidence_record_id
create table if not exists public.security_waiver_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  finding_id text not null,
  canonical_payload jsonb not null,
  payload_hash text not null,
  signature_algorithm text not null
    check (signature_algorithm in ('hmac-sha256', 'ed25519')),
  signature text not null,
  signer_public_key text,
  approver_id uuid not null,
  created_at timestamptz not null default now(),
  unique (run_id, finding_id, payload_hash)
);

create index if not exists idx_security_waiver_evidence_run_id
  on public.security_waiver_evidence(run_id);

create index if not exists idx_security_waiver_evidence_approver
  on public.security_waiver_evidence(approver_id);

alter table public.security_waiver_evidence enable row level security;

drop policy if exists "service_role_all_waiver_evidence" on public.security_waiver_evidence;
drop policy if exists "service_role_select_waiver_evidence" on public.security_waiver_evidence;
drop policy if exists "service_role_insert_waiver_evidence" on public.security_waiver_evidence;

create policy "service_role_all_waiver_evidence"
on public.security_waiver_evidence for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
