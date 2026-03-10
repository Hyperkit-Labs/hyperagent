-- HyperAgent full schema: idempotent, production-safe.
-- Single migration. Run against Supabase (or DB with auth.users + vector).
-- Skips existing tables/constraints/indexes; safe to re-run.
-- Merged from: full_schema, wallet_users, user_profile, user_api_key, projects, runs,
-- run_steps, run_steps_artifacts, agent_logs, deployments, security_findings,
-- storage_records, payment_history, spending_controls, simulations, agent_context,
-- 001_deployments_deployment_order, 20250308_agent_context_wallet_user,
-- 20250308_credits_tables_and_rpc, 20250308_run_steps_step_type, 20250308_wallet_users_plan_id,
-- 20250309_rls_policies, 20250310_wallet_users_auth_provider, 20250311_bootstrap_user_credits_rpc,
-- 20250312_production_hardening (wallet_user_profiles, drop user_api_keys).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Trigger functions (skip if exist)
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.update_spending_controls_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1. wallet_users (no deps)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_users (
  id uuid not null default gen_random_uuid(),
  wallet_address text not null,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  encrypted_llm_keys jsonb null,
  constraint wallet_users_pkey primary key (id),
  constraint wallet_users_wallet_address_key unique (wallet_address)
);
create index if not exists idx_wallet_users_wallet_address on public.wallet_users using btree (wallet_address);

-- wallet_users: plan_id (x402), auth_provider (SIWE vs thirdweb)
alter table public.wallet_users add column if not exists plan_id text null default 'free';
create index if not exists idx_wallet_users_plan_id on public.wallet_users using btree (plan_id);
comment on column public.wallet_users.plan_id is 'x402 plan id (free, starter, pro). Used by pricing/usage API.';
alter table public.wallet_users add column if not exists auth_provider text null default 'siwe_eoa';
create index if not exists idx_wallet_users_auth_provider on public.wallet_users using btree (auth_provider);
comment on column public.wallet_users.auth_provider is 'siwe_eoa | thirdweb_inapp. Used for onboarding debug and dual auth lane support.';

-- ---------------------------------------------------------------------------
-- 2. user_profiles (auth.users from Supabase)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid not null,
  wallet_address text null,
  display_name text null,
  encrypted_llm_keys jsonb null,
  preferences jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_wallet_address_key unique (wallet_address),
  constraint user_profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
);
drop trigger if exists update_user_profiles_updated_at on public.user_profiles;
create trigger update_user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. user_api_keys (dead: BYOK in wallet_users.encrypted_llm_keys) – dropped
-- ---------------------------------------------------------------------------
drop table if exists public.user_api_keys;

-- ---------------------------------------------------------------------------
-- 3b. wallet_user_profiles (wallet-native principal; replaces user_profiles for SIWE)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_user_profiles (
  wallet_user_id uuid not null,
  display_name text null,
  preferences jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  constraint wallet_user_profiles_pkey primary key (wallet_user_id),
  constraint wallet_user_profiles_wallet_user_id_fkey foreign key (wallet_user_id) references public.wallet_users (id) on delete cascade
);
create index if not exists idx_wallet_user_profiles_wallet_user_id on public.wallet_user_profiles using btree (wallet_user_id);

-- ---------------------------------------------------------------------------
-- 4. projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  name text not null,
  description text null,
  spec jsonb null,
  spec_locked_at timestamptz null,
  spec_version text null,
  status text null default 'draft',
  tags text[] null default array[]::text[],
  target_chains jsonb null,
  frameworks jsonb null,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  constraint projects_pkey primary key (id),
  constraint projects_status_check check (status = any (array['draft','spec_review','generating','auditing','simulating','ready','deployed','failed']))
);
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'auth') and exists (select 1 from pg_tables where schemaname = 'auth' and tablename = 'users')
     and not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_user_id_fkey') then
    alter table public.projects add constraint projects_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;
