# VectorDB Service

Qdrant-backed indexing and RAG for specs and templates. Vector size 1536 (OpenAI embeddings).

**Phase 2 scope**: This service may be stubbed or minimal in Phase 1 (MVP). Full RAG integration is planned for a later milestone.

## Env

- `QDRANT_URL` – Qdrant base URL (default `http://localhost:6333`)
- `OPENAI_API_KEY` – Used for embedding (index and query)

## Endpoints

- `POST /index/spec` – Index a spec (body: `spec`, `spec_id?`, `text?`). Embeds and upserts to collection `specs`.
- `POST /index/template` – Index a template (body: `template`, `template_id?`, `text?`). Embeds and upserts to collection `templates`.
- `POST /query` – RAG query (body: `query`, `collection` = specs|templates, `limit`). Returns `{ results: [{ id, score, payload }] }`.
- `GET /health` – Health and `qdrant_configured`.

## When indexing runs

Orchestrator or pipeline: when a spec is finalized (e.g. after spec_agent or approve_spec), call `POST /index/spec`. When a template is registered or finalized, call `POST /index/template`. Spec/design/codegen agents can call `POST /query` for RAG before generating.
