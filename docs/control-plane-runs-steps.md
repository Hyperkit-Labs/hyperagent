# Control plane: runs and steps

This document describes the phased control-plane design: explicit runs and step-level auditability, with a thin control plane and optional async execution.

## Phase 1 (implemented)

- **`run_steps` table**  
  One row per pipeline step per run. Columns: `run_id`, `step_index`, `step_type`, `status` (pending | running | completed | failed), `input_summary`, `output_summary`, `error_message`, `started_at`, `completed_at`.  
  Migration: `platform/supabase/migrations/run.sql`.

- **Writing steps from the pipeline**  
  Each LangGraph node (spec, design, codegen, audit, simulation, deploy, ui_scaffold) writes:
  - At node start: insert/upsert step with `status=running`, `started_at=now`.
  - At node end: update step to `status=completed` or `status=failed`, with `output_summary` or `error_message`, `completed_at=now`.

- **No change to Studio or API contract**  
  The existing "single blocking POST" flow is unchanged. Steps are written only when Supabase is configured (`db.is_configured()`).

- **API**  
  - `GET /api/v1/runs/{run_id}/steps` returns the step-level audit for a run (for polling or debugging).

## Phase 2 (planned)

- Create run + first step(s), enqueue a "run pipeline" job, return `run_id` immediately.
- Worker (or orchestrator process) consumes the job and runs the existing LangGraph, updating `runs` and `run_steps` as it goes.
- Studio switches to polling (or SSE) on `/runs/:id` and `/runs/:id/steps` instead of waiting on the POST response.

## Phase 3 (later)

- Per-step jobs: each worker pops a step, executes, writes output, enqueues next step.
- Guardrail steps (e.g. policy_check, post_check) and enforced ordering.

## References

- DB helpers: `services/orchestrator/db.py` (`insert_step`, `update_step`, `get_steps`).
- Node wiring: `services/orchestrator/nodes.py` (`_step_start`, `_step_complete`). All seven nodes (spec, design, codegen, audit, simulation, deploy, ui_scaffold) write steps.
