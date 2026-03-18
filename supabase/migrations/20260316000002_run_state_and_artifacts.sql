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
