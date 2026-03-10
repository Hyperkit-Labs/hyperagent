"""
Optional OpenTelemetry spans for pipeline steps. No-op when OPENTELEMETRY_ENABLED
is unset or opentelemetry packages are not installed.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Any, Generator

logger = logging.getLogger(__name__)

_OTEL_ENABLED = (
    os.environ.get("OPENTELEMETRY_ENABLED", "").strip().lower()
    in ("1", "true", "yes")
)

_tracer = None


def _get_tracer():  # type: ignore[no-untyped-def]
    global _tracer
    if _tracer is not None:
        return _tracer
    if not _OTEL_ENABLED:
        return None
    try:
        from opentelemetry import trace

        _tracer = trace.get_tracer("hyperagent.orchestrator", "0.1.0")
        return _tracer
    except ImportError:
        logger.debug("opentelemetry not installed, spans disabled")
        return None


@contextmanager
def span(
    name: str,
    run_id: str | None = None,
    step_id: str | None = None,
    step_type: str | None = None,
    **attrs: Any,
) -> Generator[None, None, None]:
    """Create an OpenTelemetry span when enabled. No-op otherwise."""
    t = _get_tracer()
    if t is None:
        yield
        return
    try:
        with t.start_as_current_span(name) as s:
            if run_id:
                s.set_attribute("run_id", run_id)
            if step_id:
                s.set_attribute("step_id", step_id)
            if step_type:
                s.set_attribute("step_type", step_type)
            for k, v in attrs.items():
                if v is not None:
                    s.set_attribute(k, str(v))
            yield
    except Exception as e:
        logger.debug("otel span error: %s", e)
        yield
