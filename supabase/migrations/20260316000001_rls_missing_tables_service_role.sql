-- RLS: service_role policy for run_state and extended project_artifacts
-- Ensures backend (service_role) has full access. No anon/authenticated policies.

-- run_state will be created in next migration; policy added there
-- This migration documents intent for any new tables in this batch.

COMMENT ON TABLE runs IS 'RLS enabled. workflow_state deprecated in favor of run_state + project_artifacts. Backend-only via service_role.';
