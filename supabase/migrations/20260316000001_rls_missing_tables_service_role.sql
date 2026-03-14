-- RLS: Explicit service_role policy for tables missing from 20260313000003
-- user_credits, credit_transactions already have service_role_full_access.
-- Add for: spending_controls, storage_records, agent_logs, simulations, agent_context.
-- ZSPS: Documents intent; backend-only. Prevents accidental permissive policies.

DROP POLICY IF EXISTS "service_role_full_access" ON spending_controls;
CREATE POLICY "service_role_full_access" ON spending_controls FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON storage_records;
CREATE POLICY "service_role_full_access" ON storage_records FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON agent_logs;
CREATE POLICY "service_role_full_access" ON agent_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON simulations;
CREATE POLICY "service_role_full_access" ON simulations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON agent_context;
CREATE POLICY "service_role_full_access" ON agent_context FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE spending_controls IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE storage_records IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE agent_logs IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE simulations IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE agent_context IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
