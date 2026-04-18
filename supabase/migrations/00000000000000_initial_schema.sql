-- =============================================================================
-- Source migration: 00000000000000_baseline.sql
-- =============================================================================
-- HyperAgent baseline schema migration
-- Exported from Supabase cloud as of 2026-03-09
-- This captures the current state of all application tables.
-- Run against a fresh Supabase project to reproduce the schema.

-- =============================================================================
-- Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Core identity: wallet_users
-- =============================================================================
CREATE TABLE IF NOT EXISTS wallet_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL UNIQUE,
    auth_method TEXT NOT NULL DEFAULT 'siwe',
    encrypted_llm_keys JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_user_id UUID NOT NULL REFERENCES wallet_users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(wallet_user_id)
);

-- =============================================================================
-- Projects
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Default',
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    user_id UUID,
    wallet_user_id UUID REFERENCES wallet_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN projects.user_id IS 'Legacy auth.users.id or SUPABASE_SYSTEM_USER_ID. Prefer wallet_user_id for ownership.';
COMMENT ON COLUMN projects.wallet_user_id IS 'wallet_users.id — the canonical owner in SIWE auth.';

-- =============================================================================
-- Runs and pipeline state
-- =============================================================================
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    workflow_state JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'running',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS run_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    step_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Artifacts
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Deployments
-- =============================================================================
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    chain_id INTEGER,
    contract_address TEXT,
    tx_hash TEXT,
    network TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Simulations
