"""Shared helpers for pipeline nodes. Extracted for modularization."""

from __future__ import annotations

import logging

from workflow_state import AgentState

logger = logging.getLogger(__name__)

STEP_ORDER = (
    "spec",
    "human_review",
    "design",
    "codegen",
    "security_check",
    "test_generation",
    "scrubd",
    "audit",
    "debate",
    "simulation",
    "security_policy_evaluator",
    "exploit_sim",
    "deploy",
    "monitor",
    "ui_scaffold",
)


def step_index(step_type: str) -> int:
    try:
        return STEP_ORDER.index(step_type)
    except ValueError:
        return 0


def step_start(run_id: str, step_type: str) -> None:
    import db

    idx = step_index(step_type)
    logger.info(
        "[pipeline] run_id=%s step_id=%s step_type=%s status=running",
        run_id,
        idx,
        step_type,
    )
    if db.is_configured() and run_id:
        db.insert_step(run_id, idx, step_type, status="running")
        db.insert_agent_log(run_id, step_type, step_type, "started", log_level="info")


async def step_complete(
    run_id: str,
    step_type: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict | None = None,
    output_json: dict | None = None,
) -> None:
    import db
    from trace_writer import write_trace

    status = "failed" if error_message else "completed"
    idx = step_index(step_type)
    logger.info(
        "[pipeline] run_id=%s step_id=%s step_type=%s status=%s",
        run_id,
        idx,
        step_type,
        status,
    )
    blob_id, da_cert, ref_block = None, None, None
    if db.is_configured() and run_id:
        blob_id, da_cert, ref_block = await write_trace(
            run_id, step_type, idx, status, output_summary, error_message, extra
        )
        db.update_step(
            run_id,
            step_type,
            status,
            output_summary=output_summary,
            error_message=error_message,
            trace_blob_id=blob_id,
            trace_da_cert=da_cert,
            trace_reference_block=ref_block,
            output_json=output_json,
        )
        db.upsert_run_state(
            run_id,
            phase=step_type,
            status=status,
            current_step=step_type,
        )
        msg = (error_message or output_summary or status)[:4096]
        db.insert_agent_log(
            run_id,
            step_type,
            step_type,
            msg,
            log_level="error" if error_message else "info",
        )


def estimate_complexity(prompt: str) -> int:
    from registries import get_roma_complexity_indicators

    indicators = get_roma_complexity_indicators()
    lower = prompt.lower()
    return min(sum(2 for w in indicators if w in lower), 10)


def resolve_user_prompt(state: AgentState) -> str:
    prompt = state.get("user_prompt", "")
    if prompt:
        return prompt
    run_id = state.get("run_id")
    if run_id:
        try:
            from store import get_workflow

            w = get_workflow(run_id)
            if w:
                return w.get("intent", "") or ""
        except Exception:
            pass
    return ""
