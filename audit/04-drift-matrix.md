# Drift Matrix

> Workstream 3. Each row: a place where one layer's truth doesn't match another's.

| # | Surface A | Surface B | Drift | Severity | Finding |
| - | --------- | --------- | ----- | -------- | ------- |
| D-1 | `AGENTS.md` / `CLAUDE.md` Project Structure block | actual filesystem | 16 of 17 documented top-level dirs do not exist (`apps/hyperagent-{api,web}`, `services/agent-{spec,codegen,audit,deploy,verify,monitor}`, `services/blockchain-gateway`, `packages/{spec-dictionary,rag-kb,chain-registry,sdk-registry,shared-ui,core-lib}`) | high | F-001 |
| D-2 | `AGENTS.md` Mandatory Pre-Action `.cursor/rules/`, `.cursor/wiki/`, `.cursor/skills/`, `.cursor/llm/`, `llms.txt` | filesystem | None of those exist; only `llm.txt` (singular) | high | F-002 |
| D-3 | docs claim `Spec Lock` schema in `packages/spec-dictionary` | code | no class, no model, no validator — only an LLM prompt phrase in `services/roma-service/main.py` and `services/orchestrator/roma_inprocess.py` | high | F-003 |
| D-4 | TS `packages/workflow-state/src/pipeline-states.ts` `PIPELINE_STAGES` (13 enum) | Python `services/orchestrator/workflow_state.py` `current_stage: str` | TS has enum, Python has bare `str`; sync is by docstring only | medium | F-004, F-019 |
| D-5 | gateway proxy at `/agent-registry`, `/a2a`, `/erc8004` | orchestrator `api/agent_lifecycle.py` defines 25+ endpoints but `main.py` does NOT mount them | proxies forward to non-existent upstream → 404 on 25 endpoints; Studio `agentRegistry.ts` actively calls those routes | **HIGH (was; fixed in this PR via main.py + api/__init__.py)** | F-025 |
| D-6 | gateway proxy at `/user-templates`, `/artifacts` | orchestrator `api/user_templates.py` defines `router` and `artifacts_router` but `main.py` does NOT mount them | same as D-5 — 404 on 7 endpoints; Studio `userTemplates.ts` actively calls them | high (fixed in this PR) | F-027 |
| D-7 | api-contracts `GATEWAY_PUBLIC_PATHS` includes both `/auth/bootstrap` and `/api/v1/auth/bootstrap` | gateway only mounts the v1 path | bare `/auth/bootstrap` is dead allow-list entry | low | F-007 |
| D-8 | Studio middleware public path matcher | `GATEWAY_PUBLIC_PATHS` in api-contracts | independently maintained lists | medium | F-013 |
| D-9 | gateway `proxy.ts` `selfHandleResponse=true` rewrites 5xx body | orchestrator emits FastAPI `{detail}` envelope | 4xx body shape leaks through; Studio code expects `{error,message}` | medium | F-006 |
| D-10 | `apps/studio/proxy.ts` (Next.js dev) | `apps/api-gateway/src/proxy.ts` (production) | independent path-rewrite + auth-forwarding logic; can pass dev tests while production fails (KNOWN_PATH_PREFIXES regression class — PR #441) | high | F-009 |
| D-11 | gateway BYOK router | orchestrator `llm_keys_router` | three independent envelopes; no shared schema | medium | F-010 |
| D-12 | studio chat hook `byok` envelope | gateway `byok` router | same drift family as above | medium | F-010 |
| D-13 | `services/orchestrator/agents/exploit_simulation_agent.py:24` reads `DEFIHACKLABS_PATH` env, defaults to `./data/DeFiHackLabs` (almost certainly missing in containers) | UI shows "no exploit risks" when corpus is missing | silent degraded mode produces false success | medium | F-011 |
| D-14 | `infra/docker/Dockerfile.compile`, `Dockerfile.compile.lite`, `Dockerfile.compile.monorepo` | one used in production compose, others maintained but shadowed | duplicate build surface guarantees future drift | medium | F-012 |
| D-15 | `services/orchestrator/store.py:20,118,256` legacy markers | corresponding canonical paths | duplicate stores with no parity test | medium | F-022 |
| D-16 | `packages/agent-os/src/search/*` | `apps/studio/lib/tools/searchService.ts` | duplicate Ripgrep wrapper | medium | F-014 |
| D-17 | `packages/api-contracts/src/generated/schema.ts:1369` legacy/unused marker | openapi source | hand-edited generated file | low | F-017 |
| D-18 | gateway issues JWT cookie | orchestrator does not require identity-create round-trip before issuance | mint-without-upstream-record | medium | F-005 |
| D-19 | `apps/studio/middleware.ts` reads JWT cookie as auth signal | gateway is the only legit verifier | UI can render "signed in" while every API call 502s | medium | F-021 |
| D-20 | `MAX_AUTOFIX_CYCLES = 3` in `workflow_state.py` | runtime guards in `nodes.py` and `pipeline.py` | duplicate constant; no parity test | low | F-015 |
| D-21 | x402 spread across 103 files | no canonical settlement verifier | gating-logic risk | high | F-018 |
| D-22 | `pipeline.py` `/generate` POST | accepts free-form prompt with no size cap | pre-LLM cost burn | high | F-024 |
| D-23 | `agent_lifecycle.py` `/erc8004/sync` route | Studio gates UI behind `NEXT_PUBLIC_ERC8004_SYNC_ENABLED` flag explaining "indexer not deployed" | UI knows backend is missing; both flag and dead-mount need to be aligned post-fix | medium | F-025 fix follow-up |
| D-24 | `services/orchestrator/main.py:358 approve_spec_legacy_router` | no test coverage | naming declares legacy, no removal date or deprecation header | medium | F-008, F-016 |
