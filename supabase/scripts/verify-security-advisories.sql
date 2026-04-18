-- Post-migration checks for security remediation (search_path pin, hyperagent drop, etc.; see consolidated migration).
-- Run after: pnpm db:apply-migrations
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/verify-security-advisories.sql
-- Or paste into Supabase SQL Editor.

-- 1) Legacy schema must not exist (canonical objects live in public.*)
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'hyperagent')
  THEN 'FAIL: hyperagent schema still present'
  ELSE 'PASS: no hyperagent schema'
END AS check_hyperagent;

-- 2) Trigger helpers must have search_path pinned (mutable search_path advisory)
SELECT p.proname AS function_missing_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_updated_at',
    'update_spending_controls_updated_at',
    'update_updated_at_column'
  )
  AND (
    p.proconfig IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS cfg(cfg) WHERE cfg::text LIKE '%search_path%'
    )
  );

-- Summary: second query must return zero rows
SELECT CASE
  WHEN EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'update_spending_controls_updated_at',
        'update_updated_at_column'
      )
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS cfg(cfg) WHERE cfg::text LIKE '%search_path%'
        )
      )
  )
  THEN 'FAIL: one or more functions lack pinned search_path'
  ELSE 'PASS: trigger helpers have search_path'
END AS check_search_path;
