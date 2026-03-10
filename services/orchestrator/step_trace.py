"""
Step-level trace for observability: one logical span per pipeline step with run_id and step_id.
Log structured fields so logs can be filtered by run_id/step_id. When OPENTELEMETRY_ENABLED
is set, creates OpenTelemetry spans per step.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

logger = logging.getLogger(__name__)


@asynccontextmanager
async def step_span(
    run_id: str, step_type: str, step_index: int
) -> AsyncIterator[None]:
    """
    One span per pipeline step. Logs start/end with run_id and step_id for correlation.
    When OPENTELEMETRY_ENABLED is set, creates OpenTelemetry spans with run_id, step_id, step_type.
    """
    step_id = f"{run_id}:{step_type}:{step_index}"
    try:
        from otel_spans import span

        otel_ctx = span(
            f"pipeline.{step_type}",
            run_id=run_id,
            step_id=step_id,
            step_type=step_type,
        )
    except ImportError:
        otel_ctx = None

    if otel_ctx is not None:
        otel_ctx.__enter__()
    logger.info(
        "[step_span] start run_id=%s step_type=%s step_index=%s step_id=%s",
        run_id,
        step_type,
        step_index,
        step_id,
        extra={
            "run_id": run_id,
            "step_type": step_type,
            "step_index": step_index,
            "step_id": step_id,
        },
    )
    try:
        yield
    finally:
        if otel_ctx is not None:
            try:
                otel_ctx.__exit__(None, None, None)
            except Exception:
                pass
        logger.info(
            "[step_span] end run_id=%s step_type=%s step_id=%s",
            run_id,
            step_type,
            step_id,
            extra={"run_id": run_id, "step_type": step_type, "step_id": step_id},
        )
