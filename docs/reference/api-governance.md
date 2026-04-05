# API and schema governance

This document defines how HyperAgent avoids version drift across HTTP APIs, event streams, webhooks, and agent/trace payloads.

## 1. API versioning (HTTP)

- **URL prefix:** All public orchestrator HTTP APIs use **`/api/v1/`**. New major versions appear as **`/api/v2/`** alongside v1 until deprecation ends.
- **Source of truth:** The orchestrator FastAPI app. The committed OpenAPI document is generated from code:

  ```bash
  pnpm run contracts:generate
  ```

  Output: `packages/api-contracts/openapi/openapi.json` and TypeScript types under `packages/api-contracts/src/generated/`.

- **Consumers:** Studio and tooling import **`@hyperagent/api-contracts`**. Do not hand-roll path strings without checking the OpenAPI operation or generated client.

- **Breaking changes (HTTP):** Any change that removes an operation, removes or renames a request field, narrows response types, or adds a **required** request field is **breaking**. Breaking changes require a semver bump of `@hyperagent/api-contracts`, release notes, and (when applicable) a new `/api/v2` tree or an agreed migration period.

- **Non-breaking:** Adding optional query/body fields, adding new operations, adding optional response properties.

## 2. Schema registry (non-HTTP payloads)

Canonical JSON Schemas live under **`packages/schema-registry/`**. Use this for:

| Area | Path | Purpose |
|------|------|---------|
| Workflow / SSE-style events | `workflow-events/v1/` | Pipeline stream events (`data: {...}` JSON) |
| Storage webhooks | `storage-webhooks/v1/` | Pinata-compatible pin webhook bodies |
| Agent outputs / traces | `agent-outputs/v1/` | Trace blobs and structured agent outputs |

- **Version folders:** **`v1`**, **`v2`**, … are immutable major lines. Prefer additive changes inside a major version; incompatible shapes get a **new major folder** (`v2/`) rather than silent edits to v1.

- **Manifest:** `packages/schema-registry/manifest.json` lists each schema id, path, and stability. CI validates every listed file and fixtures.

- **Relationship to OpenAPI:** OpenAPI describes REST; the registry describes **event and webhook JSON** that may never appear as OpenAPI operations. Both are governed; both are checked in CI.

## 3. Compatibility checks in CI

| Check | What it does |
|-------|----------------|
| **OpenAPI breaking** | Compares base branch `openapi.json` to PR head using **oasdiff** (`breaking` mode). Fails on incompatible API changes unless the check is intentionally waived (see below). |
| **Registry syntax + fixtures** | Validates JSON Schema drafts and that example fixtures validate against their schemas. |
| **JSON Schema breaking (heuristic)** | Compares each `*.schema.json` at merge-base vs HEAD: flags removed properties, stricter `required`, or `type` changes. |

## 4. Waiving a check (exception process)

If a breaking change is intentional (e.g. major release):

1. Document it in the PR description and changelog.
2. Bump **`@hyperagent/api-contracts`** version appropriately.
3. For emergencies only, a maintainer may add a **temporary** label or path allowlist in the workflow (discouraged; remove after release).

## 5. Ownership

- Orchestrator routes: backend team; OpenAPI regeneration is mandatory when routes change.
- Registry schemas: own the folder next to the code that emits the JSON; update fixtures when payloads change.

## References

- `packages/api-contracts/` — OpenAPI generation
- `packages/schema-registry/` — JSON Schema registry
- `scripts/api/check_openapi_breaking.sh` — local OpenAPI diff
- `scripts/schema/validate_registry.py` — registry + fixtures validation
- `scripts/schema/check_json_schema_breaking.py` — schema breaking heuristic
