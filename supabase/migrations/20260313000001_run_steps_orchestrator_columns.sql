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
