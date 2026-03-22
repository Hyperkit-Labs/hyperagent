# Production Hardening Pass Report

Generated: 2025-03-18

## 1. Executive Production Audit

HyperAgent is an AI-powered smart contract pipeline: spec to design to codegen to audit to simulation to deploy. The stack includes Studio (Next.js), API gateway (Express), orchestrator (FastAPI), agent-runtime (Node), and services (compile, audit, simulation, deploy, storage).

Current state: Several GitHub issues (1–8) have been partially or fully addressed. Orchestrator extraction (1/8) and integration consolidation (3/8) are largely done. Persistence (2/8): workflow_state blob writes retired; run_state and project_artifacts only. Studio auth and SSE (4/8) are improved: SessionProvider as single authority, bootstrap failure redirects, SSE-first workflow progress. OTel exists in orchestrator and gateway. Health is dependency-aware. Acontext is wired for context search in spec nodes. H-004 partial: production blocks localhost via degraded health; service discovery not implemented. Provenance (7/8) and scale (8/8) remain unimplemented.

Gaps: EigenDA and Echidna are stubbed. Service discovery and queue/job model are not in place. Real-server E2E and RLS verification have not been executed. Several flows are code-backed but runtime-unproven.

---

## 2. Newly Discovered Issues

- SessionProvider uses fetchConfigStrict for bootstrap validation. Config endpoint returns 401/503 when session invalid. This is correct. useAutoBootstrap calls signIn, not config. Both paths redirect on failure.

- useWorkflowProgress: SSE primary when connected (poll 15s), polling fallback when disconnected (5s). useAgentDiscussion connects to discussion stream. Workflow status and contracts still come from polling. SSE carries discussion events only, not full workflow state.

- store.py: (Fixed in this pass.) update_workflow and create_workflow no longer call upsert_workflow_state. Rich data stored in project_artifacts; get_workflow falls back to get_workflow_rich_from_artifacts when blob absent.

- Agent-runtime does not expose /simulate, /deploy, /pin. Tools call SIMULATION_SERVICE_URL, STORAGE_SERVICE_URL, DEPLOY_SERVICE_URL. Single path per service. Issue 3/8 target met.

- Orchestrator main.py is 190 lines. api/ and domain/ modules exist. Issue 1/8 target met.

---

## 2b. Hardening Findings Log

| Id | Source | Component | Severity | Description | Recommendation | Scope |
|----|--------|-----------|----------|-------------|----------------|-------|
| H-001 | Persistence | orchestrator | Medium | ~~workflow_state blob still written~~ | **Fixed.** Stopped blob writes; rich data in run_state + project_artifacts only | services/orchestrator/store.py, db.py |
| H-002 | Provenance | registries | High | EigenDA returns ipfs/none only; da_cert, reference_block always NULL | Implement EigenDA anchoring when EIGENDA_* configured; populate run_steps.da_cert | services/orchestrator/registries.py |
| H-003 | Security | audit | Medium | Echidna run separately stub; no integrated execution | Integrate Echidna execution and result ingestion into audit flow | services/audit/ |
| H-004 | Scale | orchestrator | High | ~~Hardcoded localhost in production~~ | **Partially fixed.** Production blocks localhost via degraded health; service discovery/registry not yet implemented | services/orchestrator/main.py, env |
| H-005 | Scale | orchestrator | High | Pipeline runs as BackgroundTasks; no queue/job model | Add queue between gateway and orchestrator; workers process steps; run_state persists transitions | services/orchestrator/, infra |
| H-006 | Happy Path | orchestrator | Medium | Deploy signing flow may be incomplete | Verify full Thirdweb flow: plan to sign to submit to verify | apps/studio, services/deploy |
| H-007 | Happy Path | orchestrator | Medium | Monitoring agent not implemented | Implement post-deploy monitoring stage per issue 6/8 | services/orchestrator, agent-runtime |
| H-008 | QA | Studio | Low | useWorkflowProgress: SSE carries discussion events; full workflow state from polling | Consider extending SSE to include workflow status or document as intentional split | apps/studio/hooks/ |
| H-009 | Stress | E2E | High | Real-server verification not run in this pass | Run make verify-real-server; confirm auth, health, streaming pass | apps/studio, makefile |
| H-010 | Stress | RLS | Medium | RLS verification script not executed (Supabase timeout) | Run supabase/scripts/verify-rls-policies.sql manually | supabase/ |

---

## 3. Fixed in This Pass

H-001 (Persistence): Stopped workflow_state blob writes. update_workflow and create_workflow no longer call upsert_workflow_state. append_deployment uses upsert_workflow_artifacts. get_workflow falls back to project_artifacts when blob absent. Added get_workflow_rich_from_artifacts and get_run_project_id in db.py.

