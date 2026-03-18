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
