"""
Redis job queue for pipeline. Enqueue workflow runs; worker consumes and executes.
Keys: queue:hyperagent:pipeline, queue:hyperagent:dead. Set REDIS_URL and QUEUE_ENABLED=1 to enable.
Supports retry count and dead-letter on repeated failure.
"""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

QUEUE_KEY = "queue:hyperagent:pipeline"
DEAD_QUEUE_KEY = "queue:hyperagent:dead"
QUEUE_ENABLED = (os.environ.get("QUEUE_ENABLED") or "").strip().lower() in ("1", "true", "yes")
QUEUE_MAX_RETRIES = int(os.environ.get("QUEUE_MAX_RETRIES", "3"))


def _get_redis():
    url = (os.environ.get("REDIS_URL") or "").strip()
    if not url:
        return None
    try:
        import redis
        return redis.from_url(url, decode_responses=True)
    except Exception as e:
        logger.warning("[queue] Redis unavailable: %s", e)
        return None


def enqueue(job: dict) -> bool:
    """Enqueue pipeline job. Returns True if queued."""
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
    """Blocking dequeue. Returns job dict or None."""
    r = _get_redis()
    if not r:
        return None
    try:
        _, raw = r.blpop(QUEUE_KEY, timeout=timeout)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.warning("[queue] dequeue failed: %s", e)
    return None


def send_to_dead(job: dict, error: str) -> None:
    """Move failed job to dead-letter queue for inspection."""
    r = _get_redis()
    if not r:
        return
    try:
        payload = {**job, "_dead_reason": error}
        r.rpush(DEAD_QUEUE_KEY, json.dumps(payload))
        logger.warning("[queue] job run_id=%s sent to dead queue: %s", job.get("run_id"), error)
    except Exception as e:
        logger.warning("[queue] send_to_dead failed: %s", e)
