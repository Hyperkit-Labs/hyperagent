-- RLS Verification: Ensure every public table has at least one policy.
-- Expected: All public tables have policies (typically service_role_all).
-- deployments must NOT have owner_read_own_deployments (removed in consolidated schema).
-- Run: psql "$DATABASE_URL" -f supabase/scripts/verify-rls-policies.sql
-- Or paste into Supabase SQL Editor.

-- Public tables and their policy count
SELECT t.table_name,
       COALESCE(p.policy_count, 0)::int AS policy_count,
       CASE WHEN COALESCE(p.policy_count, 0) = 0 THEN 'MISSING' ELSE 'OK' END AS status
FROM (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') t
LEFT JOIN (SELECT tablename, COUNT(*) AS policy_count FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename) p
  ON t.table_name = p.tablename
ORDER BY t.table_name;

-- deployments policies (owner_read_own_deployments should be absent)
SELECT 'deployments policies:' AS section, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deployments';

-- Summary
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.table_name)
  )
  THEN 'FAIL: Some tables have no policies'
  WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deployments' AND policyname = 'owner_read_own_deployments')
  THEN 'FAIL: deployments still has owner_read_own_deployments'
  ELSE 'PASS: All tables have policies; deployments OK'
END AS verification_result;
