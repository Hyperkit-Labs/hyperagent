"""
Structured logging: ensure run_id, request_id, step_id propagate to all log records.
Use extra= in logger calls; this module provides a filter that injects trace context.
"""

from __future__ import annotations

import logging
from typing import Any

from trace_context import get_request_id

_TRACE_EXTRA_KEYS = ("run_id", "request_id", "step_id", "step_type", "step_index")


class TraceContextFilter(logging.Filter):
    """Inject request_id from context into log records when not already set."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            rid = get_request_id()
            if rid:
                record.request_id = rid
        return True


def log_extra(
    run_id: str | None = None,
    request_id: str | None = None,
    step_id: str | None = None,
    step_type: str | None = None,
    step_index: int | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Build extra dict for structured logging. Merges trace context."""
    out: dict[str, Any] = dict(kwargs)
    if run_id:
        out["run_id"] = run_id
    if request_id:
        out["request_id"] = request_id
    elif not out.get("request_id"):
        rid = get_request_id()
        if rid:
            out["request_id"] = rid
    if step_id:
        out["step_id"] = step_id
    if step_type:
        out["step_type"] = step_type
    if step_index is not None:
        out["step_index"] = step_index
    return out
