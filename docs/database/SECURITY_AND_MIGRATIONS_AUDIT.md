# Security and Supabase migrations audit

This document records the production-hardening pass: advisory remediation, migration truth, validation, and residual risk. **Canonical schema source:** ordered files under `supabase/migrations/` applied by `scripts/apply-supabase-migrations.mjs` (see `supabase/README.md`).

---

## 1. Security findings (Supabase linter + remediation)

| Issue | Before | Root cause | Affected objects | Fix | Validation |
|--------|--------|------------|------------------|-----|------------|
| `function_search_path_mutable` (WARN) | `search_path` not pinned | Trigger helpers created without `SET search_path` | `public.set_updated_at`, and any `update_*_updated_at` helpers present on the DB | Migration `20260409120000_security_remediation_search_path_legacy_schema.sql` runs `ALTER FUNCTION ... SET search_path = public, pg_temp` for all matching `pg_proc` rows | `pnpm db:verify-security` and `supabase/scripts/verify-security-advisories.sql` |
| `rls_enabled_no_policy` (INFO) on `hyperagent.*` | RLS on with no policies | Legacy Alembic schema left on hosted DB; not in repo migrations | `hyperagent.contract_templates`, `deployments`, … | **Drop schema:** `DROP SCHEMA IF EXISTS hyperagent CASCADE` in `20260409120000` (app uses `public.*` only; schema was empty aside from `alembic_version`) | Verify script asserts schema absent; re-run Supabase security advisor |
| `public.*` backend-only model | N/A | By design | All orchestrator tables | Explicit `service_role_all` (or equivalent) policies from `20260321000001` and related; anon/auth denied by default | `supabase/scripts/verify-rls-policies.sql` |

**Residual risk:** `update_spending_controls_updated_at` / `update_updated_at_column` are not defined in repo migrations; they may be dashboard-created. The remediation migration pins `search_path` **if** those functions exist. New environments created only from migrations may never create them; verification allows absence.

---

## 2. Migration audit (each file)

| File | Purpose | Verdict | Notes |
|------|---------|---------|-------|
| `00000000000000_baseline.sql` | Core `public` tables, indexes, RLS enable | **Keep** | Foundation; idempotent `IF NOT EXISTS` |
| `20260309000001_identity_column_comments.sql` | Comments | **Keep** | Documentation |
| `20260312000001_rls_backend_only_enforcement.sql` | RLS comments / enforcement | **Keep** | |
| `20260312000002_rls_complete_coverage.sql` | RLS comments for remaining tables | **Keep** | |
| `20260312000003_domain_agent_tables.sql` | Domain/agent DDL | **Keep** | |
| `20260313000001_run_steps_orchestrator_columns.sql` | `run_steps` columns | **Keep** | |
| `20260313000002_credits_atomic_rpc.sql` | `consume_credits` RPC | **Keep** | Security definer has `SET search_path = public` (see billing hardening) |
| `20260313000003_rls_service_role_explicit.sql` | Service role policies | **Keep** | Superseded in spirit by `20260321000001` but keep for history / idempotent re-run |
| `20260313000004_agent_logs_stage_log_level.sql` | Agent logs | **Keep** | |
| `20260315000001_hardened_deployments_ownership.sql` | Deployments ownership | **Keep** | |
| `20260316000001_rls_missing_tables_service_role.sql` | More RLS | **Keep** | |
| `20260316000002_run_state_and_artifacts.sql` | `run_state`, artifact columns | **Keep** | |
| `20260317000001_rls_enforce_all_tables.sql` | RLS sweep | **Keep** | |
| `20260318000001_agent_registrations.sql` | Agent registry DDL | **Keep** | |
| `20260318000002_bootstrap_rpcs.sql` | Bootstrap RPCs | **Keep** | |
| `20260321000001_rls_complete_service_role_policies.sql` | `service_role_all` + drop bad deployment policy | **Keep** | Critical for explicit backend-only access |
| `20260403000001_byok_security_audit.sql` | BYOK tables, `set_updated_at`, RLS for BYOK | **Keep** | |
| `20260403000002_billing_hardening.sql` | Billing indices, idempotency, `consume_credits` replace | **Keep** | Destructive `DELETE` for dedupe; documented in file |
| `20260403120000_storage_records_pipeline_columns.sql` | Storage pipeline | **Keep** | |
| `20260404120000_user_templates_ipfs_index.sql` | User templates index | **Keep** | |
| `20260405100000_a2a_registry_erc8004.sql` | A2A registry | **Keep** | |
| `20260406120000_security_audit_v1_waiver_evidence.sql` | Security audit waiver evidence | **Keep** | |
| `20260407100000_wallet_users_ensure_auth_method.sql` | `auth_method` column repair | **Keep** | |
| `20260408150000_schema_dedupe_legacy_columns.sql` | Drop `auth_provider`, `ipfs_cid` after backfill | **Keep** | |
| `20260409120000_security_remediation_search_path_legacy_schema.sql` | Pin `search_path`, drop `hyperagent` | **Keep** | Security + drift |

