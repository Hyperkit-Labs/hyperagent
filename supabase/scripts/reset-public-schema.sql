-- Wipe the public schema and restore empty public + standard Supabase-style grants.
-- Use when you need a clean slate before re-running migrations (avoids drift from old partial applies).
--
-- Scope: Drops all tables, functions, types, and other objects in schema public.
-- Does not drop auth.*, storage.*, realtime.*, or other system schemas.
--
-- After this file:
--   pnpm db:apply-migrations
--   pnpm db:verify-security   (optional)
--   psql "$DATABASE_URL" -f supabase/scripts/verify-rls-policies.sql
--
-- Run as a role that owns public (typically postgres on Supabase).

DROP SCHEMA IF EXISTS public CASCADE;

CREATE SCHEMA public;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

ALTER SCHEMA public OWNER TO postgres;

-- Extensions: recreated by the first statements in migrations (uuid-ossp, pgcrypto).
-- If a prior CASCADE left a broken extension record, drop it in the SQL Editor before apply:
--   DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
--   DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
