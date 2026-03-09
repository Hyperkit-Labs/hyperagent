"""
Step-level trace for observability: one logical span per pipeline step with run_id and step_id.
Log structured fields so logs can be filtered by run_id/step_id. When OpenTelemetry is added,
replace with real span creation and attach run_id and step_id as span attributes.
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
    When OpenTelemetry is integrated, create a span here and set attributes: run_id, step_id (run_id + step_type), step_type.
    """
    step_id = f"{run_id}:{step_type}:{step_index}"
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
        logger.info(
            "[step_span] end run_id=%s step_type=%s step_id=%s",
            run_id,
            step_type,
            step_id,
            extra={"run_id": run_id, "step_type": step_type, "step_id": step_id},
        )
