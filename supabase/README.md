# Supabase database migrations

This folder holds **PostgreSQL migrations** for the project database (Supabase). Migrations are the source of truth for schema changes. Application code expects the schema that these files define.

## Layout

| Path | Role |
|------|------|
| `migrations/` | Ordered SQL files applied in filename order |
| `scripts/` | Optional SQL helpers (for example policy checks), not auto-applied as migrations |

**Consolidated schema:** The full application schema lives in `migrations/00000000000000_initial_schema.sql`. That file is a single ordered merge of the former per-change migrations (section headers inside the file name the original source). Add **new** DDL as additional files with a later timestamp so history stays clear.

## Naming

Use a timestamp prefix so files sort in apply order:

`YYYYMMDDHHMMSS_short_description.sql`

Example: `20260405100000_a2a_registry_erc8004.sql`

Use lowercase with underscores. One logical change per file when possible.

## Authoring a new migration

1. Add a new file under `migrations/` with the next timestamp (lexicographically after `00000000000000_initial_schema.sql` and any other deltas).
2. Prefer idempotent DDL where it helps operations, for example `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$ ... IF NOT EXISTS` blocks for policies.
3. Enable **RLS** on user-facing tables and add policies that match how services connect (often `service_role` for backend jobs; adjust if you use authenticated users or other roles).
4. Keep destructive changes (drops, renames) explicit and documented in the migration comment at the top of the file.

## Applying migrations

From the **repository root** (requires `DATABASE_URL` in `.env`, or exported in the shell):

```bash
pnpm db:apply-migrations
```

That runs `node scripts/apply-supabase-migrations.mjs`, which applies every `supabase/migrations/*.sql` file in sorted filename order against `DATABASE_URL`. See the script header in `scripts/apply-supabase-migrations.mjs` for pooler versus direct connection notes.

**Idempotency:** The apply script does not use a migration version table; the same files are intended to be safe to re-run (for example `CREATE IF NOT EXISTS`, `DROP IF EXISTS`, and guarded `DO` blocks). Destructive one-off data fixes remain in dated files; review before re-running on a copy if unsure.

**Architecture note:** Security findings, RLS expectations, and validation commands are documented in `docs/database/SECURITY_AND_MIGRATIONS_AUDIT.md`.

**Alternative:** Use the [Supabase CLI](https://supabase.com/docs/guides/cli) with your project linked, for example `supabase db push` or `supabase migration up`, if that is what your environment standardizes.

**Hosted project:** Run the same migration pipeline you use for staging and production. Do not rely on application startup to create tables unless that is an explicit, documented exception.

**Docker / Coolify / app deploy:** Building and starting the API does **not** run SQL migrations. If production sign-in fails with PostgREST **`PGRST204`** on `wallet_users.auth_method`, the database was never fully migrated or predates a column the gateway expects. Apply migrations against the **same** `DATABASE_URL` as Supabase (or run the SQL in the Supabase SQL Editor).

**Schema drift (common):** The consolidated file still uses `CREATE TABLE IF NOT EXISTS` in places. If a table already existed without a column the app expects, PostgreSQL does not add that column from the `CREATE TABLE` text. Later sections in the same file (for example wallet `auth_method`, billing `credit_transactions` columns) use `ADD COLUMN IF NOT EXISTS` and backfills so a **full** apply on a messy database repairs shape. For a **known** bad state, prefer a deliberate reset (below) then a single clean apply.

## Fresh database (reset public, then migrate)

To avoid carrying legacy partial schema in `public`, wipe `public` and re-apply all migration files:

1. Run `supabase/scripts/reset-public-schema.sql` as a superuser or `postgres` (Supabase SQL Editor is fine).
2. From the repo root: `pnpm db:apply-migrations`.

This **destroys all application data** in `public`. Do not run against production unless that data loss is intended. For production, use backups, maintenance windows, or a new Supabase project when you need a greenfield schema.

## Verification scripts

After apply, you can confirm RLS coverage with the helper SQL (not a migration):

```bash
psql "$DATABASE_URL" -f supabase/scripts/verify-rls-policies.sql
```

On Windows shells without `psql` on `PATH`, use your SQL client or paste the file into the Supabase SQL Editor.

For ad hoc checks, open any file under `supabase/scripts/` and run it the same way.

**Security checks** (after migrations define pinned `search_path` and related hardening):

```bash
pnpm db:verify-security
```

Or run `supabase/scripts/verify-security-advisories.sql` with `psql` or the SQL Editor.

## RLS integration tests (CI and local)

Orchestrator pytest includes `tests/integration/test_rls_integration.py` when `RLS_INTEGRATION_TESTS=1`. CI sets this after applying migrations and `pnpm db:ci-setup-rls-test-users` (creates `rls_ci_service` / `rls_ci_anon` for non-superuser checks).

Local:

```bash
pnpm db:apply-migrations
pnpm db:ci-setup-rls-test-users
cd services/orchestrator && RLS_INTEGRATION_TESTS=1 pytest tests/integration/test_rls_integration.py -v
```

Dashboard-only workflow expectations: `docs/database/DASHBOARD_AND_MIGRATIONS.md`.

## Rollback

PostgreSQL does not run “down” migrations automatically. To reverse a change, add a **new** forward migration that restores the previous shape, or restore the database from backup if the change was already promoted.
