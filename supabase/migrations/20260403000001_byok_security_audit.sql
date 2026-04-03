-- Extensions
create extension if not exists pgcrypto;

-- BYOK keys: encrypted-at-rest LLM API keys per user per provider
create table if not exists public.user_byok_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wallet_users(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','google')),
  key_cipher text not null,
  key_iv text not null,
  key_salt text not null,
  key_version integer default 1,
  validated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

-- JTI denylist for JWT logout/revocation
create table if not exists public.auth_jti_denylist (
  jti text primary key,
  user_id uuid not null,
  revoked_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Structured security audit log
create table if not exists public.security_audit_log (
  id bigserial primary key,
  user_id uuid,
  event_type text not null,
  event_data jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  created_at timestamptz default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_byok_keys_updated_at on public.user_byok_keys;
create trigger trg_user_byok_keys_updated_at
before update on public.user_byok_keys
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.user_byok_keys enable row level security;
alter table public.auth_jti_denylist enable row level security;
alter table public.security_audit_log enable row level security;

-- Idempotent policies (script re-runs apply-supabase-migrations.mjs on every file)
drop policy if exists "users_select_own_byok" on public.user_byok_keys;
drop policy if exists "users_update_own_byok" on public.user_byok_keys;
drop policy if exists "users_delete_own_byok" on public.user_byok_keys;
drop policy if exists "service_role_all_byok" on public.user_byok_keys;
drop policy if exists "service_role_only_denylist" on public.auth_jti_denylist;
drop policy if exists "users_select_own_audit" on public.security_audit_log;
drop policy if exists "service_role_insert_audit" on public.security_audit_log;
drop policy if exists "service_role_select_audit" on public.security_audit_log;

-- user_byok_keys: users own their rows
create policy "users_select_own_byok"
on public.user_byok_keys for select
using (auth.uid()::text = user_id::text);

create policy "users_update_own_byok"
on public.user_byok_keys for update
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "users_delete_own_byok"
on public.user_byok_keys for delete
using (auth.uid()::text = user_id::text);

create policy "service_role_all_byok"
on public.user_byok_keys for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- auth_jti_denylist: service role only
create policy "service_role_only_denylist"
on public.auth_jti_denylist for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- audit log: users select own rows, service role inserts
create policy "users_select_own_audit"
on public.security_audit_log for select
using (auth.uid()::text = user_id::text);

create policy "service_role_insert_audit"
on public.security_audit_log for insert
with check (auth.role() = 'service_role');

create policy "service_role_select_audit"
on public.security_audit_log for select
using (auth.role() = 'service_role');

-- Indexes for query performance
create index if not exists idx_user_byok_keys_user_id on public.user_byok_keys(user_id);
create index if not exists idx_auth_jti_denylist_expires_at on public.auth_jti_denylist(expires_at);
create index if not exists idx_security_audit_log_user_id on public.security_audit_log(user_id);
create index if not exists idx_security_audit_log_event_type on public.security_audit_log(event_type);
create index if not exists idx_security_audit_log_created_at on public.security_audit_log(created_at);
