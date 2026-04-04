# Supabase database migrations

This folder holds **PostgreSQL migrations** for the project database (Supabase). Migrations are the source of truth for schema changes. Application code expects the schema that these files define.

## Layout

| Path | Role |
|------|------|
| `migrations/` | Ordered SQL files applied in filename order |
| `scripts/` | Optional SQL helpers (for example policy checks), not auto-applied as migrations |

## Naming

Use a timestamp prefix so files sort in apply order:

`YYYYMMDDHHMMSS_short_description.sql`

Example: `20260405100000_a2a_registry_erc8004.sql`

Use lowercase with underscores. One logical change per file when possible.

## Authoring a new migration

1. Add a new file under `migrations/` with the next timestamp (after the latest file).
2. Prefer idempotent DDL where it helps operations, for example `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$ ... IF NOT EXISTS` blocks for policies.
3. Enable **RLS** on user-facing tables and add policies that match how services connect (often `service_role` for backend jobs; adjust if you use authenticated users or other roles).
4. Keep destructive changes (drops, renames) explicit and documented in the migration comment at the top of the file.

## Applying migrations

From the **repository root** (requires `DATABASE_URL` in `.env`, or exported in the shell):

```bash
pnpm db:apply-migrations
```

That runs `node scripts/apply-supabase-migrations.mjs`, which applies every `supabase/migrations/*.sql` file in sorted filename order against `DATABASE_URL`. See the script header in `scripts/apply-supabase-migrations.mjs` for pooler versus direct connection notes.

**Alternative:** Use the [Supabase CLI](https://supabase.com/docs/guides/cli) with your project linked, for example `supabase db push` or `supabase migration up`, if that is what your environment standardizes.

**Hosted project:** Run the same migration pipeline you use for staging and production. Do not rely on application startup to create tables unless that is an explicit, documented exception.

## Verification scripts

After apply, you can confirm RLS coverage with the helper SQL (not a migration):

```bash
psql "$DATABASE_URL" -f supabase/scripts/verify-rls-policies.sql
```

On Windows shells without `psql` on `PATH`, use your SQL client or paste the file into the Supabase SQL Editor.

For ad hoc checks, open any file under `supabase/scripts/` and run it the same way.

## Rollback

PostgreSQL does not run “down” migrations automatically. To reverse a change, add a **new** forward migration that restores the previous shape, or restore the database from backup if the change was already promoted.
