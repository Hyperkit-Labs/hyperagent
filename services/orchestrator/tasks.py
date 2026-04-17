"""
Celery tasks for the HyperAgent pipeline.

Each task maps 1:1 to a pipeline job. Celery handles:
- Retry with exponential backoff (autoretry_for + max_retries + retry_backoff)
- Dead-letter via Celery's built-in failure callbacks
- Real-time visibility via Flower dashboard

Import order: celery_app must be imported first to register the broker.
"""

from __future__ import annotations

import logging
import os

from celery import Task
from celery_app import app

logger = logging.getLogger(__name__)

_MAX_RETRIES = int(os.environ.get("QUEUE_MAX_RETRIES", "3"))


class _PipelineTask(Task):
    """Base task with structured error logging."""

    abstract = True

    def on_failure(self, exc: Exception, task_id: str, args, kwargs, einfo) -> None:
        run_id = kwargs.get("run_id") or (args[0] if args else "unknown")
        logger.error(
            "[celery] task %s failed permanently run_id=%s: %s",
            task_id,
            run_id,
            exc,
            exc_info=einfo,
        )

    def on_retry(self, exc: Exception, task_id: str, args, kwargs, einfo) -> None:
        run_id = kwargs.get("run_id") or (args[0] if args else "unknown")
        logger.warning(
            "[celery] task %s retrying run_id=%s (attempt %d/%d): %s",
            task_id,
            run_id,
            self.request.retries + 1,
            _MAX_RETRIES,
            exc,
        )


@app.task(
    base=_PipelineTask,
    bind=True,
    name="tasks.run_pipeline_task",
    max_retries=_MAX_RETRIES,
    # Exponential backoff: 60s → 120s → 240s between retries.
    autoretry_for=(Exception,),
    retry_backoff=60,
    retry_backoff_max=300,
    retry_jitter=True,
    acks_late=True,
)
def run_pipeline_task(
    self: Task,
    *,
    run_id: str,
    user_prompt: str,
    user_id: str = "",
    project_id: str = "",
    api_keys: dict | None = None,
    pipeline_id: str | None = None,
    checkpoint_id: str | None = None,
    agent_session_jwt: str | None = None,
    template_id: str | None = None,
    request_id: str | None = None,
    initial_state: dict | None = None,
    initial_state_override: dict | None = None,
    resume_update: dict | None = None,
) -> dict:
    """Execute a pipeline run. Called by Celery workers; retried automatically on failure."""
    from workflow import run_pipeline

    logger.info(
        "[celery] run_pipeline_task started run_id=%s attempt=%d",
        run_id,
        self.request.retries,
    )
    return run_pipeline(
        user_prompt=user_prompt,
        user_id=user_id,
        project_id=project_id,
        run_id=run_id,
        api_keys=api_keys or {},
        pipeline_id=pipeline_id,
        checkpoint_id=checkpoint_id,
        agent_session_jwt=agent_session_jwt,
        template_id=template_id,
        request_id=request_id,
        initial_state=initial_state,
        initial_state_override=initial_state_override,
        resume_update=resume_update,
    )
