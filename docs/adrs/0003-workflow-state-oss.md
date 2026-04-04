# ADR 0003: Workflow state OSS (XState UI, LangGraph authority, queue + idempotency)

## Status

Accepted

## Context

Pipeline runs span long-running agents, webhooks, deploy steps, and billing. Without clear boundaries, client and server state drift, duplicate side effects, and retries corrupt data.

## Decision

1. **Server authority:** LangGraph with Redis checkpointing remains the only driver of pipeline transitions.
2. **Studio:** Use **XState** (`@hyperagent/workflow-state`) as a **read-only mirror** updated via explicit SYNC events from API data.
3. **History:** Treat `run_steps` + `agent_logs` as an append-oriented audit trail; avoid destructive deletes of completed step history.
4. **Jobs:** Standardize on **Redis list queue** + `worker.py` with documented keys and DLQ (`queue_client.py`).
5. **Idempotency:** Centralize key normalization in `idempotency_util.py`; continue header-based dedupe in pipeline and keyed inserts in payments.

## Consequences

- New UI features that represent pipeline state should import `@hyperagent/workflow-state` or `derivePipelineUiBucket` rather than ad-hoc string checks.
- Optional Redis `SET NX` locks can be added for hot paths using the same `REDIS_URL` as the queue.