create index if not exists idx_projects_user_id on public.projects using btree (user_id);
create index if not exists idx_projects_status on public.projects using btree (status);
drop trigger if exists update_projects_updated_at on public.projects;
create trigger update_projects_updated_at before update on public.projects
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. runs
-- ---------------------------------------------------------------------------
create table if not exists public.runs (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  trigger text null default 'manual',
  status text null default 'pending',
  current_stage text null,
  spec_approved boolean null default false,
  workflow_version text not null,
  agent_versions jsonb null,
  stages jsonb null default '[]'::jsonb,
  error_message text null,
  chain_registry_snapshot jsonb null,
  model_registry_snapshot jsonb null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz null default now(),
  constraint runs_pkey primary key (id),
  constraint runs_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint runs_status_check check (status = any (array['pending','running','success','failed','cancelled'])),
  constraint runs_trigger_check check (trigger = any (array['manual','api','scheduled','agent']))
);
create index if not exists idx_runs_project_id on public.runs using btree (project_id);
create index if not exists idx_runs_status on public.runs using btree (status);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'runs' and column_name = 'workflow_state') then
    alter table public.runs add column workflow_state jsonb null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. project_artifacts
-- ---------------------------------------------------------------------------
create table if not exists public.project_artifacts (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  run_id uuid null,
  type text not null,
  name text not null,
  content text null,
  ipfs_cid text null,
  arweave_tx text null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  constraint project_artifacts_pkey primary key (id),
  constraint project_artifacts_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint project_artifacts_run_id_fkey foreign key (run_id) references public.runs (id) on delete set null
);
create index if not exists idx_project_artifacts_project_id on public.project_artifacts using btree (project_id);
create index if not exists idx_project_artifacts_run_id on public.project_artifacts using btree (run_id);

-- ---------------------------------------------------------------------------
-- 7. run_steps
-- ---------------------------------------------------------------------------
create table if not exists public.run_steps (
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  step_index integer not null,
  step_type text not null,
  status text not null default 'pending',
  input_summary text null,
  output_summary text null,
  error_message text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz null default now(),
  trace_blob_id text null,
  trace_da_cert text null,
  trace_reference_block text null,
  constraint run_steps_pkey primary key (id),
  constraint run_steps_run_id_fkey foreign key (run_id) references public.runs (id) on delete cascade,
  constraint run_steps_status_check check (status = any (array['pending','running','completed','failed'])),
  constraint run_steps_step_type_check check (step_type = any (array['spec','design','codegen','scrubd','audit','debate','simulation','exploit_sim','deploy','ui_scaffold','guardian']))
);
create unique index if not exists idx_run_steps_run_type on public.run_steps using btree (run_id, step_type);
create index if not exists idx_run_steps_run_id on public.run_steps using btree (run_id);
create index if not exists idx_run_steps_status on public.run_steps using btree (run_id, status);

-- run_steps: extend step_type to include test_generation (idempotent)
alter table public.run_steps drop constraint if exists run_steps_step_type_check;
alter table public.run_steps add constraint run_steps_step_type_check check (
  step_type = any (array[
    'spec'::text, 'design'::text, 'codegen'::text, 'test_generation'::text, 'scrubd'::text,
    'audit'::text, 'debate'::text, 'simulation'::text, 'exploit_sim'::text,
    'deploy'::text, 'ui_scaffold'::text, 'guardian'::text
  ])
);

-- ---------------------------------------------------------------------------
-- 8. agent_logs
-- ---------------------------------------------------------------------------
create table if not exists public.agent_logs (
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  agent_name text not null,
  stage text not null,
  log_level text null default 'info',
  message text not null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  constraint agent_logs_pkey primary key (id),
  constraint agent_logs_run_id_fkey foreign key (run_id) references public.runs (id) on delete cascade,
  constraint agent_logs_log_level_check check (log_level = any (array['debug','info','warning','error']))
);
create index if not exists idx_agent_logs_run_id on public.agent_logs using btree (run_id);

-- ---------------------------------------------------------------------------
-- 9. deployments
-- ---------------------------------------------------------------------------
create table if not exists public.deployments (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  run_id uuid null,
  chain_id integer not null,
  network_name text not null default '',
  contract_name text not null,
  contract_address text null,
  deployer_address text null,
  transaction_hash text null,
  block_number bigint null,
  verified boolean null default false,
  explorer_url text null,
  abi jsonb null,
  bytecode text null,
  created_at timestamptz null default now(),
  plan jsonb null,
  status text null default 'pending',
  constraint deployments_pkey primary key (id),
  constraint deployments_project_id_fkey foreign key (project_id) references public.projects (id) on delete cascade,
  constraint deployments_run_id_fkey foreign key (run_id) references public.runs (id) on delete set null,
  constraint deployments_status_check check (status = any (array['pending','client-deployed','deployed']))
);
create index if not exists idx_deployments_chain_address on public.deployments using btree (chain_id, contract_address);
alter table public.deployments add column if not exists deployment_order integer not null default 0;
comment on column public.deployments.deployment_order is 'Order for multi-contract deployment; lower values deploy first.';

