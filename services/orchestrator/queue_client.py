"""
Job queue bridge for HyperAgent pipeline.

Dispatch modes (evaluated in order):
  1. Celery  — when CELERY_ENABLED=1 and REDIS_URL is set. Provides retry backoff,
               Flower visibility, priority routing, and true dead-letter queues.
  2. Redis   — when QUEUE_ENABLED=1 and REDIS_URL is set. Hand-rolled BLPOP/RPUSH.
               Kept for environments that can't install Celery.
  3. Direct  — synchronous in-process call (no queue). Used for dev/low-volume.

Set REDIS_URL (TCP) and CELERY_ENABLED=1 for production workers.
"""

from __future__ import annotations

import json
import logging
import os

from redis_util import effective_redis_url

logger = logging.getLogger(__name__)

QUEUE_KEY = "queue:hyperagent:pipeline"
DEAD_QUEUE_KEY = "queue:hyperagent:dead"
QUEUE_ENABLED = (os.environ.get("QUEUE_ENABLED") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
CELERY_ENABLED = (os.environ.get("CELERY_ENABLED") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
QUEUE_MAX_RETRIES = int(os.environ.get("QUEUE_MAX_RETRIES", "3"))


def _get_redis():
    url = (
        os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or ""
    ).strip()
    if not url:
        return None
    try:
        import redis

        return redis.from_url(effective_redis_url(url), decode_responses=True)
    except Exception as e:
        logger.warning("[queue] Redis unavailable: %s", e)
        return None


def _enqueue_celery(job: dict) -> bool:
    """Dispatch job as a Celery task. Returns True on success."""
    try:
        from tasks import run_pipeline_task

        run_pipeline_task.apply_async(
            kwargs={
                "run_id": job.get("run_id") or job.get("workflow_id", ""),
                "user_prompt": job.get("nlp_input") or job.get("user_prompt", ""),
                "user_id": job.get("user_id", ""),
                "project_id": job.get("project_id", ""),
                "api_keys": job.get("api_keys", {}),
                "pipeline_id": job.get("pipeline_id"),
                "checkpoint_id": job.get("checkpoint_id"),
                "agent_session_jwt": job.get("agent_session_jwt"),
                "template_id": job.get("template_id"),
                "request_id": job.get("request_id"),
                "initial_state": job.get("initial_state"),
                "initial_state_override": job.get("initial_state_override"),
                "resume_update": job.get("resume_update"),
            },
            # Route to the dedicated pipeline queue for priority control.
            queue="pipeline",
            # Task ID = run_id for idempotency and Flower lookup.
            task_id=job.get("run_id") or job.get("workflow_id") or None,
        )
        logger.info("[celery] enqueued run_id=%s", job.get("run_id"))
        return True
    except Exception as e:
        logger.warning("[celery] enqueue failed: %s", e)
        return False


def enqueue(job: dict) -> bool:
    """Enqueue pipeline job. Returns True if queued via Celery or Redis."""
    if CELERY_ENABLED:
        return _enqueue_celery(job)

    if not QUEUE_ENABLED:
        return False

    r = _get_redis()
    if not r:
        return False
    try:
        payload = {**job, "_retries": job.get("_retries", 0)}
        r.rpush(QUEUE_KEY, json.dumps(payload))
        return True
    except Exception as e:
        logger.warning("[queue] enqueue failed: %s", e)
        return False


def dequeue(timeout: int = 5) -> dict | None:
    """Blocking dequeue for the Redis path. Not used when Celery is enabled."""
    if CELERY_ENABLED:
        logger.warning(
            "[queue] dequeue() called but CELERY_ENABLED=1 — use Celery workers instead."
        )
        return None

    r = _get_redis()
    if not r:
        return None
    try:
        result = r.blpop(QUEUE_KEY, timeout=timeout)
        if result:
            _, raw = result
            return json.loads(raw)
    except Exception as e:
        logger.warning("[queue] dequeue failed: %s", e)
    return None


def send_to_dead(job: dict, error: str) -> None:
    """Move failed job to dead-letter queue for inspection (Redis path only)."""
    if CELERY_ENABLED:
        # Celery handles dead-letter via its own failure callbacks in tasks.py.
        return

    r = _get_redis()
    if not r:
        return
    try:
        payload = {**job, "_dead_reason": error}
        r.rpush(DEAD_QUEUE_KEY, json.dumps(payload))
        logger.warning(
            "[queue] job run_id=%s sent to dead queue: %s", job.get("run_id"), error
        )
    except Exception as e:
        logger.warning("[queue] send_to_dead failed: %s", e)