H-004 (Scale, partial): Production localhost handling hardened. Missing or localhost service URLs (COMPILE, AUDIT, AGENT_RUNTIME, SIMULATION, STORAGE, DEPLOY) now set startup degraded and cause /health to return 503. Service discovery and URL registry are not implemented.

---

## 4. Blocked Outside Repo

- Supabase connection timeout during MCP list_tables. RLS verification requires manual execution of supabase/scripts/verify-rls-policies.sql.

- Real-server verification executed: BLOCKED. Gateway and Studio were not running (make up and make run-web required). Output: "Gateway unreachable at http://localhost:4000". Proof requires operator to start stack and re-run make verify-real-server.

- Deployment blocked (2026-03-22): Node monorepo builds failed under `pnpm --frozen-lockfile` due to `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Root cause: package.json overrides (conditional entries such as esbuild@<=0.24.2, ai@<5.0.52, next@>=16.0.1, etc.) had drifted from lockfile. Fixed by regenerating pnpm-lock.yaml with `pnpm install --no-frozen-lockfile` and aligning Dockerfile pnpm version to 10.26.0. Runtime verification cannot proceed until Coolify redeploy succeeds.

- Vercel Studio build (2026-03-22): Build failed with `Module not found: Package path ./react is not exported from package ai`. Root cause: `ai@<5.0.52` override forced ai 5+, which moved React hooks to `@ai-sdk/react` and removed `ai/react`. Fix: removed `ai@<5.0.52` override so Studio stays on ai 4.x (4.3.19), which has `ai/react`. Regenerated pnpm-lock.yaml. Also fixed workflows/page.tsx type cast (Workflow → Record).

---

## 5. Duplicates Consolidated

Exploration confirms: agent-runtime duplicate simulate/deploy/pin routes were removed. Tenderly flows through simulation service. IPFS through storage service. No duplicate Tenderly or IPFS clients found at top level.

---

## 6. Logic Corrected

- store.py: removed upsert_workflow_state from update_workflow, create_workflow, append_deployment; rich data via upsert_workflow_artifacts.
- db.py: added get_workflow_rich_from_artifacts and get_run_project_id.
- main.py: production startup degraded when required service URLs missing or localhost; /health returns 503.

---

## 7. Test Coverage Added

None. Existing tests: orchestrator unit (12+), integration (5), Studio session/auth tests, Playwright real-server specs for auth-expiry-desync, auth-redirect, streaming-request-id.

---

## 8. Breaking Change Review

No breaking changes in this pass.

---

## 9. Remaining Risks

- EigenDA, Echidna, exploit-sim policy truthfulness: stubbed or partial per issues 7/8.

- H-004 partial: Production blocks localhost via degraded health; service discovery/registry not implemented. In non-production or when env not set, localhost defaults may still apply.

- Pipeline runs as background tasks. No queue/job model. Issue 8/8 not done.

- Acontext wired for search. Deploy signing and monitoring agent status need verification.

- Runtime verification not executed. Real-server E2E, RLS check, manual auth sanity, and API/Coolify URL alignment must pass before closed beta.

---

## 10. Final Ship Verdict

**Not production-ready. Blocked on runtime verification.**

Code and report are separate deliverables. This report reflects code state after H-001 and H-004 fixes. The ship label does not upgrade until the four operator checks produce proof artifacts.

### Code state (this pass)

- H-001 fixed: workflow_state blob writes retired. Rich data in run_state + project_artifacts only.
- H-004 partially fixed: Production blocks localhost via degraded health (503). Service discovery/registry not implemented.
- Real-server E2E and RLS verification: not executed (stack not running; Supabase timeout). No proof artifacts.

### Ship status

| Stage | Status |
|-------|--------|
| **Today** | Not production-ready. Runtime gates remain operator-blocked. |
| **After four checks pass** | Acceptable for closed beta. (Real-server E2E, RLS verification, manual auth sanity check, API/Coolify URL alignment.) |
| **After queue/job, provenance, happy-path gaps** | Approaching broader production readiness. |

### Do not claim

- Do not say provenance/security is near-finished. EigenDA and Echidna remain stubbed. Exploit-sim policy truth still needs validation.
- Do not imply full scale readiness. H-004 only blocks localhost in production via degraded health; service discovery does not exist. BackgroundTasks remain. Scale work open until queue/worker model and service discovery.
- Do not upgrade the label until real-server E2E, RLS verification, manual auth sanity, and API/Coolify URL alignment have been run and passed. Proof, not intentions.

### Hardcoded localhost

In non-production or when env is unset, localhost defaults may apply. Production startup now fails degraded until URLs are correct. Service discovery/registry (get_service_url or equivalent) is not implemented. High severity; ties to production env safety.
