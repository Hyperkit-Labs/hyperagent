-- Security remediation (Supabase advisors + drift cleanup)
--
-- 1) function_search_path_mutable (WARN): pin search_path on public trigger helpers so
--    they cannot be tricked via search_path injection. Applies to any matching function
--    that exists (some were created outside repo migrations).
-- 2) Legacy hyperagent schema: empty Alembic-era duplicate of concepts now in public.*.
--    No application code references PostgreSQL schema "hyperagent". Dropping removes
--    duplicate tables and clears RLS-enabled-no-policy INFO lints on that schema.
--
-- Idempotent with respect to apply-supabase-migrations.mjs (full re-run safe).

-- -----------------------------------------------------------------------------
-- A) Pin search_path on known trigger helper functions
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'update_spending_controls_updated_at',
        'update_updated_at_column'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- B) Remove legacy schema not managed by this repository
-- -----------------------------------------------------------------------------
DROP SCHEMA IF EXISTS hyperagent CASCADE;
