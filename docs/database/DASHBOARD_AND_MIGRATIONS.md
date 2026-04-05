# Dashboard changes and migrations (process)

Supabase Studio (SQL Editor, Table Editor, Auth) can change the live database **without** touching this repository. Those changes are **not** reproducible for staging, CI, or new developers unless they are captured in SQL here.

## Rules

1. **No dashboard-only schema for production paths.** If you change tables, columns, indexes, RLS policies, functions, or roles in the Dashboard, add a **new file** under `supabase/migrations/` with the next timestamp and the same DDL, idempotent where possible (`IF NOT EXISTS`, guarded `DO` blocks).

2. **Same order everywhere.** Apply migrations with `pnpm db:apply-migrations` (or your approved pipeline) against dev, staging, and production in order. Do not rely on “it already exists in prod.”

3. **Verify after apply.** Run `pnpm db:verify-security` and, when testing access rules, `supabase/scripts/verify-rls-policies.sql`.

4. **CI is the gate.** Pull requests run the full migration set against a fresh Postgres service, then RLS integration tests. If you skip migrations in the PR, CI should fail when the app or tests expect the new shape.

5. **Emergency hotfix in Dashboard.** If you must patch production in the SQL Editor before a merge, **backfill** the repo the same day: add a migration that matches the hotfix so the next environment is not missing it.

## Review checklist (author and reviewer)

- [ ] New behavior is expressed in `supabase/migrations/*.sql`, not only in Studio.
- [ ] Destructive steps are commented at the top of the migration file.
- [ ] RLS and grants match the intended access model (backend-only vs user-scoped).
- [ ] Generated client types (if used) are regenerated after schema changes.

See also `supabase/README.md` and `docs/database/SECURITY_AND_MIGRATIONS_AUDIT.md`.
