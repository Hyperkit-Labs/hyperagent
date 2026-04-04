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
