"""
Trace writer: build AgentTraceBlob-shaped payload, return stub blob_id for run_steps.
Stub IDs ensure run_steps.trace_blob_id is always set (storage policy).
"""
from __future__ import annotations

from typing import Any


def build_trace_payload(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a minimal AgentTraceBlob v1-shaped payload for this step (no large blobs in Postgres).
    Includes ERC-8004 agent identity when available for provenance."""
    payload: dict[str, Any] = {
        "version": "1",
        "run_id": run_id,
        "step_type": step_type,
        "step_index": step_index,
        "status": status,
        "output_summary": (output_summary or "")[:1024],
        "error_message": (error_message or "")[:512] if error_message else None,
    }
    try:
        from registries import get_erc8004_agent_identity
        identity = get_erc8004_agent_identity()
        if identity:
            payload["agent"] = identity
    except Exception:
        pass
    if extra:
        payload.update(extra)
    return payload


def write_trace(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> tuple[str | None, str | None, str | None]:
    """
    Return stub blob_id for run_steps. Caller stores blob_id in run_steps via update_step.
    extra: optional dict merged into payload (e.g. discussion_trace for debate steps).
    """
    _ = build_trace_payload(run_id, step_type, step_index, status, output_summary, error_message, extra)
    stub_id = _stub_trace_id(run_id, step_type, step_index)
    return stub_id, None, None


def _stub_trace_id(run_id: str, step_type: str, step_index: int) -> str:
    """Deterministic stub blob_id; ensures run_steps.trace_blob_id is always set."""
    return f"stub:{run_id}:{step_type}:{step_index}"
