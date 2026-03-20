# Pull Request

---

## Title / Naming convention

**services/orchestrator, supabase: add run_state and project_artifacts persistence**

---

## Context / Description

**What** does this PR change, and **why**?

- Adds `run_state` as the small canonical runtime state table; extends `project_artifacts` with `run_id`, `storage_backend`, `cid`, `name`.
- Stops relying on giant `runs.workflow_state` JSONB writes; step outputs (spec, design, contracts, audit findings, simulation results, ui_schema) stored as typed artifacts.
- Keeps in-memory cache as bounded fallback only with LRU and explicit fallback flags.
- Migration order: run_state table + project_artifacts extension; compatibility read path for historical runs.

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 2: Data/state redesign)
- **Related** docs/internal/boundaries.md

---

## Type of change

- [x] **Feature** (Phase 1 persistence)
- [x] **Refactor** (state storage path)

---

## How to test

1. Apply migrations: `supabase db push` or run migrations manually
2. Create one workflow and verify each step produces normalized state updates plus artifact rows
3. Restart orchestrator during a human-review pause; confirm checkpoint/state recovery when Redis is configured

**Special setup / config:** REDIS_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY

---

## Author checklist (before requesting review)

- [x] Code follows the project's style guidelines
- [ ] Unit tests added or updated
- [x] Documentation updated
- [x] Changes tested locally
- [x] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Breaking changes:** New migrations required. Backward compatibility: historical runs with only `workflow_state` hydrate from that blob.
- **Technical debt:** Mark `runs.workflow_state` deprecated in code comments; stop writing except for temporary backward compatibility.