-- ---------------------------------------------------------------------------
-- 10. security_findings
-- ---------------------------------------------------------------------------
create table if not exists public.security_findings (
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  artifact_id uuid null,
  tool text not null,
  severity text not null,
  category text null,
  title text not null,
  description text null,
  location text null,
  status text null default 'open',
  resolution_notes text null,
  created_at timestamptz null default now(),
  resolved_at timestamptz null,
  constraint security_findings_pkey primary key (id),
  constraint security_findings_artifact_id_fkey foreign key (artifact_id) references public.project_artifacts (id) on delete set null,
  constraint security_findings_run_id_fkey foreign key (run_id) references public.runs (id) on delete cascade,
  constraint security_findings_severity_check check (severity = any (array['critical','high','medium','low','info'])),
  constraint security_findings_status_check check (status = any (array['open','resolved','false_positive','accepted_risk']))
);
create index if not exists idx_security_findings_run_id on public.security_findings using btree (run_id);

-- ---------------------------------------------------------------------------
-- 11. storage_records (includes run_id, artifact_type for pipeline stage pins)
-- ---------------------------------------------------------------------------
create table if not exists public.storage_records (
  id uuid not null default gen_random_uuid(),
  artifact_id uuid null,
  run_id uuid null,
  artifact_type text null,
  storage_type text not null,
  cid text null,
  tx_id text null,
  deal_id text null,
  status text null default 'pending',
  gateway_url text null,
  created_at timestamptz null default now(),
  confirmed_at timestamptz null,
  constraint storage_records_pkey primary key (id),
  constraint storage_records_artifact_id_fkey foreign key (artifact_id) references public.project_artifacts (id) on delete cascade,
  constraint storage_records_run_id_fkey foreign key (run_id) references public.runs (id) on delete cascade,
  constraint storage_records_status_check check (status = any (array['pending','pinned','confirmed','failed'])),
  constraint storage_records_storage_type_check check (storage_type = any (array['ipfs','filecoin','arweave']))
);
create index if not exists idx_storage_records_run_id on public.storage_records using btree (run_id);
create index if not exists idx_storage_records_artifact_type on public.storage_records using btree (artifact_type);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='storage_records' and column_name='run_id') then
    alter table public.storage_records add column run_id uuid null references public.runs (id) on delete cascade;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='storage_records' and column_name='artifact_type') then
    alter table public.storage_records add column artifact_type text null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 12. payment_history
