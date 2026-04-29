# Duplicate / Confusion / Bad-Practice / Downgrade Matrix

> Workstream 6.

## Duplicates

| # | Concept | Owner A | Owner B | Other | Finding |
| - | ------- | ------- | ------- | ----- | ------- |
| DUP-1 | Pipeline stage strings | `packages/workflow-state/src/pipeline-states.ts` (TS enum) | `services/orchestrator/workflow_state.py` (`current_stage: str`) | docstring sync | F-004 / F-019 |
| DUP-2 | Orchestrator HTTP forwarder | `apps/api-gateway/src/proxy.ts` (production) | `apps/studio/proxy.ts` (Next.js dev) | — | F-009 |
| DUP-3 | BYOK validation | gateway `byok.ts` | orchestrator `llm_keys_router` | studio chat byok | F-010 |
| DUP-4 | Public-path allow-list | `GATEWAY_PUBLIC_PATHS` in api-contracts | studio middleware matcher | — | F-013 |
| DUP-5 | Repository search (Ripgrep) | `packages/agent-os/src/search/*` (RipgrepAdapter, SearchIntentRouter) | `apps/studio/lib/tools/searchService.ts` | — | F-014 |
| DUP-6 | ROMA spec dispatch | `services/roma-service/main.py` (HTTP service) | `services/orchestrator/roma_inprocess.py` (in-process fallback) | env switch | medium |
| DUP-7 | Autofix cycle bound | `MAX_AUTOFIX_CYCLES = 3` in `workflow_state.py` | runtime guards in `nodes.py`, `pipeline.py` | — | F-015 |
| DUP-8 | Dockerfile per service | `Dockerfile.<svc>` | `Dockerfile.<svc>.monorepo` (+ `.lite`) | one used in production compose | F-012 |
| DUP-9 | Public path entry | `/auth/bootstrap` | `/api/v1/auth/bootstrap` (only this is mounted) | — | F-007 |
| DUP-10 | Workflow store | `services/orchestrator/store.py` (3 legacy markers) | `services/orchestrator/db.py` | — | F-022 |
| DUP-11 | Validation rules | `apps/studio/lib/api/*` zod-like ad-hoc | gateway zod | orchestrator pydantic | spread |

## Confusion

| # | Symptom | Where | Note |
| - | ------- | ----- | ---- |
| CON-1 | "Spec Lock" doc claim vs LLM prompt-only implementation | docs + roma | F-003 |
| CON-2 | Two `registry_router` symbols (one in `runs_registry.py`, one in `agent_lifecycle.py`) | orchestrator | F-025 fix imports as `agent_registry_router` to disambiguate. |
| CON-3 | `apps/api-gateway/src/index.ts` mounts `/api` strip-mount AND `/api/v1` strip-mount | gateway | overlapping prefixes; order-dependent. |
| CON-4 | Three audit identities: `services/audit`, `agents/audit_agent.py`, `packages/mcp-pashov-auditor` | orchestrator | unclear which is canonical for a given run |
| CON-5 | `register_agent_router` defined in `agent_lifecycle.py` AND a different `registry_router` in `runs_registry.py` (covers `/networks`) | orchestrator | F-025 |

## Bad practices

| # | Practice | Where | Risk |
| - | -------- | ----- | ---- |
| BAD-1 | Hidden fallback: silent default for `DEFIHACKLABS_PATH` produces "no findings" when corpus missing | `services/orchestrator/agents/exploit_simulation_agent.py:24` | F-011 |
| BAD-2 | `current_stage: str` (no `Literal[...]`) | `services/orchestrator/workflow_state.py:46` | F-019 |
| BAD-3 | Hand-maintained allow-list in studio middleware | `apps/studio/middleware.ts` | F-013 |
| BAD-4 | 4xx error shape passes through unchanged while 5xx is normalized | `apps/api-gateway/src/proxy.ts` | F-006 |
| BAD-5 | `/generate` accepts arbitrary-size prompt, no validation before LLM dispatch | `services/orchestrator/api/pipeline.py` | F-024 |
| BAD-6 | x402 settlement webhook may not verify HMAC on inbound | `services/orchestrator/api/x402_webhooks.py` | F-018 |
| BAD-7 | UI cookie presence treated as auth state | `apps/studio/middleware.ts` | F-021 |
| BAD-8 | Comment-only sync rule between TS package and Python orchestrator stages | `packages/workflow-state/src/pipeline-states.ts:2` | F-004 |

## Downgrade patterns

| # | Pattern | Evidence |
| - | ------- | -------- |
| DG-1 | New abstraction over old, dead abstraction (gateway proxy → orchestrator router that doesn't exist) | F-025 / F-027 — gateway mounts for `/agent-registry`, `/a2a`, `/erc8004`, `/user-templates`, `/artifacts` exist; upstream routers were defined but never mounted in `main.py`. Fixed in this PR. |
| DG-2 | UI fallback masks backend gap | F-021 — Studio middleware uses cookie presence; `apps/studio/components/agents/RegistryAgentsPanel.tsx` has a "feature disabled" copy ("requires working POST /erc8004/sync") that hides the dead-mount problem. |
| DG-3 | Optimistic UI hiding backend weakness | F-011 — exploit simulator silently returns "no findings" when corpus is missing |
| DG-4 | Wrapper over wrapper without single owner | F-009 (studio + gateway proxies) |
| DG-5 | Feature surface broader than real implementation | F-003 (Spec Lock concept exceeds its schema), F-001 (docs describe more services than exist) |
| DG-6 | Legacy fallback still reachable | `approve_spec_legacy_router` mounted in production with no test coverage (F-008, F-016) |
| DG-7 | Multiple Dockerfiles per service guarantees long-term drift | F-012 |
