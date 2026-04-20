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

_OTEL_ENABLED = os.environ.get("OPENTELEMETRY_ENABLED", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

_tracer = None


def _otlp_http_traces_endpoint() -> str:
    """Resolve OTLP/HTTP traces URL (must end with /v1/traces for the HTTP exporter)."""
    raw = (
        os.environ.get("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "").strip()
        or os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    )
    if not raw:
        return ""
    u = raw.rstrip("/")
    if "/v1/traces" in u:
        return u
    if "/v1/metrics" in u:
        return u.replace("/v1/metrics", "/v1/traces")
    return f"{u}/v1/traces"


def _get_tracer():  # type: ignore[no-untyped-def]
    global _tracer
    if _tracer is not None:
        return _tracer
    if not _OTEL_ENABLED:
        return None
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        endpoint = _otlp_http_traces_endpoint()
        if endpoint:
            try:
                from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                    OTLPSpanExporter,
                )

                exporter = OTLPSpanExporter(endpoint=endpoint, timeout=3)
                provider = TracerProvider()
                provider.add_span_processor(
                    BatchSpanProcessor(
                        exporter,
                        max_export_batch_size=128,
                        schedule_delay_millis=5000,
                        export_timeout_millis=3000,
                    )
                )
                trace.set_tracer_provider(provider)
            except ImportError:
                logger.debug(
                    "opentelemetry-exporter-otlp not installed, spans in-process only"
                )

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


@contextmanager
def request_span(
    method: str, path: str, request_id: str | None = None
) -> Generator[None, None, None]:
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
