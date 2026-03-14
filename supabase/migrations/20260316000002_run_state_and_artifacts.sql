-- run_state: normalized pipeline state (phase 1 of workflow_state split).
-- project_artifacts: add storage_backend and cid for IPFS-backed blobs.
-- workflow_state remains authoritative until migration is complete.

CREATE TABLE IF NOT EXISTS run_state (
    run_id UUID PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
    phase TEXT NOT NULL DEFAULT 'spec',
    status TEXT NOT NULL DEFAULT 'running',
    current_step TEXT,
    simulation_passed BOOLEAN NOT NULL DEFAULT false,
    exploit_simulation_passed BOOLEAN NOT NULL DEFAULT false,
    security_policy_passed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE run_state IS 'Normalized pipeline state. Future: replace workflow_state JSONB with this + project_artifacts.';

ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES runs(id) ON DELETE CASCADE;
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS storage_backend TEXT DEFAULT 'db';
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS cid TEXT;
ALTER TABLE project_artifacts ADD COLUMN IF NOT EXISTS name TEXT;

COMMENT ON COLUMN project_artifacts.storage_backend IS 'db or ipfs. When ipfs, cid holds the CID.';
COMMENT ON COLUMN project_artifacts.cid IS 'IPFS CID when storage_backend=ipfs.';

-- EigenDA: reserved for future. da_cert and reference_block in run_steps stay NULL.
COMMENT ON COLUMN run_steps.trace_da_cert IS 'Reserved for future EigenDA integration; currently NULL.';
COMMENT ON COLUMN run_steps.trace_reference_block IS 'Reserved for future EigenDA integration; currently NULL.';
