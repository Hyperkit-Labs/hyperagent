-- Create non-superuser login roles for RLS integration tests (CI and local dev).
-- Run after full migration apply, as database owner (e.g. postgres).
-- Grants SELECT + INSERT for service path tests; anon-like user has no service_role membership.

-- Service-path tester: can SET ROLE service_role to match backend PostgREST service key behavior.
DROP ROLE IF EXISTS rls_ci_service;
CREATE ROLE rls_ci_service WITH LOGIN PASSWORD 'rls_ci_service' NOINHERIT;
GRANT USAGE ON SCHEMA public TO rls_ci_service;
GRANT service_role TO rls_ci_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_ci_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rls_ci_service;

-- Deny-path tester: no membership in service_role; RLS should yield no rows for typical backend-only tables.
DROP ROLE IF EXISTS rls_ci_anon;
CREATE ROLE rls_ci_anon WITH LOGIN PASSWORD 'rls_ci_anon';
GRANT USAGE ON SCHEMA public TO rls_ci_anon;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO rls_ci_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO rls_ci_anon;
