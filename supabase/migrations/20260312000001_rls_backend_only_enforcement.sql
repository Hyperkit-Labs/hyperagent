-- RLS Backend-Only Enforcement (W-001)
-- All application tables have RLS enabled but no per-user policies.
-- The frontend MUST NOT query Supabase directly. All data access goes through
-- the API gateway and orchestrator, which use the service role key.
-- If the frontend ever uses the Supabase client, RLS will deny all operations.
-- This migration documents that design decision. No policy changes.

COMMENT ON TABLE wallet_users IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE projects IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE runs IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE project_artifacts IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE deployments IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE simulations IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE security_findings IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE user_credits IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE payment_history IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE spending_controls IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
COMMENT ON TABLE agent_context IS 'RLS enabled, no policies. Backend-only via service role. Frontend must not use Supabase client.';
