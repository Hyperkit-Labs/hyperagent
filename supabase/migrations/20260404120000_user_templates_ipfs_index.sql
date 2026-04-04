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

ALTER TABLE user_templates
  ADD CONSTRAINT fk_user_templates_current_version
  FOREIGN KEY (current_version_id) REFERENCES user_template_versions (id)
  ON DELETE SET NULL;

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
