# ADR 0002: API and schema governance

## Status

Accepted

## Context

The monorepo has multiple service boundaries (orchestrator, gateway, agents, Studio). Without explicit rules, HTTP contracts and JSON event payloads can drift from documentation and clients.

## Decision

1. **HTTP:** Use `/api/v1` with FastAPI as source of truth; commit generated OpenAPI under `packages/api-contracts/openapi/openapi.json` and derive TypeScript types from it.

2. **Events, webhooks, traces:** Maintain a **schema registry** (`packages/schema-registry/`) with versioned directories (`v1`, `v2`, …) and a machine-readable manifest.

3. **CI:** Run OpenAPI breaking detection (oasdiff), registry validation (fixtures + JSON Schema syntax), and a heuristic JSON Schema breaking check on pull requests.

## Consequences

- Contributors must run `pnpm run contracts:generate` when changing FastAPI routes (or rely on CI failure).
- New event or webhook shapes require a schema file and preferably a fixture under `packages/schema-registry/fixtures/`.
- Major incompatible changes require version folder bumps or new API prefixes, not silent edits.
