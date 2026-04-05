# Workflow and state management (OSS baseline)

This document ties together **server authority**, **UI state machines**, **append-only run history**, **job queues**, and **idempotency** so runs, retries, webhooks, deploy steps, and billing stay reliable.

## 1. Source of truth

| Layer | Mechanism | Role |
|-------|-----------|------|
| **Orchestrator** | **LangGraph** graph + **Redis** checkpointer (`REDIS_URL` TCP) | Canonical pipeline state and resume |
| **Studio (UI)** | **XState** (`@hyperagent/workflow-state`) | Reflects server stage/status; does not drive the graph |
| **Persistence** | Supabase `runs`, `run_steps`, `agent_logs`, `run_state` | Durable records and audit trail |

The UI machine must only transition on **SYNC** events fed from API polling, SSE, or React Query cache updates. Never treat the client as authoritative for pipeline progression.

## 2. State machine library (frontend)

- Package: **`@hyperagent/workflow-state`** (`packages/workflow-state/`).
- Exports: **`derivePipelineUiBucket`**, **`hyperagentPipelineUiMachine`** (XState v5).
- Usage in React:

```tsx
import { useMachine } from "@xstate/react";
import { hyperagentPipelineUiMachine } from "@hyperagent/workflow-state";

const [state, send] = useMachine(hyperagentPipelineUiMachine);
// After fetch: send({ type: "SYNC", stage: workflow.current_stage, runStatus: workflow.status });
```

## 3. Event sourcing and append-only run logs

**Authoritative progression** lives in LangGraph checkpoints (Redis) plus Supabase.

**Append-only style** (do not delete history for a successful audit trail):

- **`run_steps`**: insert a row when a step starts; update **the same row** for completion/error and trace IDs. Avoid deleting rows for completed runs.
- **`agent_logs`**: **insert-only** stream of log lines for SSE and observability.
- **Billing / payments**: `insert_payment` uses **`idempotency_key`** to prevent duplicate rows (see `payments_supabase.py`).

For full event sourcing (replay), a future phase can add an **`run_events`** append-only table or Kafka topic; today’s model is **checkpoint + relational steps/logs**.

## 4. Job queue discipline

Standard worker stack (already in the repo):

| Env | Meaning |
|-----|---------|
| `QUEUE_ENABLED=1` | Enqueue pipeline jobs to Redis |
| `REDIS_URL` | **TCP** URL (e.g. Upstash `rediss://`), shared with LangGraph checkpointer |
| Keys | `queue:hyperagent:pipeline` (FIFO), `queue:hyperagent:dead` (DLQ) |
| `QUEUE_MAX_RETRIES` | Re-enqueue limit before DLQ |
| Entry | `services/orchestrator/queue_client.py` |
| Consumer | `services/orchestrator/worker.py` (separate process/container) |

**API gateway** rate limiting uses **Upstash REST** (`UPSTASH_REDIS_*`), not this TCP queue. Do not mix roles on the same Redis DB without key namespacing.

## 5. Idempotency key pattern

| Surface | Behavior |
|---------|-----------|
| **Pipeline** | `Idempotency-Key` / `idempotency-key` header → dedupe by user + key (`api/pipeline.py`) |
| **Payments** | `idempotency_key` column + lookup before insert |
| **Codegen proxy** | Optional `X-Idempotency-Key` short TTL cache (`services/codegen/main.py`) |
| **Helpers** | `services/orchestrator/idempotency_util.py` (`normalize_idempotency_key`, `composite_idempotency_key`, `redis_dedupe_key`) |

**Webhook handlers** should treat provider delivery retries as normal: verify signatures, then perform **idempotent** side effects (e.g. reconcile by CID, skip if already reconciled).

## 6. Retries

- **Queue worker**: retries with `_retries` in job payload; overflow → dead queue.
- **HTTP clients**: use idempotency keys on POST that allocate resources or move money.
- **Outbox pattern** (future): emit billing events to an append-only outbox table keyed by idempotency id.

## References

- `services/orchestrator/workflow.py` — LangGraph + Redis checkpointer
- `services/orchestrator/queue_client.py`, `worker.py`
- `packages/workflow-state/`
- `services/orchestrator/idempotency_util.py`
- `docs/adrs/0003-workflow-state-oss.md`
