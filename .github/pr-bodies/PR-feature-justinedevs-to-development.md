# Pull Request

---

## Title

**services, apps, infra: Phase 1–3 implementation — orchestrator extraction, persistence, auth, queue, exploit-sim**

---

## Context / Description

**What** does this PR change, and **why**?

This PR implements the full-completion workstream from `.github/issues/` (ISSUE-1 through ISSUE-8):

- **Orchestrator extraction (1/8):** Split main.py into api/ and domain/ modules. main.py is thin composition only.
- **Persistence rewrite (2/8):** run_state and project_artifacts tables; delta writes replace full-blob workflow_state.
- **Integration consolidation (3/8):** Single path for Tenderly, IPFS, Supabase, Redis; agent-runtime exposes only /agents/* and /health.
- **Studio auth and SSE (4/8):** SessionProvider as single authority; bootstrap failure fatal; SSE-first workflow progress; api split by domain.
- **OTel, health, tests (5/8):** OTel spans, dependency-aware health, gateway-orchestrator auth chain integration tests, auth-bootstrap E2E.
- **Happy-path (6/8):** Acontext wired; deployable UI (IPFS, Vercel, sandbox, coolify); deploy flow.
- **Provenance and security (7/8):** EigenDA, Echidna, exploit-sim partial-coverage truthfulness.
- **Scale architecture (8/8):** Queue/job model, worker, REDIS_QUEUE_URL separation; worker nlp_input fix.

---

## Related issues / tickets

- **Related** .github/issues/ISSUE-1-orchestrator-extraction.md
- **Related** .github/issues/ISSUE-2-persistence-rewrite.md
- **Related** .github/issues/ISSUE-3-integration-consolidation.md
- **Related** .github/issues/ISSUE-4-studio-auth-sse.md
- **Related** .github/issues/ISSUE-5-otel-tests-health.md
- **Related** .github/issues/ISSUE-6-happy-path-completion.md
- **Related** .github/issues/ISSUE-7-provenance-security.md
- **Related** .github/issues/ISSUE-8-scale-architecture.md

---

## Type of change

- [x] **Feature** (Phase 1 / 2 / 3)
- [x] **Refactor** (orchestrator extraction)
- [ ] **Bug fix**
- [ ] **Documentation**
- [ ] **Chore**

---

## How to test

1. Check out branch `feature/justinedevs`
2. Run `cd services/orchestrator && pytest tests/ -v --no-cov`
3. Run `pnpm run lint && pnpm run typecheck`
4. Run `make up` then `make test-minimal` (smoke + integration)
5. Run `pnpm --filter hyperagent-studio run test:e2e` (E2E)

**Special setup:** REDIS_URL, SUPABASE_URL for queue and persistence. QUEUE_ENABLED=1 for worker-based pipeline.

---

## Author checklist (before requesting review)

- [x] Code follows project style guidelines
- [x] Unit and integration tests added/updated
- [x] Documentation updated where needed
- [x] Changes tested locally
- [x] No secrets or .env in diff
- [ ] CI passes

---

## Additional notes

- **Technical debt:** Some E2E tests use mocked backends for CI. Full stack E2E requires `make up` and real services.
- **Production transition:** Before merging development → main, run cleanup per `docs/PR-WORKFLOW-feature-justinedevs.md` (exclude test artifacts; do NOT remove test files).
