"""
Optional OpenTelemetry spans for HTTP requests. No-op when OPENTELEMETRY_ENABLED
is unset or opentelemetry packages are not installed.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Generator

logger = logging.getLogger(__name__)

_OTEL_ENABLED = (
    os.environ.get("OPENTELEMETRY_ENABLED", "").strip().lower()
    in ("1", "true", "yes")
)

_tracer = None


def _get_tracer():
    global _tracer
    if _tracer is not None:
        return _tracer
    if not _OTEL_ENABLED:
        return None
    try:
        from opentelemetry import trace
        _tracer = trace.get_tracer("hyperkit.compile", "0.1.0")
        return _tracer
    except ImportError:
        logger.debug("opentelemetry not installed, spans disabled")
        return None


@contextmanager
def request_span(method: str, path: str, request_id: str | None = None) -> Generator[None, None, None]:
    """Create an HTTP request span when OPENTELEMETRY_ENABLED. Use in middleware."""
    t = _get_tracer()
    if t is None:
        yield
        return
    try:
        with t.start_as_current_span("http.request") as s:
            s.set_attribute("http.method", method)
            s.set_attribute("http.url", path)
            if request_id:
                s.set_attribute("request_id", request_id)
            yield
    except Exception as e:
        logger.debug("otel request span error: %s", e)
        yield