-- =============================================================================
CREATE TABLE IF NOT EXISTS simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    results JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Security findings
-- =============================================================================
CREATE TABLE IF NOT EXISTS security_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    category TEXT,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Credits
-- Note: user_id here = wallet_users.id (not auth.users.id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    balance NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

COMMENT ON COLUMN user_credits.user_id IS 'wallet_users.id — maps to X-User-Id from gateway JWT.';

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL DEFAULT 0,
    tx_type TEXT NOT NULL,
    description TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN credit_transactions.user_id IS 'wallet_users.id — maps to X-User-Id from gateway JWT.';

-- =============================================================================
-- Payments
-- Note: user_id here = wallet_users.id (not auth.users.id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    reference_type TEXT,
    reference_id TEXT,
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN payment_history.user_id IS 'wallet_users.id — maps to X-User-Id from gateway JWT.';

CREATE TABLE IF NOT EXISTS spending_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    daily_limit NUMERIC,
    monthly_limit NUMERIC,
    per_tx_limit NUMERIC,
    auto_approve_below NUMERIC,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN spending_controls.user_id IS 'wallet_users.id — maps to X-User-Id from gateway JWT.';

-- =============================================================================
-- Agent context / memory
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_user_id UUID,
    user_id UUID,
    agent_name TEXT,
    context_type TEXT,
    content JSONB DEFAULT '{}',
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN agent_context.wallet_user_id IS 'wallet_users.id (SIWE).';
COMMENT ON COLUMN agent_context.user_id IS 'Legacy: same as wallet_user_id for backward compat.';

-- =============================================================================
-- Agent logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Storage records
-- =============================================================================
CREATE TABLE IF NOT EXISTS storage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_type TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes for common queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_run_steps_run_id ON run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_deployments_run_id ON deployments(run_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_run_id ON security_findings(run_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_wallet_user_id ON projects(wallet_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_context_wallet_user_id ON agent_context(wallet_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id ON agent_logs(run_id);

-- =============================================================================
-- RLS policies (enable on all tables; policies enforced per-table)
-- =============================================================================
ALTER TABLE wallet_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_records ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source migration: 00000000000001_ensure_supabase_jwt_roles.sql
-- =============================================================================
-- Ensure Supabase-style roles referenced by RLS policies exist.
-- Hosted Supabase already provides anon, authenticated, and service_role; CREATE is a no-op via exception handler.
-- Local Postgres / Docker CI need these roles before any migration runs CREATE POLICY ... TO service_role.
--
-- Idempotent: safe to re-run (duplicate_object ignored).

DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- Source migration: 20260309000001_identity_column_comments.sql
-- =============================================================================
-- Identity normalization: document that user_id in credits/payments tables
-- maps to wallet_users.id (the SIWE principal), not auth.users.id.
-- The column name user_id is kept for backward compatibility; application
-- code (credits_supabase.py, payments_supabase.py) already treats it as
-- wallet_users.id. This migration adds comments and an index for clarity.

COMMENT ON COLUMN user_credits.user_id IS 'wallet_users.id — the SIWE principal. Named user_id for backward compat.';
COMMENT ON COLUMN credit_transactions.user_id IS 'wallet_users.id — the SIWE principal.';
COMMENT ON COLUMN payment_history.user_id IS 'wallet_users.id — the SIWE principal.';
COMMENT ON COLUMN spending_controls.user_id IS 'wallet_users.id — the SIWE principal.';
COMMENT ON COLUMN projects.user_id IS 'Legacy auth.users.id or SUPABASE_SYSTEM_USER_ID. Prefer wallet_user_id for ownership.';
COMMENT ON COLUMN projects.wallet_user_id IS 'wallet_users.id — the canonical owner in SIWE auth.';
COMMENT ON COLUMN agent_context.wallet_user_id IS 'wallet_users.id (SIWE).';
COMMENT ON COLUMN agent_context.user_id IS 'Legacy: same as wallet_user_id for backward compat.';


-- =============================================================================
-- Source migration: 20260312000001_rls_backend_only_enforcement.sql
-- =============================================================================
-- RLS Backend-Only Enforcement (W-001)
-- All application tables have RLS enabled but no per-user policies.
-- The frontend MUST NOT query Supabase directly. All data access goes through
-- the API gateway and orchestrator, which use the service role key.
-- If the frontend ever uses the Supabase client, RLS will deny all operations.
-- This migration documents that design decision. No policy changes.

COMMENT ON TABLE wallet_users IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE projects IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE runs IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE project_artifacts IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE deployments IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE simulations IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE security_findings IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE user_credits IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE payment_history IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE spending_controls IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE agent_context IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';


-- =============================================================================
-- Source migration: 20260312000002_rls_complete_coverage.sql
-- =============================================================================
-- RLS Complete Coverage (W-001 Hardening)
-- Ensures ALL tables with RLS have documented backend-only enforcement.
-- Agent tables: agent_context, agent_logs.
-- Future Domain tables: When adding custom_domains or workspace_domains,
-- run: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
-- then add: COMMENT ON TABLE <table> IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';

-- Complete the set: tables with RLS that were missing from 20260312000001
COMMENT ON TABLE wallet_user_profiles IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE run_steps IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE credit_transactions IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE agent_logs IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE storage_records IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';


-- =============================================================================
-- Source migration: 20260312000003_domain_agent_tables.sql
-- =============================================================================
-- Domain and Agent tables (W-001 hardening)
-- Creates custom_domains and agent_registry for the Domains UI and agent configuration.
-- RLS enabled, no policies. Backend-only via service role.

-- =============================================================================
-- Custom domains
-- =============================================================================
CREATE TABLE IF NOT EXISTS custom_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_user_id UUID REFERENCES wallet_users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    deployment_id UUID REFERENCES deployments(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE custom_domains IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON COLUMN custom_domains.wallet_user_id IS 'wallet_users.id — the canonical owner in SIWE auth.';
COMMENT ON COLUMN custom_domains.domain IS 'Domain name (e.g. example.com).';
COMMENT ON COLUMN custom_domains.status IS 'pending | verified | failed.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_custom_domains_wallet_user_id ON custom_domains(wallet_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_project_id ON custom_domains(project_id);

ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Agent registry (user-configurable agent definitions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_user_id UUID REFERENCES wallet_users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    agent_type TEXT NOT NULL DEFAULT 'generator',
    config JSONB DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_registry IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON COLUMN agent_registry.wallet_user_id IS 'wallet_users.id — the canonical owner in SIWE auth.';
COMMENT ON COLUMN agent_registry.name IS 'Agent display name (e.g. SpecAgent, AuditAgent).';
COMMENT ON COLUMN agent_registry.agent_type IS 'generator | auditor | deployer | other.';

CREATE INDEX IF NOT EXISTS idx_agent_registry_wallet_user_id ON agent_registry(wallet_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_registry_project_id ON agent_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_registry_name ON agent_registry(name);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source migration: 20260313000001_run_steps_orchestrator_columns.sql
-- =============================================================================
-- run_steps: add columns required by orchestrator insert_step, update_step, get_steps
-- Aligns schema with db.py and live agent discussion streaming.

ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS input_summary TEXT;
ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS output_summary TEXT;
ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS trace_blob_id TEXT;
ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS trace_da_cert TEXT;
ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS trace_reference_block TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_run_steps_run_id_step_type
  ON run_steps(run_id, step_type);

COMMENT ON COLUMN run_steps.step_index IS 'Pipeline step order. Used by get_steps ordering and insert_step.';
COMMENT ON COLUMN run_steps.input_summary IS 'Human-readable input summary. Truncated to 4096 chars.';
COMMENT ON COLUMN run_steps.output_summary IS 'Human-readable output summary. Truncated to 4096 chars.';
COMMENT ON COLUMN run_steps.error_message IS 'Error message when status=failed. Truncated to 2048 chars.';
COMMENT ON COLUMN run_steps.trace_blob_id IS 'IPFS CID or stub ID for step trace provenance.';


-- =============================================================================
-- Source migration: 20260313000002_credits_atomic_rpc.sql
-- =============================================================================
-- Atomic credits RPC: consume_credits and top_up_credits
-- Prevents double-spend under concurrent workflow runs. Uses SELECT ... FOR UPDATE.

DROP FUNCTION IF EXISTS consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION consume_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'workflow_step',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(balance_after NUMERIC, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  SELECT uc.balance INTO v_balance
  FROM user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT v_balance, FALSE;
    RETURN;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE user_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id)
  VALUES (p_user_id, -p_amount, v_new_balance, 'consume', p_reference_id);

  RETURN QUERY SELECT v_new_balance, TRUE;
END;
$$;

-- Drop all overloads of top_up_credits to avoid "function name is not unique" on CREATE/COMMENT
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'top_up_credits'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION top_up_credits(
  p_user_id UUID,
  p_amount TEXT,
  p_currency TEXT DEFAULT 'USD',
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'manual',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(balance NUMERIC, currency TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  v_amount := p_amount::NUMERIC;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, p_currency;
    RETURN;
  END IF;

  INSERT INTO user_credits (user_id, balance, currency)
  VALUES (p_user_id, 0, COALESCE(p_currency, 'USD'))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.balance INTO v_balance
  FROM user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  v_new_balance := COALESCE(v_balance, 0) + v_amount;

  UPDATE user_credits
  SET balance = v_new_balance, currency = COALESCE(p_currency, 'USD'), updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id)
  VALUES (p_user_id, v_amount, v_new_balance, 'top_up', p_reference_id);

  RETURN QUERY SELECT v_new_balance, COALESCE(p_currency, 'USD');
END;
$$;

COMMENT ON FUNCTION consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) IS 'Atomic credit deduction. Locks user_credits row to prevent double-spend under concurrency.';
COMMENT ON FUNCTION top_up_credits(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) IS 'Atomic credit top-up. Locks user_credits row to avoid race conditions.';


-- =============================================================================
-- Source migration: 20260313000003_rls_service_role_explicit.sql
-- =============================================================================
-- RLS: Explicit service_role policy for BYOK and credits tables
-- Documents intent: only backend (service_role) may access. Prevents accidental
-- permissive policies from exposing these tables to authenticated/anon roles.

DROP POLICY IF EXISTS "service_role_full_access" ON wallet_users;
CREATE POLICY "service_role_full_access" ON wallet_users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON user_credits;
CREATE POLICY "service_role_full_access" ON user_credits FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON credit_transactions;
CREATE POLICY "service_role_full_access" ON credit_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE wallet_users IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE user_credits IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE credit_transactions IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';


-- =============================================================================
-- Source migration: 20260313000004_agent_logs_stage_log_level.sql
-- =============================================================================
-- agent_logs: add stage and log_level for pipeline step logging
-- db.insert_agent_log uses stage and log_level; baseline had level only

ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS log_level TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_logs' AND column_name = 'level') THEN
    UPDATE agent_logs SET log_level = COALESCE(log_level, level, 'info') WHERE log_level IS NULL AND level IS NOT NULL;
  END IF;
END $$;


-- =============================================================================
-- Source migration: 20260315000001_hardened_deployments_ownership.sql
-- =============================================================================
-- ZSPS: Link deployments to wallet_user for ownership isolation
-- When auth.uid() maps to wallet_users.id (SIWE/custom JWT), policy enforces owner-only read.

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS wallet_user_id UUID REFERENCES wallet_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deployments_wallet_user_id ON deployments(wallet_user_id);

DROP POLICY IF EXISTS "owner_read_own_deployments" ON deployments;
CREATE POLICY "owner_read_own_deployments" ON deployments
  FOR SELECT TO authenticated
  USING (wallet_user_id = auth.uid());

COMMENT ON POLICY "owner_read_own_deployments" ON deployments IS 'ZSPS: Ensures contract ownership is cryptographically tied to the active wallet user.';


-- =============================================================================
-- Source migration: 20260316000001_rls_missing_tables_service_role.sql
-- =============================================================================
-- RLS: service_role policy for run_state and extended project_artifacts
-- Ensures backend (service_role) has full access. No anon/authenticated policies.

-- run_state will be created in next migration; policy added there
-- This migration documents intent for any new tables in this batch.

COMMENT ON TABLE runs IS 'RLS enabled. workflow_state deprecated in favor of run_state + project_artifacts. Backend-only via service_role.';


-- =============================================================================
-- Source migration: 20260316000002_run_state_and_artifacts.sql
-- =============================================================================
-- run_state: small canonical runtime state (replaces full-blob workflow_state writes)
-- project_artifacts: extend with run_id, kind, storage_backend, cid, name

-- =============================================================================
-- run_state table
-- =============================================================================
CREATE TABLE IF NOT EXISTS run_state (
    run_id UUID PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
    phase TEXT NOT NULL DEFAULT 'spec',
    status TEXT NOT NULL DEFAULT 'running',
    current_step TEXT,
    checkpoint_id TEXT,
    simulation_passed BOOLEAN NOT NULL DEFAULT false,
    exploit_simulation_passed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_state_run_id ON run_state(run_id);
CREATE INDEX IF NOT EXISTS idx_run_state_status ON run_state(status);

COMMENT ON TABLE run_state IS 'Small runtime state per run. Replaces full-blob runs.workflow_state writes.';
COMMENT ON COLUMN run_state.phase IS 'Pipeline phase: spec, design, codegen, audit, simulation, deploy, ui_scaffold.';
COMMENT ON COLUMN run_state.checkpoint_id IS 'LangGraph checkpoint ID for resume.';
COMMENT ON COLUMN run_state.simulation_passed IS 'Tenderly simulation result.';
COMMENT ON COLUMN run_state.exploit_simulation_passed IS 'Exploit simulation result when enabled.';

ALTER TABLE run_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON run_state;
CREATE POLICY "service_role_full_access" ON run_state FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- project_artifacts: add columns if missing
-- =============================================================================
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES runs(id) ON DELETE CASCADE;
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS storage_backend TEXT;
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS cid TEXT;
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS ipfs_cid TEXT;

CREATE INDEX IF NOT EXISTS idx_project_artifacts_run_id ON project_artifacts(run_id);
-- Index on artifact_type (baseline) or kind; create only if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_artifacts' AND column_name = 'artifact_type') THEN
    CREATE INDEX IF NOT EXISTS idx_project_artifacts_kind ON project_artifacts(artifact_type);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_artifacts' AND column_name = 'kind') THEN
    CREATE INDEX IF NOT EXISTS idx_project_artifacts_kind ON project_artifacts(kind);
  END IF;
END $$;

COMMENT ON COLUMN project_artifacts.run_id IS 'Links artifact to run. Required for step outputs.';
COMMENT ON COLUMN project_artifacts.name IS 'Artifact display name (e.g. spec.json, Contract.sol).';
COMMENT ON COLUMN project_artifacts.storage_backend IS 'ipfs | inline. When ipfs, content may be truncated; full in cid.';
COMMENT ON COLUMN project_artifacts.cid IS 'IPFS CID when storage_backend=ipfs. Full content at this CID.';
COMMENT ON COLUMN project_artifacts.ipfs_cid IS 'Legacy alias for cid.';


-- =============================================================================
-- Source migration: 20260317000001_rls_enforce_all_tables.sql
-- =============================================================================
-- RLS enforcement: enable RLS and add explicit service_role policies for all application tables.
-- Prior migrations documented intent via COMMENTs; this migration applies the actual DDL.
-- Pattern: RLS enabled, NO public policies, backend accesses via service_role (bypasses RLS by design).

-- user_credits
ALTER TABLE IF EXISTS user_credits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON user_credits TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- credit_transactions
ALTER TABLE IF EXISTS credit_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON credit_transactions TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- spending_controls
ALTER TABLE IF EXISTS spending_controls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'spending_controls' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON spending_controls TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- storage_records
ALTER TABLE IF EXISTS storage_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'storage_records' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON storage_records TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- agent_logs
ALTER TABLE IF EXISTS agent_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_logs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON agent_logs TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- simulations
ALTER TABLE IF EXISTS simulations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'simulations' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON simulations TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- agent_context
ALTER TABLE IF EXISTS agent_context ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_context' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON agent_context TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- run_state (added in 20260316000002); only if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_state') THEN
    ALTER TABLE run_state ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'run_state' AND policyname = 'service_role_all') THEN
      CREATE POLICY service_role_all ON run_state TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- Ensure all other core tables have RLS enabled (idempotent; no-op if already set).
ALTER TABLE IF EXISTS wallet_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS security_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_history ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source migration: 20260318000001_agent_registrations.sql
-- =============================================================================
-- agent_registrations: persisted ERC-8004 registration proof
-- Stores tx hash, chain id, agent id, contract address, timestamp, source route.

CREATE TABLE IF NOT EXISTS agent_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    source_route TEXT NOT NULL DEFAULT '/api/v1/identity/register',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_registrations_chain_id ON agent_registrations(chain_id);
CREATE INDEX IF NOT EXISTS idx_agent_registrations_created_at ON agent_registrations(created_at DESC);

COMMENT ON TABLE agent_registrations IS 'Persisted ERC-8004 on-chain registration proof from POST /api/v1/identity/register';

ALTER TABLE agent_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON agent_registrations;
CREATE POLICY service_role_all ON agent_registrations TO service_role USING (true) WITH CHECK (true);


-- =============================================================================
-- Source migration: 20260318000002_bootstrap_rpcs.sql
-- =============================================================================
-- Creates RPCs referenced by api-gateway authBootstrap but previously missing from migrations.
-- bootstrap_user_credits: idempotent initial credit grant for new users.
-- upsert_spending_control: set or update a user's spending controls.
-- DROP first: CREATE OR REPLACE cannot change return type of existing function.

DROP FUNCTION IF EXISTS public.bootstrap_user_credits(uuid, numeric);
DROP FUNCTION IF EXISTS public.upsert_spending_control(uuid, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.upsert_spending_control(uuid, numeric, text, text, numeric);

CREATE OR REPLACE FUNCTION public.bootstrap_user_credits(
  p_user_id uuid,
  p_initial_credits numeric DEFAULT 50
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance, currency)
  VALUES (p_user_id, p_initial_credits, 'USD')
  ON CONFLICT (user_id) DO NOTHING;

  -- Record the initial top-up transaction only if a new row was inserted.
  IF FOUND THEN
    INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id, description)
    VALUES (
      p_user_id,
      p_initial_credits,
      p_initial_credits,
      'topup',
      'bootstrap',
      'Initial credit grant on first sign-in'
    );
  END IF;
END;
$$;

-- Matches api-gateway authBootstrap ensureWalletUserProvisioned RPC args.
CREATE OR REPLACE FUNCTION public.upsert_spending_control(
  p_user_id uuid,
  p_budget_amount numeric DEFAULT 0,
  p_budget_currency text DEFAULT 'USD',
  p_period text DEFAULT 'monthly',
  p_alert_threshold_percent numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily numeric;
  v_monthly numeric;
BEGIN
  v_daily := CASE WHEN lower(coalesce(p_period, 'monthly')) = 'daily' THEN p_budget_amount ELSE NULL END;
  v_monthly := CASE WHEN lower(coalesce(p_period, 'monthly')) = 'monthly' THEN p_budget_amount ELSE NULL END;

  INSERT INTO spending_controls (user_id, daily_limit, monthly_limit, per_tx_limit, auto_approve_below)
  VALUES (p_user_id, v_daily, v_monthly, NULL, p_alert_threshold_percent)
  ON CONFLICT (user_id) DO UPDATE SET
    daily_limit = COALESCE(EXCLUDED.daily_limit, spending_controls.daily_limit),
    monthly_limit = COALESCE(EXCLUDED.monthly_limit, spending_controls.monthly_limit),
    per_tx_limit = COALESCE(EXCLUDED.per_tx_limit, spending_controls.per_tx_limit),
    auto_approve_below = COALESCE(EXCLUDED.auto_approve_below, spending_controls.auto_approve_below),
    updated_at = now();
END;
$$;


-- =============================================================================
-- Source migration: 20260321000001_rls_complete_service_role_policies.sql
-- =============================================================================
-- Complete RLS coverage: add service_role_all policy for every table that has RLS enabled
-- but was missing an explicit service_role policy. This ensures backend access works
-- and the anon/authenticated roles (used by frontend) get zero access.
--
-- Also drops the ineffective owner_read_own_deployments policy which relies on auth.uid()
-- that is always NULL in the current gateway JWT scheme (not Supabase Auth).

-- wallet_user_profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_user_profiles' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON wallet_user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- projects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON projects FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- runs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'runs' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- run_steps
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'run_steps' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON run_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- project_artifacts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_artifacts' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON project_artifacts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- deployments: drop the ineffective auth.uid()-based policy and add service_role_all
DROP POLICY IF EXISTS "owner_read_own_deployments" ON deployments;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deployments' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON deployments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- security_findings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_findings' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON security_findings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- payment_history
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_history' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON payment_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- custom_domains
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_domains') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_domains' AND policyname = 'service_role_all') THEN
      CREATE POLICY service_role_all ON custom_domains FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- agent_registry
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_registry') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_registry' AND policyname = 'service_role_all') THEN
      CREATE POLICY service_role_all ON agent_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- Document the invariant on every table
COMMENT ON TABLE wallet_user_profiles IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE projects IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE runs IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE run_steps IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE project_artifacts IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE deployments IS 'RLS: service_role_all only. Backend-only. owner_read_own_deployments dropped (auth.uid() is NULL in gateway JWT). Frontend anon/auth roles get zero access.';
COMMENT ON TABLE security_findings IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE payment_history IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';


-- =============================================================================
-- Source migration: 20260403000001_byok_security_audit.sql
-- =============================================================================
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


-- =============================================================================
-- Source migration: 20260403000002_billing_hardening.sql
-- =============================================================================
-- Billing hardening migration: idempotency, refund support, reconciliation indices
-- Addresses findings from all_findings.md

-- 0. Ensure credit_transactions.tx_type exists (databases created before baseline alignment may lack it)
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS tx_type TEXT;

UPDATE public.credit_transactions
SET tx_type = 'adjustment'
WHERE tx_type IS NULL;

ALTER TABLE public.credit_transactions
  ALTER COLUMN tx_type SET NOT NULL;

-- 1. Add idempotency_key to payment_history for duplicate prevention
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_idempotency_key
  ON public.payment_history (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payment_history.idempotency_key IS
  'Client-provided idempotency key. When set, duplicate inserts with the same key are rejected.';

-- 2. Deduplicate credit_transactions so partial unique index can be applied
-- Retain the newest row per (user_id, reference_id, tx_type) when reference_id IS NOT NULL
DELETE FROM public.credit_transactions ct
WHERE ct.reference_id IS NOT NULL
  AND ct.id IN (
    SELECT id
    FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, reference_id, tx_type
          ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM public.credit_transactions
      WHERE reference_id IS NOT NULL
    ) d
    WHERE d.rn > 1
  );

DROP INDEX IF EXISTS public.idx_credit_transactions_reference_unique;

-- 2b. Uniqueness on credit_transactions.reference_id (per user and tx_type)
-- Prevents duplicate consumption records from retries
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_reference_unique
  ON public.credit_transactions (user_id, reference_id, tx_type)
  WHERE reference_id IS NOT NULL;

COMMENT ON INDEX idx_credit_transactions_reference_unique IS
  'Prevents duplicate credit transactions for the same reference_id and tx_type per user.';

-- 3. Add refund tx_type support (already exists in schema, ensure check constraint allows it)
-- The tx_type column should accept: top_up, consume, refund, grant, adjustment
-- Wrapped in a single DO block so DROP + ADD is atomic within the block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credit_transactions_tx_type_check'
      AND conrelid = 'public.credit_transactions'::regclass
  ) THEN
    ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_tx_type_check;
  END IF;

  ALTER TABLE public.credit_transactions
    ADD CONSTRAINT credit_transactions_tx_type_check
    CHECK (tx_type IN ('top_up', 'consume', 'refund', 'grant', 'adjustment'));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'credit_transactions_tx_type_check constraint update skipped: %', SQLERRM;
END $$;

-- 4. Add reconciliation support index on credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON public.credit_transactions (user_id, created_at);

-- 5. Add index for payment_history correlation by workflow_id in metadata
-- This enables the reconciliation job to match payments to credit transactions
CREATE INDEX IF NOT EXISTS idx_payment_history_user_status
  ON public.payment_history (user_id, status);

-- 6. Add refund tracking columns to payment_history
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS original_payment_id UUID REFERENCES public.payment_history(id),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

COMMENT ON COLUMN public.payment_history.original_payment_id IS
  'For refund records, links back to the original payment being refunded.';
COMMENT ON COLUMN public.payment_history.refund_reason IS
  'Reason for refund (queue_failure, user_request, duplicate, etc).';

-- 7. Ensure consume_credits RPC exists with current signature (atomic credit deduction).
-- The original migration (20260313000002) created this with RETURNS TABLE(balance_after, success).
-- We preserve that column order so CREATE OR REPLACE does not fail with a return-type mismatch.
-- If the function does not exist at all, the DROP is harmless and CREATE builds it fresh.
DROP FUNCTION IF EXISTS public.consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'workflow_step',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(balance_after NUMERIC, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
  v_new NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  SELECT balance INTO v_current
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  IF v_current < p_amount THEN
    RETURN QUERY SELECT v_current, FALSE;
    RETURN;
  END IF;

  v_new := v_current - p_amount;

  UPDATE user_credits
  SET balance = v_new, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id)
  VALUES (p_user_id, -p_amount, v_new, 'consume', p_reference_id);

  RETURN QUERY SELECT v_new, TRUE;
END;
$$;

COMMENT ON FUNCTION public.consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) IS
  'Atomically deduct credits with row-level locking. Returns balance_after and success flag.';


-- =============================================================================
-- Source migration: 20260403120000_storage_records_pipeline_columns.sql
-- =============================================================================
-- Align storage_records with orchestrator pipeline inserts (services/orchestrator/ipfs_client.py).
-- Safe on: (a) baseline shape with record_type/key, (b) minimal tables without those columns.

ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS storage_type TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS cid TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS gateway_url TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS artifact_id UUID;

-- Legacy columns from 00000000000000_baseline.sql — add if this database never had that baseline.
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS record_type TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'::jsonb;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Relax NOT NULL only when column exists and is still non-nullable (older baselines).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'storage_records'
      AND column_name = 'record_type'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE storage_records ALTER COLUMN record_type DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'storage_records'
      AND column_name = 'key'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE storage_records ALTER COLUMN key DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_storage_records_cid ON storage_records (cid)
  WHERE cid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_records_status_type ON storage_records (status, storage_type)
  WHERE status IS NOT NULL;

COMMENT ON COLUMN storage_records.storage_type IS
  'ipfs = pinning path in this repo. filecoin/arweave values are reserved; no deal orchestration here yet.';


-- =============================================================================
-- Source migration: 20260404120000_user_templates_ipfs_index.sql
-- =============================================================================
-- User-owned template index + immutable versions (CID pointers). Content lives on IPFS/Pinata; DB is metadata + lifecycle.
-- Aligns with storage_records + Pinata webhook reconciliation (services/orchestrator/api/storage_webhooks.py).

CREATE TABLE IF NOT EXISTS user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id UUID NOT NULL REFERENCES wallet_users (id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES user_templates (id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  cid TEXT,
  content_hash TEXT NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'template',
  pin_status TEXT NOT NULL DEFAULT 'pending',
  filecoin_status TEXT NOT NULL DEFAULT 'not_requested',
  storage_backend TEXT NOT NULL DEFAULT 'pinata',
  gateway_url TEXT,
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  size_bytes BIGINT,
  source_type TEXT NOT NULL DEFAULT 'pinata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_template_versions_cid_unique
  ON user_template_versions (cid)
  WHERE cid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_templates_wallet_status
  ON user_templates (wallet_user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_template_versions_template
  ON user_template_versions (template_id, version_number DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'user_templates'
      AND c.conname = 'fk_user_templates_current_version'
  ) THEN
    ALTER TABLE user_templates
      ADD CONSTRAINT fk_user_templates_current_version
      FOREIGN KEY (current_version_id) REFERENCES user_template_versions (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE user_templates IS 'Logical template; mutable index. Content bytes live on IPFS via CID on user_template_versions.';
COMMENT ON TABLE user_template_versions IS 'Immutable version row per content change; cid + content_hash; pin_status reconciled via webhook.';

ALTER TABLE user_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_template_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_templates' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON user_templates TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_template_versions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON user_template_versions TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;


-- =============================================================================
-- Source migration: 20260405100000_a2a_registry_erc8004.sql
-- =============================================================================
-- ERC-8004 / A2A operational index: registry agents, tasks, messages, outputs (SOA + Supabase as operational truth).
-- On-chain registry and A2A transport are authoritative for trust/transport; this stores mirrored state and pointers.

CREATE TABLE IF NOT EXISTS registry_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_service TEXT NOT NULL,
  name TEXT NOT NULL,
  registry_cid TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  chain_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  wallet_user_id UUID REFERENCES wallet_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_agents_chain_status
  ON registry_agents (chain_id, status);
CREATE INDEX IF NOT EXISTS idx_registry_agents_owner ON registry_agents (owner_service);

CREATE TABLE IF NOT EXISTS registry_agent_reputations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES registry_agents (id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  evidence_cid TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_agent_reputations_agent
  ON registry_agent_reputations (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS registry_agent_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES registry_agents (id) ON DELETE CASCADE,
  attester TEXT NOT NULL,
  type TEXT NOT NULL,
  attestation_cid TEXT,
  score_delta DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_agent_attestations_agent
  ON registry_agent_attestations (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS a2a_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT,
  run_id TEXT NOT NULL,
  capability_requested TEXT NOT NULL,
  selected_agent_id UUID REFERENCES registry_agents (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority TEXT NOT NULL DEFAULT 'normal',
  timeout_seconds INTEGER NOT NULL DEFAULT 300,
  payload_cid TEXT,
  trace_id TEXT NOT NULL,
  selection_reason TEXT,
  trust_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_tasks_run ON a2a_tasks (run_id);
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_trace ON a2a_tasks (trace_id);
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_status ON a2a_tasks (status);

CREATE TABLE IF NOT EXISTS a2a_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES a2a_tasks (id) ON DELETE CASCADE,
  sender_agent_id UUID REFERENCES registry_agents (id) ON DELETE SET NULL,
  receiver_agent_id UUID REFERENCES registry_agents (id) ON DELETE SET NULL,
  message_type TEXT NOT NULL,
  payload_cid TEXT,
  trace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  sent_at TIMESTAMPTZ,
  ack_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_messages_task ON a2a_messages (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS a2a_task_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES a2a_tasks (id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  cid TEXT,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_task_outputs_task ON a2a_task_outputs (task_id);

CREATE TABLE IF NOT EXISTS a2a_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES a2a_tasks (id) ON DELETE CASCADE,
  checkpoint_cid TEXT,
  state_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_a2a_checkpoints_task ON a2a_checkpoints (task_id, created_at DESC);

COMMENT ON TABLE registry_agents IS 'Mirrored agent registry index; ERC-8004 chain data referenced via registry_cid and chain_id.';
COMMENT ON TABLE a2a_tasks IS 'A2A task coordination state; not a substitute for on-chain trust registry.';
COMMENT ON TABLE a2a_messages IS 'A2A message envelope index; payload bytes on IPFS via payload_cid.';

ALTER TABLE registry_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_agent_reputations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_agent_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_task_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'registry_agents' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON registry_agents TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'registry_agent_reputations' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON registry_agent_reputations TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'registry_agent_attestations' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON registry_agent_attestations TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'a2a_tasks' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON a2a_tasks TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'a2a_messages' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON a2a_messages TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'a2a_task_outputs' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON a2a_task_outputs TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'a2a_checkpoints' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON a2a_checkpoints TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;


-- =============================================================================
-- Source migration: 20260406120000_security_audit_v1_waiver_evidence.sql
-- =============================================================================
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


-- =============================================================================
-- Source migration: 20260407100000_wallet_users_ensure_auth_method.sql
-- =============================================================================
-- Backfill wallet_users.auth_method when the table existed before baseline or baseline
-- was applied after a partial schema (CREATE TABLE IF NOT EXISTS does not add new columns).
-- Fixes PostgREST PGRST204: "Could not find the 'auth_method' column of 'wallet_users' in the schema cache"
ALTER TABLE public.wallet_users
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'siwe';


-- =============================================================================
-- Source migration: 20260408150000_schema_dedupe_legacy_columns.sql
-- =============================================================================
-- Centralize identity + artifact storage: drop legacy duplicate columns after backfill.
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS patterns.

-- -----------------------------------------------------------------------------
-- 1) wallet_users: auth_provider duplicated auth lane vs auth_method (gateway writes auth_method).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_users' AND column_name = 'auth_provider'
  ) THEN
    UPDATE public.wallet_users
    SET auth_method = auth_provider
    WHERE auth_provider IS NOT NULL
      AND (auth_method IS NULL OR auth_method = 'siwe');

    ALTER TABLE public.wallet_users DROP COLUMN auth_provider;
  END IF;
END $$;

COMMENT ON COLUMN public.wallet_users.auth_method IS
  'Auth lane written by api-gateway bootstrap: siwe_eoa | thirdweb_inapp (legacy siwe default upgraded on login).';

-- -----------------------------------------------------------------------------
-- 2) project_artifacts: ipfs_cid was legacy alias for cid (see 20260316000002).
-- -----------------------------------------------------------------------------
UPDATE public.project_artifacts
SET cid = COALESCE(NULLIF(TRIM(cid), ''), NULLIF(TRIM(ipfs_cid), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_artifacts' AND column_name = 'ipfs_cid'
)
AND ipfs_cid IS NOT NULL
AND (cid IS NULL OR TRIM(cid) = '');

ALTER TABLE public.project_artifacts DROP COLUMN IF EXISTS ipfs_cid;


-- =============================================================================
-- Source migration: 20260409120000_security_remediation_search_path_legacy_schema.sql
-- =============================================================================
-- Security remediation (Supabase advisors + drift cleanup)
--
-- 1) function_search_path_mutable (WARN): pin search_path on public trigger helpers so
--    they cannot be tricked via search_path injection. Applies to any matching function
--    that exists (some were created outside repo migrations).
-- 2) Legacy hyperagent schema: empty Alembic-era duplicate of concepts now in public.*.
--    No application code references PostgreSQL schema "hyperagent". Dropping removes
--    duplicate tables and clears RLS-enabled-no-policy INFO lints on that schema.
--
-- Idempotent with respect to apply-supabase-migrations.mjs (full re-run safe).

-- -----------------------------------------------------------------------------
-- A) Pin search_path on known trigger helper functions
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'update_spending_controls_updated_at',
        'update_updated_at_column'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- B) Remove legacy schema not managed by this repository
-- -----------------------------------------------------------------------------
DROP SCHEMA IF EXISTS hyperagent CASCADE;


-- =============================================================================
-- Source migration: 20260418100000_credit_transactions_amount_balance_after.sql
-- =============================================================================
-- Legacy drift: some projects have credit_transactions without amount / balance_after
-- (table predates baseline or partial apply). Reconciliation and consume_credits / top_up_credits require them.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS amount NUMERIC,
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC;

COMMENT ON COLUMN public.credit_transactions.amount IS
  'Signed delta: negative for consume, positive for top_up / grant.';
COMMENT ON COLUMN public.credit_transactions.balance_after IS
  'user_credits.balance after this transaction was applied.';

-- Backfill unknown history with zeros so NOT NULL + RPC inserts are safe.
UPDATE public.credit_transactions
SET
  amount = COALESCE(amount, 0),
  balance_after = COALESCE(balance_after, 0)
WHERE amount IS NULL OR balance_after IS NULL;

ALTER TABLE public.credit_transactions
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN balance_after SET NOT NULL;

ALTER TABLE public.credit_transactions
  ALTER COLUMN balance_after SET DEFAULT 0;


-- =============================================================================
-- Source migration: 20260419120000_credit_transactions_description_if_missing.sql
-- =============================================================================
-- Legacy drift: some databases created credit_transactions without description
-- (older schema or partial apply). Baseline and bootstrap_user_credits expect it.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.credit_transactions.description IS
  'Optional human-readable note (e.g. bootstrap grant, reconciliation backfill).';


