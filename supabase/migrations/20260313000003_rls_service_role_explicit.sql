-- RLS: Explicit service_role policy for BYOK and credits tables
-- Documents intent: only backend (service_role) may access. Prevents accidental
-- permissive policies from exposing these tables to authenticated/anon roles.

DROP POLICY IF EXISTS "service_role_full_access" ON wallet_users;
CREATE POLICY "service_role_full_access" ON wallet_users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON user_credits;
CREATE POLICY "service_role_full_access" ON user_credits FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access" ON credit_transactions;
CREATE POLICY "service_role_full_access" ON credit_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE wallet_users IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE user_credits IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
COMMENT ON TABLE credit_transactions IS 'RLS enabled. Explicit service_role policy. Backend-only. Frontend must not use Supabase client.';
