-- RLS Complete Coverage (W-001 Hardening)
-- Ensures ALL tables with RLS have documented backend-only enforcement.
-- Agent tables: agent_context, agent_logs.
-- Future Domain tables: When adding custom_domains or workspace_domains,
-- run: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
-- then add: COMMENT ON TABLE <table> IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';

-- Complete the set: tables with RLS that were missing from 20260312000001
COMMENT ON TABLE wallet_user_profiles IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE run_steps IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE credit_transactions IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE agent_logs IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE storage_records IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
