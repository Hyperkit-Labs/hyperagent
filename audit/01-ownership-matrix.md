# Ownership Matrix

> Workstream 1: who actually owns each domain in the live code, where the duplicate ownership lives, where ownership is unclear, and which concept claims are stale.

## Domain → real owner

| Domain | Frontend (apps/studio) | Gateway (apps/api-gateway) | Orchestrator (services/orchestrator) | Other services / packages | Status |
| ------ | ---------------------- | -------------------------- | ------------------------------------ | ------------------------- | ------ |
| auth (JWT) | `lib/authBootstrap.ts`, `middleware.ts` | `src/auth.ts`, `src/authBootstrap.ts` (canonical issuer) | re-validates via header (`x-user-id`, `x-user-id-sig`) | `@hyperagent/api-contracts` exports `GATEWAY_PUBLIC_PATHS` | **Canonical**: gateway. Studio middleware duplicates the public-path list (F-013). |
| wallet / SIWE | `lib/thirdwebClient.ts`, hooks/useAppChat | `src/authBootstrap.ts` (verify SIWE / thirdweb) | downstream consumer of `walletAddress` | thirdweb SDK | **Canonical**: gateway issues, orchestrator trusts via signed header. |
| prompt ingestion | chat hook | proxy passthrough only | `api/pipeline.py:/generate` | — | **Canonical**: orchestrator. Missing size validation (F-024). |
| workflow creation | `lib/api/workflows.ts` | proxy | `api/workflows.py` | — | **Canonical**: orchestrator. |
| agent orchestration (LangGraph) | (none) | (none) | `workflow.py`, `nodes.py`, `agents/*` | — | **Canonical**: orchestrator. |
| code generation | (display only) | (none) | calls `services/codegen` and `agents/codegen_agent.py` | `services/codegen` | **Split**: orchestrator dispatches, codegen service runs. |
| contract testing | (none) | (none) | calls `services/compile` | `services/compile`, foundry-tests | **Canonical**: compile service. |
| auditing | display | proxy | `agents/audit_agent.py` + `services/audit` | `services/audit`, `packages/mcp-pashov-auditor` | **Canonical**: audit service + Pashov MCP package. Three audit identities co-exist (F-014 sibling). |
| simulation | display | proxy | `agents/simulation_agent.py`, `agents/exploit_simulation_agent.py` | `services/simulation` | **Canonical**: simulation service + agents. F-011: silent fallback when corpus missing. |
| deployment | display | proxy | `agents/deploy_agent.py` | `services/deploy` | **Canonical**: deploy service. |
| billing / credits / x402 | `lib/api/billing.ts` UI | `src/x402.ts` | `api/billing.py`, `api/x402_webhooks.py` | `packages/api-contracts` | **Spread across 103 files.** F-018: no single canonical x402 verifier. |
| artifact export | UI export view | proxy | `api/ui_export.py` | `services/storage` | Canonical: orchestrator. |
| run history | UI table | proxy | `api/runs_registry.py` (incl. `approve_spec_legacy_router`) | — | **Mostly orchestrator.** F-008 + F-016: legacy router still mounted, untested. |
| metrics / health | UI dashboard | `/health/*` direct + proxy | `api/metrics_health.py` | — | Canonical: gateway for `/health`, orchestrator for detailed. |
| BYOK | `lib/byok` UI | `src/byok.ts` (mount `/api/v1/byok`) | `llm_keys_router` in `runs_registry.py` | — | **Three places** (F-010). |
| stage / pipeline state | XState in `packages/workflow-state` | (none) | `workflow_state.py` (`current_stage: str`) | `packages/workflow-state` | **Duplicate ownership** (F-004, F-019). |
| public-path allow-list | `apps/studio/middleware.ts` (independent list) | `@hyperagent/api-contracts.GATEWAY_PUBLIC_PATHS` | (none) | — | **Duplicate enumeration** (F-013). |

## Duplicate ownership identified

| # | Domain | Owners | Finding |
| - | ------ | ------ | ------- |
| 1 | Pipeline stage strings | TS `packages/workflow-state` + Python `services/orchestrator/workflow_state.py` | F-004, F-019 |
| 2 | Orchestrator HTTP forwarding | `apps/studio/proxy.ts` + `apps/api-gateway/src/proxy.ts` | F-009 |
| 3 | BYOK validation | gateway + orchestrator + studio | F-010 |
| 4 | Public-path allow-list | api-contracts + studio middleware | F-013 |
| 5 | Repository search (Ripgrep wrapper) | `packages/agent-os/src/search/*` + `apps/studio/lib/tools/searchService.ts` | F-014 |

## Unowned truth

| # | Truth | Where it leaks | Fix direction |
| - | ----- | -------------- | ------------- |
| 1 | x402 settlement integrity | spread across 103 files; no single owner asserted | Designate `services/orchestrator/api/x402_webhooks.py` as canonical and require HMAC. F-018. |
| 2 | Whether `current_stage` writes are valid stages | nodes.py and pipeline.py both write directly | Single setter `set_current_stage` (F-019, fixed in this PR). |
| 3 | Spec Lock schema | docs claim `packages/spec-dictionary`, no code ownership | Tag `SpecModel` as canonical or write a real schema. F-003. |

## Stale concept claims

| Concept | Doc claim | Real status |
| ------- | --------- | ----------- |
| Spec Lock | `packages/spec-dictionary` schema package | docstring + LLM prompt only; no schema. **STALE.** (F-003) |
| `.cursor/rules` Pre-Action protocol | mandatory in AGENTS.md | directory does not exist. **STALE.** (F-002) |
| `apps/hyperagent-{api,web}` | top of AGENTS.md | actual = `apps/{api-gateway, studio}`. **STALE.** (F-001) |
| `services/agent-{spec,codegen,audit,deploy,verify,monitor}` | per-agent service decomposition | rolled into `services/orchestrator` LangGraph + worker services. **STALE.** (F-001) |
| A2A (`/api/v1/a2a`) | gateway proxies it | no orchestrator router mounted. **STALE / drift.** (F-025) |
| ERC-8004 (`/api/v1/erc8004`) | gateway proxies it | no orchestrator router mounted. **STALE / drift.** (F-025) |
| ROMA service | top-level service | implemented (`services/roma-service`) **AND** in-process fallback (`services/orchestrator/roma_inprocess.py`). Duplicate-ownership risk if both run. |
| SCRUBD | claimed in `AgentState` (`scrubd_validation_passed`, `scrubd_findings`) | 18 files reference it; appears live but trust contract unclear. Tracked. |
| Pashov Auditor | `packages/mcp-pashov-auditor` | live; consumed by audit agent. |
| Autofix Loop | `MAX_AUTOFIX_CYCLES = 3` in workflow_state.py | live; constant duplicated (F-015). |
| Guardian Agent | `agents/guardian_agent.py` (12 file matches) | live. |
| Workflow State / Run State | `packages/workflow-state` + orchestrator | duplicated (F-004). |
| SKALE Base | `SKALE_BASE_MAINNET_CAIP` constant in api-contracts | live. |
