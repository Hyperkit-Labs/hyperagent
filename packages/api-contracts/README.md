# @hyperagent/api-contracts

OpenAPI-derived types and HTTP client helpers for the orchestrator.

## Generate

From repo root (requires orchestrator Python deps for `export_openapi.py`):

```bash
pnpm run contracts:generate
```

This refreshes `openapi/openapi.json` and `src/generated/schema.ts`.
It also refreshes the canonical Spec Lock mirror:

- `openapi/spec-lock.schema.json`
- `src/generated/spec-lock.schema.ts`

## Governance

See `docs/reference/api-governance.md`. HTTP surface area is versioned under `/api/v1`. Non-REST JSON payloads (SSE events, webhooks, traces, and generated contracts such as Spec Lock) are documented under `packages/schema-registry/`.