**Contradiction / churn:** Early RLS migrations (`20260313000003`, `20260317000001`) overlap in intent with `20260321000001`. Files remain **idempotent** and safe under full re-run; consolidation into one baseline would be a **separate** project (requires migration tracking, not only sorted filenames).

---

## 3. Final migration structure (target)

| Layer | Files | Role |
|-------|-------|------|
| Baseline | `00000000000000_baseline.sql` | Tables + enable RLS |
| Feature DDL | `20260312*`–`20260406*` | Incremental schema |
| RLS / policies | `20260313000003`, `20260321000001`, … | Explicit `service_role` and BYOK policies |
| Security / compliance | `20260403000001`, `20260406120000`, `20260409120000` | BYOK, audit, `search_path`, legacy schema |
| Dedupe / repair | `20260407100000`, `20260408150000` | Column alignment |

**Apply order:** Lexicographic filename order via `apply-supabase-migrations.mjs`.

---

## 4. Implementation plan (this pass)

| Action | Location |
|--------|----------|
| New migration | `supabase/migrations/20260409120000_security_remediation_search_path_legacy_schema.sql` |
| Verification SQL | `supabase/scripts/verify-security-advisories.sql` |
| Verification CLI | `scripts/verify-supabase-security.mjs`, `pnpm db:verify-security` |
| Docs | This file; `supabase/README.md` updated for lifecycle |

**Implemented after initial pass:**

- **RLS integration tests:** `services/orchestrator/tests/integration/test_rls_integration.py` (requires `RLS_INTEGRATION_TESTS=1`, migrations + `supabase/scripts/ci-rls-test-users.sql`).
- **CI:** `.github/workflows/ci.yml` (unit-tests job) and `.github/workflows/pr-validation.yml` (test-backend) apply migrations, run `db:ci-setup-rls-test-users`, `db:verify-security`, then pytest with `RLS_INTEGRATION_TESTS=1`.
- **JWT roles on vanilla Postgres:** `supabase/migrations/00000000000001_ensure_supabase_jwt_roles.sql` so `CREATE POLICY ... TO service_role` works in CI (hosted Supabase already has these roles; duplicates are ignored).
- **Dashboard process:** `docs/database/DASHBOARD_AND_MIGRATIONS.md`.

**Still optional / later:** full single-file baseline squash; pgTAP; automated schema diff to production; Supabase CLI–managed migration history instead of replaying all files.

---

## 5. Production validation checklist

- [ ] `pnpm db:apply-migrations` completes (same `DATABASE_URL` as production when promoting).
- [ ] `pnpm db:verify-security` exits 0.
- [ ] `supabase/scripts/verify-rls-policies.sql` → `PASS` for `public` tables.
- [ ] Re-run Supabase Dashboard **Security advisors**; `function_search_path_mutable` for listed helpers cleared; `hyperagent` RLS INFO cleared (schema removed).
- [ ] Smoke test: gateway + orchestrator routes touching Postgres (bootstrap, runs, credits).
- [ ] Confirm no service relies on PostgreSQL schema `hyperagent` before promoting `20260409120000`.

---

## 6. Final judgment

| Question | Answer |
|----------|--------|
| Is the Supabase setup now production-grade? | **Stronger, not perfect.** Critical advisor WARNs addressed in SQL; legacy duplicate schema removed when migration is applied. Full “production-grade” also requires your CI/secrets policy, RLS integration tests, and environment parity. |
| Are migrations clean and current? | **Logically coherent** and **idempotent for re-run**, but **not squashed** into a single baseline. Squash is optional and needs a version table or CLI-managed history. |
| Are outdated migrations still a problem? | **Overlap** exists between early RLS files; they are safe to keep while idempotent. **No** requirement to delete old files for correctness. |
| Residual risks? | Dashboard-only DDL outside repo can reappear; apply script does not record versions (every file runs each time—must stay idempotent); `DROP SCHEMA hyperagent` is destructive if you ever needed that data. |

---

## 7. Drift and ownership

- **Source of truth:** `supabase/migrations/*.sql` only. Any Dashboard change must be copied into a new timestamped migration.
- **Generated types:** If the project adds Supabase type generation, regenerate after migrations and commit.
- **Service role:** Backend only; never embed in clients (per project constitution).
