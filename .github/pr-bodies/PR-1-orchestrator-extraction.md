# Pull Request

---

## Title / Naming convention

**services/orchestrator: extract api/common and domain/store for modularization**

---

## Context / Description

**What** does this PR change, and **why**?

- Extracts auth helpers (`get_caller_id`, `assert_workflow_owner`) into `api/common.py` and domain store re-exports into `domain/store.py`.
- Adds `docs/internal/boundaries.md` mapping route → service → module per the audit plan.
- First pass toward splitting the 3475-line `main.py` into `api/workflows.py`, `api/pipeline.py`, `api/billing.py`, `api/ui_export.py`, `api/metrics_health.py`, plus `domain/store.py` and `domain/security.py`.
- Route signatures and behavior remain unchanged; no regression.

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 1: Architecture split)
- **Related** docs/internal/boundaries.md CI rule: orchestrator cannot import from apps/studio or apps/api-gateway

---

## Type of change

- [x] **Refactor** (no new behavior)

---

## How to test

1. Check out branch `pr-1-orchestrator-extraction`
2. Run `cd services/orchestrator && pytest tests/integration/test_orchestrator_api.py -v`
3. Verify `/api/v1/workflows`, `/api/v1/config`, `/health` behave as before

**Special setup / config:** None

---

## Author checklist (before requesting review)

- [x] Code follows the project's style guidelines
- [x] Unit tests added or updated (integration tests cover auth chain)
- [x] Documentation updated (boundaries.md)
- [x] Changes tested locally
- [x] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Technical debt:** Full route-family extraction (workflows, pipeline, billing, ui_export, metrics_health) is planned in follow-up PRs. This PR establishes the module layout and auth/domain boundaries.