-- ---------------------------------------------------------------------------
create table if not exists public.payment_history (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(20,8) not null,
  currency text not null default 'USD',
  resource_id text null,
  endpoint text null,
  network text null,
  transaction_hash text null,
  status text not null default 'completed',
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  constraint payment_history_pkey primary key (id),
  constraint payment_history_user_id_fkey foreign key (user_id) references public.wallet_users (id) on delete cascade,
  constraint payment_history_status_check check (status = any (array['pending','completed','failed','refunded']))
);
create index if not exists idx_payment_history_user_id on public.payment_history using btree (user_id);
create index if not exists idx_payment_history_created_at on public.payment_history using btree (created_at desc);
create index if not exists idx_payment_history_user_created on public.payment_history using btree (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 13. spending_controls
-- ---------------------------------------------------------------------------
create table if not exists public.spending_controls (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  budget_amount numeric(20,8) not null default 0,
  budget_currency text not null default 'USD',
  period text not null default 'monthly',
  alert_threshold_percent integer null default 80,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  constraint spending_controls_pkey primary key (id),
  constraint spending_controls_user_id_key unique (user_id),
  constraint spending_controls_user_id_fkey foreign key (user_id) references public.wallet_users (id) on delete cascade,
  constraint spending_controls_alert_threshold_percent_check check (alert_threshold_percent >= 0 and alert_threshold_percent <= 100),
  constraint spending_controls_period_check check (period = any (array['daily','weekly','monthly']))
);
create unique index if not exists idx_spending_controls_user_id on public.spending_controls using btree (user_id);
drop trigger if exists trigger_spending_controls_updated_at on public.spending_controls;
create trigger trigger_spending_controls_updated_at before update on public.spending_controls
  for each row execute function public.update_spending_controls_updated_at();

-- ---------------------------------------------------------------------------
-- 14. simulations
-- ---------------------------------------------------------------------------
create table if not exists public.simulations (
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  network text not null,
  simulation_id text null,
  from_address text not null,
  to_address text null,
  data text null,
  value text null default '0',
  success boolean null,
  gas_used bigint null,
  traces jsonb null,
  state_diffs jsonb null,
  error_message text null,
  tenderly_url text null,
  created_at timestamptz null default now(),
  constraint simulations_pkey primary key (id),
  constraint simulations_run_id_fkey foreign key (run_id) references public.runs (id) on delete cascade
);
create index if not exists idx_simulations_run_id on public.simulations using btree (run_id);

-- ---------------------------------------------------------------------------
-- 15. agent_context (uses extensions.vector)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_context (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  context_type text not null,
  agent_name text null,
  content jsonb not null,
  embeddings extensions.vector null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  accessed_at timestamptz null default now(),
  constraint agent_context_pkey primary key (id),
  constraint agent_context_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint agent_context_context_type_check check (context_type = any (array['conversation','learning','template','pattern']))
);
create index if not exists agent_context_embeddings_idx on public.agent_context using ivfflat (embeddings extensions.vector_cosine_ops) with (lists = 100);

-- agent_context: wallet_user_id for SIWE users (no auth.users row)
alter table public.agent_context add column if not exists wallet_user_id uuid null;
alter table public.agent_context alter column user_id drop not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agent_context_wallet_user_id_fkey') then
    alter table public.agent_context add constraint agent_context_wallet_user_id_fkey
      foreign key (wallet_user_id) references public.wallet_users (id) on delete cascade;
  end if;
end $$;
create index if not exists idx_agent_context_wallet_user_id on public.agent_context using btree (wallet_user_id);
comment on column public.agent_context.wallet_user_id is 'Primary for SIWE users. Use when user_id is null. Both may be set for OAuth users with auth.users row.';

-- ---------------------------------------------------------------------------
-- 16. projects: wallet_user_id (SIWE ownership) – idempotent add
-- ---------------------------------------------------------------------------
alter table public.projects add column if not exists wallet_user_id uuid null;
alter table public.projects alter column user_id drop not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_wallet_user_id_fkey') then
    alter table public.projects add constraint projects_wallet_user_id_fkey
      foreign key (wallet_user_id) references public.wallet_users (id) on delete cascade;
  end if;
end $$;
create index if not exists idx_projects_wallet_user_id on public.projects using btree (wallet_user_id);
comment on column public.projects.wallet_user_id is 'Canonical owner (wallet_users.id). Single application principal for all ownership.';

-- ---------------------------------------------------------------------------
-- 17. user_credits (credit-based system: top-up off-chain, consume per workflow step)
-- ---------------------------------------------------------------------------
create table if not exists public.user_credits (
  user_id uuid not null,
  balance numeric(20,8) not null default 0,
  currency text not null default 'USD',
  updated_at timestamptz null default now(),
  constraint user_credits_pkey primary key (user_id),
  constraint user_credits_user_id_fkey foreign key (user_id) references public.wallet_users (id) on delete cascade,
  constraint user_credits_balance_check check (balance >= 0)
);
create unique index if not exists idx_user_credits_user_id on public.user_credits using btree (user_id);

-- ---------------------------------------------------------------------------
-- 18. credit_transactions (audit trail: top-ups and consumption)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_transactions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  amount_delta numeric(20,8) not null,
  balance_after numeric(20,8) null,
  type text not null,
  reference_id text null,
  reference_type text null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz null default now(),
  constraint credit_transactions_pkey primary key (id),
  constraint credit_transactions_user_id_fkey foreign key (user_id) references public.wallet_users (id) on delete cascade,
  constraint credit_transactions_type_check check (type in ('top_up', 'consume', 'refund', 'adjustment'))
);
create index if not exists idx_credit_transactions_user_id on public.credit_transactions using btree (user_id);
create index if not exists idx_credit_transactions_created_at on public.credit_transactions using btree (created_at desc);
create index if not exists idx_credit_transactions_reference on public.credit_transactions using btree (reference_id, reference_type);

