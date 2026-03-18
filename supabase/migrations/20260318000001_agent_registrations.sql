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
CREATE POLICY service_role_all ON agent_registrations TO service_role USING (true) WITH CHECK (true);
