# Legacy / Unused / Dead-Code Risk Matrix

> Workstream 5. Each row classifies a marker by **active**, **shadowed**, **unreachable**, **stale-but-dangerous**, or **misleading-only**, with a recommended action.

| # | Site | Marker | Class | Risk | Recommended action |
| - | ---- | ------ | ----- | ---- | ------------------ |
| L-1 | `services/orchestrator/main.py:359 app.include_router(approve_spec_legacy_router)` | `_legacy` in name | active | **stale-but-dangerous** — production-mounted, no tests, no deprecation header | Add `Deprecation: true` header middleware + parity test vs canonical approve route. Tracked F-008 / F-016. |
| L-2 | `services/orchestrator/api/agent_lifecycle.py` (3 routers: `registry_router`, `a2a_router`, `erc8004_router`) | not mounted in `main.py` | **was unreachable** | **was stale-but-dangerous** — Studio called these routes; production returned 404 with `gateway_proxy` succeeding | **FIXED in this PR** — added imports + `app.include_router(...)` calls. |
| L-3 | `services/orchestrator/api/user_templates.py` (2 routers) | not mounted in `main.py` | **was unreachable** | same as L-2 | **FIXED in this PR**. |
| L-4 | `infra/docker/Dockerfile.compile.lite` | not used in production | shadowed | medium — drift over time | Pick canonical Dockerfile per service. F-012. |
| L-5 | `infra/docker/Dockerfile.<svc>` (bare variant) where `.monorepo` is used | shadowed | medium | F-012 |
| L-6 | `services/orchestrator/store.py:20,118,256` legacy markers | active code path | medium — risk of preferring legacy store over canonical | Tag canonical store, add tests. F-022. |
| L-7 | `services/orchestrator/db.py:195,197,1091` legacy markers | active | medium | same as L-6 |
| L-8 | `packages/api-contracts/src/generated/schema.ts:1369-1370` legacy/unused | generated | low | Regenerate from openapi; assert no diff in CI. F-017. |
| L-9 | `packages/agent-os/src/search/*` (RipgrepAdapter, SearchIntentRouter) | no consumer in `apps/*` | unused-but-tested | medium — duplicates `apps/studio/lib/tools/searchService.ts` | Decide canonical, drop the other. F-014, F-026. |
| L-10 | `apps/api-gateway/src/index.ts` legacy mounts (`/config`, `/workspaces`, `/workflows`, …) | active by design (legacy compat) | active | low | All paired with v1 strip-mount. Document the policy and add a deprecation header for the bare-mount path. |
| L-11 | `apps/studio/proxy.ts` Next.js dev proxy | active | active | medium | Add contract test parity vs gateway. F-009. |
| L-12 | `packages/api-contracts.GATEWAY_PUBLIC_PATHS` `/auth/bootstrap` (no `/api/v1` prefix) | dead — gateway only mounts the v1 path | unreachable | low | **FIXED in this PR** — entry removed. F-007. |
| L-13 | `services/orchestrator/x402_kite_facilitator.py` | "(legacy)" in module description (line 12) | shadowed? | medium — needs verification it isn't dispatched | Trace `from x402_kite_facilitator import *` usage. |
| L-14 | `MAX_AUTOFIX_CYCLES = 3` hardcoded in `workflow_state.py:9` | duplicated guard in `nodes.py`/`pipeline.py` | active but duplicated | low | Single import-site + parity assertion. F-015. |
| L-15 | `apps/studio/lib/thirdwebClient.ts:45,175` legacy/deprecated comments | active | active | low | Re-classify each line. |
| L-16 | `apps/studio/components/developer-tools/SearchPanel.tsx:18,29,63` "TODO" copy strings | UI copy | active | low — UI feature label, not a code path | None. |
| L-17 | `apps/studio/__tests__/lib/session-store.test.ts:122,125,130` "legacy" markers in test fixtures | test-only | active | low | None. |
| L-18 | `services/orchestrator/registries.py:397` legacy comment | active | medium | Verify code path. |
| L-19 | `services/orchestrator/api/agent_lifecycle.py:38,103,125,128` legacy markers | active (now mounted) | medium | Once mounted (this PR), classify each marker. |
| L-20 | `services/orchestrator/api/runs_registry.py:188,189,194,364` legacy markers | active | medium | Same. |
| L-21 | `services/orchestrator/contract_rpc.py:12,106` legacy comments | active | medium | Verify behavior parity. |
| L-22 | `packages/web3-utils/ipfs-pinata.ts:13` "deprecated" comment | active | low | Action depends on the comment text. |
