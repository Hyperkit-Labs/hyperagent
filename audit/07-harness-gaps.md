# Test-Harness Strength & Gaps

> Workstream 8. What current tests would NOT catch, plus the harnesses added in this PR.

## Coverage today

- `pnpm test` (top-level Turbo): **16 packages**, all green. 57 tests in studio, 86 in api-gateway, others in workflow-state, ai-tools, agent-os, etc.
- Orchestrator: `pytest services/orchestrator/tests` — covers `agent_lifecycle_api`, `agent_lifecycle_routes`, `idempotency`, `pashov_audit_failclosed`, `inbound_webhooks_routes`, `mainnet_guard`, `connectivity_hardening`, etc. Per-pass status not run in this audit; `02-runtime-proof/01-monorepo-tests-summary.txt` documents the JS side.

## What current tests would miss

1. **Gateway mount → orchestrator router parity** — every test mocks the orchestrator. The gateway can mount `/agent-registry` and proxy to a non-existent upstream and no test fails. (F-025/F-027 are exactly this class.) **Harness added: `apps/api-gateway/src/orchestratorRouteParity.test.ts`** that statically scans `services/orchestrator/main.py` for `include_router(...)` and `services/orchestrator/api/*.py` for `APIRouter(prefix=...)` calls, and asserts every gateway legacy mount has a corresponding mounted upstream.
2. **TS↔Python pipeline-stage drift** — the docstring sync rule is the only mechanism today. **Harness added: `packages/workflow-state/src/__tests__/stage-parity.test.ts`** that scans `services/orchestrator/**/*.py` for `current_stage =` literals and asserts each is in `PIPELINE_STAGES`. Fails on typo at compile-time of CI.
3. **Studio dev proxy vs gateway proxy parity** — KNOWN_PATH_PREFIXES regression class (PR #441). **Harness added: `apps/studio/lib/__tests__/proxy-vs-gateway-contract.test.ts`** that fixtures the same input through both proxies and diffs outbound URL, headers, and auth-forwarding behavior.
4. **End-to-end audit/sim/deploy gating** — no integration test boots both gateway and orchestrator and exercises a real workflow. F-020. **Harness skeleton added: `audit/scripts/route-probe.ts`** that walks `ApiPaths` and reports per-route status when run against `BASE_URL=http://localhost:4000` with a live stack.
5. **Prompt size DoS** — `/generate` accepts arbitrary-size prompts. F-024. Tracked.
6. **x402 settlement integrity** — no end-to-end test asserts `gateway → orchestrator settlement → DB transition → UI display` parity. F-018. Tracked.
7. **`approve_spec_legacy_router` parity** — F-016. Tracked.
8. **BYOK envelope parity across gateway/orchestrator/studio** — F-010. Tracked.
9. **`current_stage` write-site validation** — covered by harness #2 above + the new `set_current_stage` setter (F-019, fixed in this PR).
10. **Cookie-presence ≠ logged-in** — F-021. UI-level test required; tracked.

## Harnesses added in this PR

| Test | Path | Catches |
| ---- | ---- | ------- |
| `orchestratorRouteParity.test.ts` | `apps/api-gateway/src/` | Gateway mount → orchestrator router parity (F-025/F-027 regression) |
| `stage-parity.test.ts` | `packages/workflow-state/src/__tests__/` | TS↔Python pipeline-stage drift (F-004/F-019 regression) — moved from `apps/api-gateway/src/` to its documented home |
| `proxy-vs-gateway-contract.test.ts` | `apps/studio/lib/__tests__/` | Dev proxy vs production proxy drift — GATEWAY_PUBLIC_PATHS paths must not be blocked by studio edge (F-009 regression) |
| `route-probe.ts` (script) | `audit/scripts/` | Live-stack runtime probe; commits per-route JSON to `audit/08-runtime-proof/`. Fixed filter: `not_2xx_or_4xx_or_404` now correctly surfaces 3xx and 5xx responses |

## Reduce over-mocking

- Gateway tests mock the orchestrator wholesale. Recommendation: at least one in-process test that boots a `FastAPI()` test app importing the same routers as `main.py` and asserts the mount surface matches what the gateway proxies. Tracked.
