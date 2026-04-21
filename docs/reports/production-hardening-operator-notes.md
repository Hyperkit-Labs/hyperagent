# Operator notes — proxy vs Studio timeouts

## Environment

- **`PROXY_TIMEOUT_MS`** (api-gateway): Socket/idle timeout for proxy to the orchestrator. **Code default is now 120000 ms.** Set **660000** (or higher) if you serve **long SSE** streams from the same gateway (see `infra/docker/README.md`).
- **Studio (browser):**
  - **`NEXT_PUBLIC_CONFIG_BOOTSTRAP_TIMEOUT_MS`** — default **45000** (`apps/studio/lib/api/core.ts`).
  - **`NEXT_PUBLIC_BYOK_REQUEST_TIMEOUT_MS`** — default **35000** (llm-keys and BYOK mutations).

**Rule:** Keep **`PROXY_TIMEOUT_MS` ≥ max(Studio bootstrap, BYOK, expected upstream p99)** plus margin. Never run production with a **shorter** gateway proxy timeout than the Studio client for the same request class.

## Deployment order

1. Deploy **api-gateway** with updated **`@hyperagent/config`** (new default) **or** explicit **`PROXY_TIMEOUT_MS=120000`** minimum.
2. Deploy **Studio** if you change public timeout envs.
3. Deploy **orchestrator** independently; no migration required for this pass.

## Post-deploy verification

1. Cold load **`ai.hyperkitlabs.com`** (or staging): Network tab should show **`config`** completing **without** **(canceled)** when the API is healthy.
2. **`GET /api/v1/config`** and **`GET /api/v1/workspaces/current/llm-keys`** via gateway: expect **&lt; 10s** p95 under normal load.
3. **SSE / streaming** route: confirm streams stay up past **120s**; if not, raise **`PROXY_TIMEOUT_MS`** to **660000** as in `.env.example`.

## Rollback

- Set **`PROXY_TIMEOUT_MS=25000`** only if you intentionally want aggressive gateway cutoff (not recommended with current Studio defaults).
- Revert **`apps/studio/lib/api/core.ts`** timeout normalization if a downstream consumer mishandles **408** (unlikely).
