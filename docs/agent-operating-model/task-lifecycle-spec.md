# Task lifecycle spec

Tasks are **tracked units of work** with visible state, terminal outcomes, and cleanup. This spec applies to orchestrator jobs, background workers, and any future task UI.

## Task types (examples)

| Type | Description | Typical owner |
|------|-------------|---------------|
| **Local task** | Runs on developer machine or CI runner without remote delegate | CLI, scripts |
| **Remote task** | Runs in a hosted worker or external environment | Orchestrator worker |
| **Subagent task** | Delegated to a constrained agent with its own context | Agent-runtime delegated run |
| **Workflow task** | Multi-step pipeline unit with durable ID | LangGraph / orchestrator |
| **Watchdog / monitor task** | Long-lived observation with periodic ticks | Monitor agent, cron |

## Task states

Minimum state set:

`pending` → `running` → `completed` | `failed` | `killed`

Optional substates (implementation-specific):

- `running:retrying` — bounded retries in progress
- `pending:scheduled` — deferred start

## Terminal conditions

- **completed:** Success criteria met; outputs persisted per contract.
- **failed:** Error recorded; resources released per cleanup rules; may be retried only if policy allows.
- **killed:** User or operator aborted; partial outputs marked invalid unless explicitly checkpointed.

## Cancellation semantics

- **User cancel:** Stop scheduling new steps; send cancel signal to running step; wait for acknowledgement or timeout.
- **System cancel:** Triggered by policy (quota, safety); same as user cancel but audited as system-initiated.

## Cleanup semantics

- Delete ephemeral credentials and temp files for the task scope.
- Release locks and queue leases.
- Idempotent cleanup: running cleanup twice must be safe.

## Missing discipline to avoid

- Tasks without **terminal states** (zombie work).
- Silent discard of partial artifacts without trace ID or user-visible status.

See [recovery-runbook.md](recovery-runbook.md) for timeout and reconnect interaction with tasks.

---

**Index:** [Agent operating model](README.md)
