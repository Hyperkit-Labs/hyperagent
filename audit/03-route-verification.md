# Route Verification Matrix

> Workstream 7. Routes are listed by (gateway mount → orchestrator router → backing path). `STATUS` reflects static + harness verification; runtime probes flagged as **NEEDS-LIVE-STACK** are blocked by WS10.

## Method

1. Enumerated gateway proxies in `apps/api-gateway/src/index.ts` (`createOrchestratorLegacyMountProxy` × 22, `createOrchestratorStripMountProxy` × 5).
2. Enumerated orchestrator routers in `services/orchestrator/api/__init__.py` and `services/orchestrator/main.py:include_router(...)`.
3. Cross-checked every gateway mount to a registered orchestrator router with the same prefix.

## Findings

| Gateway mount | Forwards to | Orchestrator router | Status |
| ------------- | ----------- | ------------------- | ------ |
| `/api/v1` (strip-mount) | `/api/v1/...` | (catch-all) | OK — covers all `/api/v1/...` registered routers |
| `/run`, `/runs`, `/api`, `/docs`, `/openapi.json` (strip-mount) | various | (orchestrator FastAPI defaults) | OK |
| `/config` (legacy) | `/api/v1/config` | `config_router` | OK |
| `/workspaces` (legacy) | `/api/v1/workspaces` | `llm_keys_router` (prefix `/api/v1/workspaces/current`) | OK only if subpath matches |
| `/workflows` (legacy) | `/api/v1/workflows` | `workflows_router`, `pipeline_router`, `ui_export_router`, `debug_sandbox_router` | OK |
| `/agent-registry` (legacy) | `/api/v1/agent-registry` | `agent_registry_router` (defined in `agent_lifecycle.py`) | **WAS DEAD** — defined but not mounted in `main.py` until this PR. Studio actively calls these routes from `apps/studio/lib/api/agentRegistry.ts`. **Fixed in this PR (F-025).** |
| `/a2a` (legacy) | `/api/v1/a2a` | `a2a_router` (defined in `agent_lifecycle.py`) | **WAS DEAD** — same as above. Fixed in this PR. |
| `/erc8004` (legacy) | `/api/v1/erc8004` | `erc8004_router` (defined in `agent_lifecycle.py`) | **WAS DEAD** — same as above. Studio gates this UI behind `NEXT_PUBLIC_ERC8004_SYNC_ENABLED` flag (default off), so end-user impact was hidden. Fixed in this PR. |
| `/user-templates` (legacy) | `/api/v1/user-templates` | `user_templates.router` | **WAS DEAD** — `user_templates` module is *not* exported from `api/__init__.py` and *not* mounted in `main.py` either. Tracked as F-027 (added). |
| `/artifacts` (legacy) | `/api/v1/artifacts` | `user_templates.artifacts_router` | **WAS DEAD** — same as above. Tracked as F-027. |
| `/streaming` (legacy) | `/api/v1/streaming/workflows` | `workflows_streaming_router` | OK |
| `/presets`, `/blueprints`, `/templates`, `/networks`, `/agents`, `/contracts`, `/logs`, `/metrics`, `/security`, `/pricing`, `/tokens`, `/infra`, `/quick-demo` | `/api/v1/...` | various routers in `runs_registry`, `metrics_health`, `infra`, `billing` | OK |
| `/api/v1/auth/bootstrap` (gateway-internal) | (gateway) | n/a — gateway-issued JWT | OK |
| `/api/v1/byok` (gateway-internal) | (gateway) | n/a | OK |
| `/platform/track-record` and `/api/v1/platform/track-record` | gateway-internal | n/a | OK (resolved via `metrics_health` for the v1 variant) |

## Frontend-called routes (apps/studio/lib/api/*) → backend reality

| Frontend constant | Path | Backend status |
| ----------------- | ---- | -------------- |
| `ApiPaths.workflows` | `/api/v1/workflows` | OK |
| `ApiPaths.workflowsGenerate` | `/api/v1/workflows/generate` | OK (no size cap — F-024) |
| `ApiPaths.workspacesCurrentLlmKeys` | `/api/v1/workspaces/current/llm-keys` | OK |
| `ApiPaths.creditsBalance` | `/api/v1/credits/balance` | OK |
| `ApiPaths.paymentsSummary` | `/api/v1/payments/summary` | OK |
| `ApiPaths.pricingPlans` | `/api/v1/pricing/plans` | OK |
| `ApiPaths.agentRegistryAgents` | `/api/v1/agent-registry/agents` | **was 404** (F-025), fixed in this PR |
| `ApiPaths.agentRegistryCapabilities` | `/api/v1/agent-registry/capabilities` | **was 404** (F-025), fixed in this PR |
| `ApiPaths.a2aTasks` | `/api/v1/a2a/tasks` | **was 404** (F-025), fixed in this PR |
| `ApiPaths.erc8004Sync` | `/api/v1/erc8004/sync` | **was 404** (F-025) — UI gated by feature flag, fixed in this PR |
| `ApiPaths.erc8004Agents` | `/api/v1/erc8004/agents/{id}` | same |
| `ApiPaths.userTemplates` | `/api/v1/user-templates` | **was 404** (F-027), tracked |
| `ApiPaths.artifacts` | `/api/v1/artifacts` | **was 404** (F-027), tracked |

## Harness added in this PR

- `apps/api-gateway/src/orchestratorRouteParity.test.ts` — static parity test that scans `services/orchestrator/main.py` `include_router(*)` and asserts every gateway legacy mount has a corresponding mounted orchestrator router. Will fail if F-025 / F-027 regress.

## Runtime probe (skeleton)

`audit/scripts/route-probe.ts` walks `ApiPaths`, hits each route against `BASE_URL`, and reports per-route status / shape mismatches. Designed to run against `make up-local`.
