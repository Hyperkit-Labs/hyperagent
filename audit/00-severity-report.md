# Severity-Ranked Findings Report

> Source of truth: `audit/findings.json`. This file is the human-readable view.

**Counts:** 0 critical · 10 high · 13 medium · 4 low · 1 blocker.

## High

### F-001 — Documented project structure does not match repository reality
- `AGENTS.md` / `CLAUDE.md` / `README.md` describe `apps/hyperagent-{api,web}` and `services/agent-{spec,codegen,audit,deploy,verify,monitor}` and `packages/{spec-dictionary,rag-kb,chain-registry,sdk-registry,shared-ui,core-lib}`.
- 16 of 17 documented paths do not exist. Real paths are `apps/{api-gateway, studio}` + `services/{orchestrator, audit, codegen, compile, deploy, simulation, agent-runtime, sandbox-docker, roma-service, storage, vectordb, context, hyperagent-tools}` + `packages/{ai-tools, api-contracts, backend-clients, backend-middleware, config, core-types, execution-backend, frontend-data, sdk-ts, ui, web3-utils, workflow-state, agent-os, schema-registry, contract-security-rules, contract-validation, mcp-pashov-auditor, pashov-skills, security-audit}`.
- **Fix in this PR:** rewrite the Project Structure section in both `AGENTS.md` and `CLAUDE.md`.

### F-002 — `.cursor/*` Pre-Action protocol references files that don't exist
- `Mandatory Pre-Action (Global)` section requires reading `.cursor/rules/`, `.cursor/wiki/`, `.cursor/skills/`, `.cursor/llm/` before any code change.
- None of those directories exist. The actual file is `llm.txt` (singular), but the docs reference `llms.txt`.
- **Fix in this PR:** rewrite the Pre-Action section to point at real files (`AGENTS.md`, `llm.txt`, `docs/`, `audit/`).

### F-003 — "Spec Lock" is a marketing concept, not a schema
- Mentioned 5+ times across `AGENTS.md`, `CLAUDE.md`, `README.md`, prominently as `packages/spec-dictionary  # Spec Lock schemas`.
- Real implementation: a docstring + LLM prompt in `services/roma-service/main.py` and `services/orchestrator/roma_inprocess.py`. There is **no** `SpecLock` class, no Pydantic model, no Zod schema, no JSON schema, no validator. The model output is whatever the LLM emits.
- **Fix in this PR:** drop the `packages/spec-dictionary` reference from the docs and tag the existing `SpecModel` (in roma) as the canonical spec contract. Real schema enforcement tracked as a follow-up.

### F-009 — Two independent proxies forward to the orchestrator with different rules
- `apps/studio/proxy.ts` (Next.js dev) and `apps/api-gateway/src/proxy.ts` (production HTTP) both rewrite paths and forward auth headers — independently maintained. Studio dev can mask gateway-side bugs.
- **Fix in this PR:** added `apps/studio/lib/__tests__/proxy-vs-gateway-contract.test.ts` (a contract test that fixtures the same input through both and diffs the resulting outbound URL/header set). Failing diffs become explicit findings.

### F-018 — x402 gating is spread across 103 files with no single canonical verifier
- Highest-blast-radius gating concern: gateway can mark requests billable and orchestrator has a single `/settlement` POST. No HMAC/signature check is evident in the file layout.
- **Tracked, not fixed in this PR** — needs a dedicated audit pass and product decision on the settlement-trust model.

### F-019 — `current_stage` is `str` with no validator
- `services/orchestrator/workflow_state.py:46` declares `current_stage: str`. The TS canonical list in `packages/workflow-state` has 13 stages and a comment-only sync rule.
- A node typing `'desigh'` instead of `'design'` will pass typing and silently strand the UI in `idle`.
- **Fix in this PR:** added a `set_current_stage(state, stage)` validator + a parity test that scans `nodes.py` for direct writes.

### F-020 — Gateway tests are unit-level only; no integration suite catches drift between gateway proxies and orchestrator routers
- 86 gateway tests pass but every one mocks the orchestrator. The previously-fixed `KNOWN_PATH_PREFIXES` issue (PR #441) is exactly this class.
- **Fix in this PR:** added `audit/scripts/route-probe.ts` skeleton + `apps/api-gateway/src/orchestrator-routes.contract.test.ts` (static-parity).

### F-024 — `pipeline.py` `/generate` accepts a free-form prompt with no size cap before LLM dispatch
- Mirrors the SIWE/thirdweb size cap finding from PR #458, but on the much higher-cost prompt side. A 2 MB prompt burns BYOK credits before any check.
- **Tracked, not fixed in this PR.**

### F-025 — `/a2a` and `/erc8004` proxy mounts on the gateway have no upstream orchestrator routers
- `apps/api-gateway/src/index.ts:194-208` proxies `/a2a` → `/api/v1/a2a` and `/erc8004` → `/api/v1/erc8004`. Neither router is exported from `services/orchestrator/api/__init__.py`.
- Every `/api/v1/a2a/...` request will 404 from upstream while the gateway happily forwards.
- **Fix in this PR:** added a static-parity test that fails if any gateway mount has no upstream router.

## Medium

See `findings.json` (F-004, F-005, F-006, F-008, F-010, F-011, F-012, F-013, F-014, F-016, F-021, F-022, F-026).

## Low

See `findings.json` (F-007, F-015, F-017, F-023).

## Blockers

### WS10 — Full docker-compose runtime proof
- 18 Dockerfiles + 30+ env vars from `.env.example` + Supabase/Upstash/thirdweb credentials needed.
- **Harness added in this PR:** `audit/scripts/route-probe.ts` so the next pass with credentials can run probes immediately and commit JSON to `audit/08-runtime-proof/`.
- Workstream stays COMMITTED. Not silently descoped.
