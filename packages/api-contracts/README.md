# @hyperagent/api-contracts

OpenAPI-derived types and HTTP client helpers for the orchestrator.

## Generate

From repo root (requires orchestrator Python deps for `export_openapi.py`):

```bash
pnpm run contracts:generate
```

This refreshes `openapi/openapi.json` and `src/generated/schema.ts`.

## Governance

See `docs/api-governance.md`. HTTP surface area is versioned under `/api/v1`. Non-REST JSON payloads (SSE events, webhooks, traces) are documented under `packages/schema-registry/`.
