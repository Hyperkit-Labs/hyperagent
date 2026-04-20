"""
Structured logging: ensure run_id, request_id, step_id propagate to all log records.
Use extra= in logger calls; this module provides a filter that injects trace context.
"""

from __future__ import annotations

import logging
from typing import Any

from trace_context import get_request_id

_TRACE_EXTRA_KEYS = ("run_id", "request_id", "step_id", "step_type", "step_index")

# Keys that must never appear in log payloads (prompt injection / PII).
_REDACT_KEYS = frozenset(
    {
        "prompt",
        "message",
        "content",
        "messages",
        "api_key",
        "token",
        "authorization",
        "password",
        "secret",
    }
)


def _redact_log_value(key: str, value: Any) -> Any:
    lk = key.lower().replace("-", "_")
    if lk in _REDACT_KEYS or any(
        s in lk for s in ("api_key", "secret", "token", "password", "credential")
    ):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {k: _redact_log_value(k, v) for k, v in value.items()}
    if isinstance(value, list):
        out: list[Any] = []
        for item in value[:50]:
            if isinstance(item, dict):
                out.append({ik: _redact_log_value(ik, iv) for ik, iv in item.items()})
            else:
                out.append(item)
        return out
    return value


class TraceContextFilter(logging.Filter):
    """Inject request_id from context into log records when not already set."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            rid = get_request_id()
            # Always set so custom Formatters using %(request_id)s never raise.
            record.request_id = rid or ""
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
    out: dict[str, Any] = {k: _redact_log_value(k, v) for k, v in kwargs.items()}
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
