# Recovery runbook

Operational rules for **timeouts**, **reconnect**, **stale state**, **retry budget**, and **stop conditions** across sessions, workers, and remote execution.

## Timeout handling

| Layer | Guidance |
|-------|----------|
| HTTP client | Set connect and read timeouts; never infinite wait on external APIs |
| Worker job | Wall-clock timeout per task stage; emit `timeout` status with last known step |
| UI | Show stalled state after threshold; offer cancel and retry |

On timeout: persist **last checkpoint** if the workflow supports it; otherwise mark **failed** with resumable hint.

## Reconnect handling

- **Client reconnect:** Revalidate session token; refresh CSRF or wallet session as required by gateway rules.
- **Worker reconnect:** Reclaim queue lease with idempotency key; refuse duplicate processing without dedupe store.
- **SSE/WebSocket:** Backoff with jitter; cap attempts; surface degraded mode in UI.

## Stale state handling

- Compare **server version** or **ETag** on run records before merging UI edits.
- If local draft conflicts with server: **prompt** or **auto-save branch** per product rules; never silent overwrite.

## Retry budget

- Define **max attempts**, **backoff**, and **idempotency keys** for outbound calls and queue jobs.
- Retries belong only where operations are **safe to repeat** (read-only GET with cache, idempotent writes with keys).

## Stop conditions

Stop retrying when:

- Error class is **non-transient** (4xx validation, auth denial).
- Budget exhausted.
- User canceled.
- Safety policy trips (rate limit, anomaly detection).

## Incident checklist

1. Identify **layer** (client, gateway, worker, third party).
2. Collect **correlation ID** across logs.
3. Classify **transient vs permanent**.
4. Apply **rollback** docs for the changed subsystem if deploy-related.

## Cross-links

- Task states: [task-lifecycle-spec.md](task-lifecycle-spec.md)
- Permissions on destructive recovery: [permission-approval-policy.md](permission-approval-policy.md)

---

**Index:** [Agent operating model](README.md)
