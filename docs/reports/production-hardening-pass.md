# Production hardening pass (trace: config / llm-keys stalls)

## Executive production audit

Studio showed `config` and `llm-keys` requests in Chrome DevTools as **(canceled)** after **~35s** and **~45s**, with **~1 min** total page finish. Orchestrator access logs for the same era show **`GET /api/v1/config` → 200** and **`GET /api/v1/workspaces/current/llm-keys` → 200** when the upstream completes. The gateway log file referenced in the task was **not present** in the workspace ([MISSING] `external/docs/Fixes/today/api-gateway-…134749135484…txt`).

Conclusion: the dominant failure mode is **not** “orchestrator never returns JSON for these routes when healthy,” but **client-observed hangs and aborts** driven by **timeout and proxy misalignment**, plus normal **AbortController** behavior surfacing as **(canceled)** in DevTools.

## Newly discovered issues

| Title | Severity | Notes |
| --- | --- | --- |
| Gateway default `PROXY_TIMEOUT_MS` (was 25s) below Studio `CONFIG_BOOTSTRAP_TIMEOUT_MS` (45s) and `BYOK_REQUEST_TIMEOUT_MS` (35s) | **High** | Gateway can end the proxied connection to the orchestrator while the browser is still waiting, producing stalled fetches and eventual **client-side** abort. |
| `fetchJson` AbortError not normalized to a timeout / 408-style error when the timer fires | **Medium** | Users and logs see generic **AbortError** / “canceled” instead of an explicit timeout message. |
| `external/docs/Fixes/today/api-gateway-…134749135484…txt` missing from repo | **Info** | Cannot correlate edge/gateway behavior for that incident window. |

## Fixed in this pass

- **`packages/config/src/gateway-env.ts`:** Default **`proxyTimeoutMs`** raised from **25s → 120s** with a comment tying it to Studio bootstrap/BYOK timeouts.
- **`apps/studio/lib/api/core.ts`:** When **`AbortError`** comes from **our** timeout (`!init.signal`), throw a normalized error with **`wasTimeout`** messaging and **`status: 408`** so Session/bootstrap UX can treat it as timeout, not an opaque cancel.
- **`packages/config/src/gateway-env.test.ts`:** Asserts new default and override behavior.
- **`.env.example` / `infra/docker/README.md`:** Document **PROXY_TIMEOUT_MS** relative to Studio and SSE.

## Blocked outside repo

- **Edge load balancer / CDN** idle timeouts (if any) below **120s** can still reset connections; verify on **Coolify / Nginx / cloud LB** configs.
- **Supabase or HTTP/2** long-tail stalls: mitigated elsewhere (retries, client refresh) but not eliminated by this change alone.

## Duplicates consolidated

None in this pass (single canonical gateway env builder and single `fetchJson` timeout path).

## Logic corrected

- **Timeout hierarchy:** gateway proxy default must not be **shorter** than the slowest intentional Studio call for the same hop (bootstrap config, BYOK read).

## Test coverage added

- **`buildGatewayEnv`** default / explicit **`PROXY_TIMEOUT_MS`** test.

## Breaking change review

- **Operational:** Deployments that depended on **25s** gateway proxy cutoff will now wait up to **120s** before the gateway drops an idle upstream connection. That is **more** tolerant of slow orchestrator/DB; it slightly increases worst-case connection hold time. Override **`PROXY_TIMEOUT_MS`** if a stricter cap is required.

## Remaining risks

- **`track-record`** and other heavy paths may still be slow on cold DB; monitor p95 upstream latency.
- **React Strict Mode** or **navigation** can still abort fetches independently of timers (still shows **(canceled)**).
- **RUM / ad blockers** can fail unrelated requests (noise in Network tab).

## Final ship verdict

**Conditionally ready for user onboarding:** align **`PROXY_TIMEOUT_MS`** in production shared env with product needs (**≥120s** for normal API; **660000+** for long SSE as already documented). After deploy, verify **`/api/v1/config`** and **llm-keys** complete within **p95 &lt; 10s** under load; if not, investigate orchestrator/Supabase, not only the browser.