-- ---------------------------------------------------------------------------
-- Atomic top-up: avoids race when concurrent requests add credits (read-modify-write)
-- ---------------------------------------------------------------------------
create or replace function public.top_up_credits(
  p_user_id uuid,
  p_amount numeric,
  p_currency text default 'USD',
  p_reference_id text default null,
  p_reference_type text default 'manual',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric;
begin
  insert into public.user_credits (user_id, balance, currency)
  values (p_user_id, 0, p_currency)
  on conflict (user_id) do nothing;

  update public.user_credits
  set balance = balance + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_new_balance;

  if v_new_balance is null then
    return null;
  end if;

  insert into public.credit_transactions (user_id, amount_delta, balance_after, type, reference_id, reference_type, metadata)
  values (p_user_id, p_amount, v_new_balance, 'top_up', p_reference_id, p_reference_type, coalesce(p_metadata, '{}'::jsonb));

  return jsonb_build_object('balance', v_new_balance, 'currency', p_currency, 'user_id', p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_spending_control RPC (atomic, avoids concurrent PATCH race)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_spending_control(
  p_user_id uuid,
  p_budget_amount numeric,
  p_budget_currency text default 'USD',
  p_period text default 'monthly',
  p_alert_threshold_percent integer default 80
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  insert into public.spending_controls (user_id, budget_amount, budget_currency, period, alert_threshold_percent)
  values (p_user_id, p_budget_amount, p_budget_currency, p_period, greatest(0, least(100, p_alert_threshold_percent)))
  on conflict (user_id) do update set
    budget_amount = excluded.budget_amount,
    budget_currency = excluded.budget_currency,
    period = excluded.period,
    alert_threshold_percent = excluded.alert_threshold_percent,
    updated_at = now();

  select jsonb_build_object(
    'budget_amount', budget_amount,
    'budget_currency', budget_currency,
    'period', period,
    'alert_threshold_percent', alert_threshold_percent
  ) into v_row
  from public.spending_controls
  where user_id = p_user_id;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- bootstrap_user_credits: Idempotent freemium grant on first sign-up
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_user_credits(
  p_user_id uuid,
  p_initial_credits numeric default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_currency text := 'USD';
begin
  insert into public.user_credits (user_id, balance, currency)
  values (p_user_id, greatest(0, coalesce(p_initial_credits, 100)), v_currency)
  on conflict (user_id) do nothing
  returning balance into v_balance;

  if v_balance is not null then
    insert into public.credit_transactions (
      user_id, amount_delta, balance_after, type, reference_type, reference_id, metadata
    )
    values (
      p_user_id,
      v_balance,
      v_balance,
      'top_up',
      'freemium_grant',
      'onboarding',
      jsonb_build_object('source', 'auth_bootstrap', 'plan', 'free')
    );
  end if;

  return (
    select jsonb_build_object('balance', balance, 'currency', currency, 'user_id', user_id)
    from public.user_credits
    where user_id = p_user_id
  );
end;
$$;
comment on function public.bootstrap_user_credits(uuid, numeric) is
  'Idempotent freemium credit grant on first sign-up. Called from auth bootstrap for new wallet_users.';

-- ---------------------------------------------------------------------------
-- RLS policies (multi-tenant isolation; service role bypasses)
-- wallet_users.id is the only application principal. JWT sub = wallet_users.id.
-- Policies bind to current_wallet_user_id() (from app.current_setting). Service role bypasses RLS.
-- ---------------------------------------------------------------------------
create or replace function public.current_wallet_user_id() returns uuid as $$
  select nullif(trim(current_setting('app.current_wallet_user_id', true)), '')::uuid;
$$ language sql stable security definer set search_path = public;

alter table public.wallet_users enable row level security;
alter table public.wallet_user_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.runs enable row level security;
alter table public.run_steps enable row level security;
alter table public.project_artifacts enable row level security;
alter table public.security_findings enable row level security;
alter table public.deployments enable row level security;

drop policy if exists wallet_users_select_own on public.wallet_users;
create policy wallet_users_select_own on public.wallet_users for select using (id = public.current_wallet_user_id());
drop policy if exists wallet_users_insert_own on public.wallet_users;
create policy wallet_users_insert_own on public.wallet_users for insert with check (id = public.current_wallet_user_id());
drop policy if exists wallet_users_update_own on public.wallet_users;
create policy wallet_users_update_own on public.wallet_users for update using (id = public.current_wallet_user_id());

drop policy if exists wallet_user_profiles_select_own on public.wallet_user_profiles;
create policy wallet_user_profiles_select_own on public.wallet_user_profiles for select using (wallet_user_id = public.current_wallet_user_id());
drop policy if exists wallet_user_profiles_insert_own on public.wallet_user_profiles;
create policy wallet_user_profiles_insert_own on public.wallet_user_profiles for insert with check (wallet_user_id = public.current_wallet_user_id());
drop policy if exists wallet_user_profiles_update_own on public.wallet_user_profiles;
create policy wallet_user_profiles_update_own on public.wallet_user_profiles for update using (wallet_user_id = public.current_wallet_user_id());

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects for select using (wallet_user_id = public.current_wallet_user_id());
drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects for insert with check (wallet_user_id = public.current_wallet_user_id());
drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects for update using (wallet_user_id = public.current_wallet_user_id());

drop policy if exists runs_select_via_project on public.runs;
create policy runs_select_via_project on public.runs for select using (
  exists (select 1 from public.projects p where p.id = runs.project_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists runs_insert_via_project on public.runs;
create policy runs_insert_via_project on public.runs for insert with check (
  exists (select 1 from public.projects p where p.id = runs.project_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists runs_update_via_project on public.runs;
create policy runs_update_via_project on public.runs for update using (
  exists (select 1 from public.projects p where p.id = runs.project_id and p.wallet_user_id = public.current_wallet_user_id())
);

drop policy if exists run_steps_select_via_run on public.run_steps;
create policy run_steps_select_via_run on public.run_steps for select using (
  exists (select 1 from public.runs r join public.projects p on p.id = r.project_id where r.id = run_steps.run_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists run_steps_insert_via_run on public.run_steps;
create policy run_steps_insert_via_run on public.run_steps for insert with check (
  exists (select 1 from public.runs r join public.projects p on p.id = r.project_id where r.id = run_steps.run_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists run_steps_update_via_run on public.run_steps;
create policy run_steps_update_via_run on public.run_steps for update using (
  exists (select 1 from public.runs r join public.projects p on p.id = r.project_id where r.id = run_steps.run_id and p.wallet_user_id = public.current_wallet_user_id())
);

drop policy if exists project_artifacts_select_via_project on public.project_artifacts;
create policy project_artifacts_select_via_project on public.project_artifacts for select using (
  exists (select 1 from public.projects p where p.id = project_artifacts.project_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists project_artifacts_insert_via_project on public.project_artifacts;
create policy project_artifacts_insert_via_project on public.project_artifacts for insert with check (
  exists (select 1 from public.projects p where p.id = project_artifacts.project_id and p.wallet_user_id = public.current_wallet_user_id())
);

drop policy if exists security_findings_select_via_run on public.security_findings;
create policy security_findings_select_via_run on public.security_findings for select using (
  exists (select 1 from public.runs r join public.projects p on p.id = r.project_id where r.id = security_findings.run_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists security_findings_insert_via_run on public.security_findings;
create policy security_findings_insert_via_run on public.security_findings for insert with check (
  exists (select 1 from public.runs r join public.projects p on p.id = r.project_id where r.id = security_findings.run_id and p.wallet_user_id = public.current_wallet_user_id())
);

drop policy if exists deployments_select_via_project on public.deployments;
create policy deployments_select_via_project on public.deployments for select using (
  exists (select 1 from public.projects p where p.id = deployments.project_id and p.wallet_user_id = public.current_wallet_user_id())
);
drop policy if exists deployments_insert_via_project on public.deployments;
create policy deployments_insert_via_project on public.deployments for insert with check (
  exists (select 1 from public.projects p where p.id = deployments.project_id and p.wallet_user_id = public.current_wallet_user_id())
);
