# Control plane: runs and steps

This document describes the phased control-plane design: explicit runs and step-level auditability, with a thin control plane and optional async execution.

## Phase 1 (implemented)

- **`run_steps` table**  
  One row per pipeline step per run. Columns: `run_id`, `step_index`, `step_type`, `status` (pending | running | completed | failed), `input_summary`, `output_summary`, `error_message`, `started_at`, `completed_at`, `trace_blob_id`, `trace_da_cert`, `trace_reference_block`.  
  Migration: `platform/supabase/migrations/run.sql`.

- **Writing steps from the pipeline**  
  Each LangGraph node writes steps via `db.insert_step` and `db.update_step`:
  - At node start: insert/upsert step with `status=running`, `started_at=now`.
  - At node end: update step to `status=completed` or `status=failed`, with `output_summary` or `error_message`, `completed_at=now`, and optional trace blob IDs.

- **Step order**  
  `spec`, `design`, `codegen`, `scrubd`, `audit`, `debate`, `simulation`, `exploit_sim`, `deploy`, `ui_scaffold`. Defined in `services/orchestrator/nodes.py` (`STEP_ORDER`).

- **No change to Studio or API contract**  
  The existing "single blocking POST" flow is unchanged. Steps are written only when Supabase is configured (`db.is_configured()`).

- **API**  
  - `GET /api/v1/runs/{run_id}/steps` returns the step-level audit for a run (for polling or debugging).

- **`scrubd_validation` step**  
  Mandatory SCRUBD validation runs after codegen and before audit. Validates contracts against RE (reentrancy) and UX (unhandled exceptions) patterns from the SCRUBD dataset. On failure, routes to autofix or failed. Configure via `SCRUBD_PATH` and `SCRUBD_VERSION`.

- **Pashov solidity-auditor (optional)**  
  When `PASHOV_AUDIT_ENABLED=true`, the audit step also runs an AI-driven security review using the pashov/skills solidity-auditor. Findings are merged with Slither/Mythril results and subject to the same pass/fail gates. Requires the `packages/pashov-skills` submodule and BYOK (LLM keys via workspace). Configure via `PASHOV_AUDIT_ENABLED` and `PASHOV_SKILLS_PATH`.

## Phase 2 (planned)

- Create run + first step(s), enqueue a "run pipeline" job, return `run_id` immediately.
- Worker (or orchestrator process) consumes the job and runs the existing LangGraph, updating `runs` and `run_steps` as it goes.
- Studio switches to polling (or SSE) on `/runs/:id` and `/runs/:id/steps` instead of waiting on the POST response.

## Phase 3 (later)

- Per-step jobs: each worker pops a step, executes, writes output, enqueues next step.
- Guardrail steps (e.g. policy_check, post_check) and enforced ordering.

## References

- DB helpers: `services/orchestrator/db.py` (`insert_step`, `update_step`, `get_steps`).
- Node wiring: `services/orchestrator/nodes.py` (`_step_start`, `_step_complete`). All nodes write steps.
- Trace writer: `services/orchestrator/trace_writer.py`; migration `006_run_steps_trace.sql` (if present).
