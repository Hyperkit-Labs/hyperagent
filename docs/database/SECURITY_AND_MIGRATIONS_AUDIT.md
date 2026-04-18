# Security and Supabase migrations audit

This document records the production-hardening pass: advisory remediation, migration truth, validation, and residual risk. **Canonical schema source:** ordered files under `supabase/migrations/` applied by `scripts/apply-supabase-migrations.mjs` (see `supabase/README.md`).

---

## 1. Security findings (Supabase linter + remediation)

| Issue | Before | Root cause | Affected objects | Fix | Validation |
|--------|--------|------------|------------------|-----|------------|
| `function_search_path_mutable` (WARN) | `search_path` not pinned | Trigger helpers created without `SET search_path` | `public.set_updated_at`, and any `update_*_updated_at` helpers present on the DB | Consolidated migration `00000000000000_initial_schema.sql` includes the former `20260409120000_security_remediation_search_path_legacy_schema.sql` block: `ALTER FUNCTION ... SET search_path = public, pg_temp` for matching `pg_proc` rows | `pnpm db:verify-security` and `supabase/scripts/verify-security-advisories.sql` |
| `rls_enabled_no_policy` (INFO) on `hyperagent.*` | RLS on with no policies | Legacy Alembic schema left on hosted DB; not in repo migrations | `hyperagent.contract_templates`, `deployments`, … | **Drop schema:** `DROP SCHEMA IF EXISTS hyperagent CASCADE` in the same consolidated file (app uses `public.*` only; schema was empty aside from `alembic_version`) | Verify script asserts schema absent; re-run Supabase security advisor |
| `public.*` backend-only model | N/A | By design | All orchestrator tables | Explicit `service_role_all` (or equivalent) policies from the consolidated file (formerly `20260321000001` and related); anon/auth denied by default | `supabase/scripts/verify-rls-policies.sql` |

**Residual risk:** `update_spending_controls_updated_at` / `update_updated_at_column` are not defined in repo migrations; they may be dashboard-created. The remediation migration pins `search_path` **if** those functions exist. New environments created only from migrations may never create them; verification allows absence.

---

## 2. Migration audit (current layout)

| File | Purpose | Notes |
|------|---------|-------|
| `00000000000000_initial_schema.sql` | **Single squashed apply** | Concatenation of all former timestamped migrations in historical order. Each original file is marked with `-- Source migration: <name>`. |

**Former per-change files** (baseline through `20260419120000_credit_transactions_description_if_missing.sql`) are **removed from the tree**; their text lives only inside the squashed file. **Overlap** between early RLS sections and the later `service_role_all` sweep remains logically redundant but **idempotent** under full re-run (required because `apply-supabase-migrations.mjs` replays every `.sql` file with no version table).

**Destructive logic preserved:** The billing dedupe `DELETE` in the former `20260403000002_billing_hardening.sql` block still runs on every apply; it is a no-op on an empty database after `reset-public-schema.sql`.

---

## 3. Final migration structure (target)

| Layer | Files | Role |
|-------|-------|------|
| Full schema | `00000000000000_initial_schema.sql` | Extensions, tables, RLS, RPCs, security remediation, billing, ERC-8004, etc. |
| Future deltas | `YYYYMMDDHHMMSS_*.sql` (optional) | New changes only; sort after the initial file |

**Apply order:** Lexicographic filename order via `apply-supabase-migrations.mjs`.

**Greenfield / drift reset:** `supabase/scripts/reset-public-schema.sql` then `pnpm db:apply-migrations` (see `supabase/README.md`).

---

## 4. Implementation plan (this pass)

| Action | Location |
|--------|----------|
| Consolidated schema | `supabase/migrations/00000000000000_initial_schema.sql` |
| Public schema reset (optional) | `supabase/scripts/reset-public-schema.sql` |
| Verification SQL | `supabase/scripts/verify-security-advisories.sql` |
| Verification CLI | `scripts/verify-supabase-security.mjs`, `pnpm db:verify-security` |
| Docs | This file; `supabase/README.md` |

**Implemented after initial pass:**

- **RLS integration tests:** `services/orchestrator/tests/integration/test_rls_integration.py` (requires `RLS_INTEGRATION_TESTS=1`, migrations + `supabase/scripts/ci-rls-test-users.sql`).
- **CI:** `.github/workflows/ci.yml` (unit-tests job) and `.github/workflows/pr-validation.yml` (test-backend) apply migrations, run `db:ci-setup-rls-test-users`, `db:verify-security`, then pytest with `RLS_INTEGRATION_TESTS=1`.
- **JWT roles on vanilla Postgres:** Former `00000000000001_ensure_supabase_jwt_roles.sql` is embedded at the top of the squashed migration (hosted Supabase already has these roles; duplicates are ignored).
- **Dashboard process:** `docs/database/DASHBOARD_AND_MIGRATIONS.md`.

**Still optional / later:** pgTAP; automated schema diff to production; Supabase CLI–managed migration history instead of replaying all files.

---

## 5. Production validation checklist

- [ ] `pnpm db:apply-migrations` completes (same `DATABASE_URL` as production when promoting).
- [ ] `pnpm db:verify-security` exits 0.
- [ ] `supabase/scripts/verify-rls-policies.sql` → `PASS` for `public` tables.
- [ ] Re-run Supabase Dashboard **Security advisors**; `function_search_path_mutable` for listed helpers cleared; `hyperagent` RLS INFO cleared (schema removed).
- [ ] Smoke test: gateway + orchestrator routes touching Postgres (bootstrap, runs, credits).
- [ ] Confirm no service relies on PostgreSQL schema `hyperagent` before applying migrations that drop it (block is inside `00000000000000_initial_schema.sql`).

---

## 6. Final judgment

| Question | Answer |
|----------|--------|
| Is the Supabase setup now production-grade? | **Stronger, not perfect.** Critical advisor WARNs addressed in SQL; legacy duplicate schema removed when migration is applied. Full “production-grade” also requires your CI/secrets policy, RLS integration tests, and environment parity. |
| Are migrations clean and current? | **Yes for repo layout:** one squashed `00000000000000_initial_schema.sql` plus optional future timestamped files. Apply script still requires **idempotent** SQL because every file replays on each run. |
| Are outdated migrations still a problem? | **No duplicate files in tree.** Redundant sections inside the squashed file remain safe under full re-run. |
| Residual risks? | Dashboard-only DDL outside repo can reappear; apply script does not record versions (every file runs each time—must stay idempotent); `DROP SCHEMA hyperagent` is destructive if you ever needed that data. |

---

## 7. Drift and ownership

- **Source of truth:** `supabase/migrations/*.sql` only. Any Dashboard change must be copied into a new timestamped migration.
- **Generated types:** If the project adds Supabase type generation, regenerate after migrations and commit.
- **Service role:** Backend only; never embed in clients (per project constitution).
