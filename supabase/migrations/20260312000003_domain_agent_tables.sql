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
