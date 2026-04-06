-- Ensure Supabase-style roles referenced by RLS policies exist.
-- Hosted Supabase already provides anon, authenticated, and service_role; CREATE is a no-op via exception handler.
-- Local Postgres / Docker CI need these roles before any migration runs CREATE POLICY ... TO service_role.
--
-- Idempotent: safe to re-run (duplicate_object ignored).

DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
