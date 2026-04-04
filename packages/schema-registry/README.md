# Schema registry

Canonical **JSON Schema** definitions for payloads that are **not** fully modeled in OpenAPI: workflow stream events, inbound storage webhooks, and trace/agent output blobs.

## Layout

```
manifest.json              # Index of schemas (id, path, stability)
workflow-events/v1/        # SSE / pipeline JSON events
storage-webhooks/v1/       # Pinata and compatible providers
agent-outputs/v1/        # Trace blobs and structured outputs
fixtures/                  # Valid examples; validated in CI
```

## Versioning

- **Major version** = directory (`v1`, `v2`). Breaking changes add a new major directory; old majors remain until consumers migrate.
- Within a major version, prefer **additive** schema changes (new optional properties).

## Validation

From repo root:

```bash
python scripts/schema/validate_registry.py
```

Breaking change vs base ref (local):

```bash
python scripts/schema/check_json_schema_breaking.py --base-ref origin/main
```

See `docs/api-governance.md` for policy.
