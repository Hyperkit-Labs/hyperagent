#!/usr/bin/env python3
"""
Pipeline worker entry point.

Modes:
  Celery (recommended): set CELERY_ENABLED=1 then run with:
      celery -A celery_app worker -Q pipeline --loglevel=info --concurrency=2

  Redis loop (legacy): set QUEUE_ENABLED=1 (no CELERY_ENABLED). Worker polls
      Redis directly with BLPOP. Kept for minimal-dependency deployments.

When run directly (python worker.py), this file starts the Redis-loop worker.
For Celery, use the celery CLI directly — this file is only the Redis fallback.
"""

from __future__ import annotations

import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _run_redis_loop() -> None:
    from queue_client import QUEUE_MAX_RETRIES, dequeue, enqueue, send_to_dead
    from workflow import run_pipeline

    logger.info(
        "[worker] starting Redis-loop worker (max_retries=%d)", QUEUE_MAX_RETRIES
    )
    while True:
        job = dequeue(timeout=30)
        if not job:
            continue
        run_id = job.get("run_id") or job.get("workflow_id", "")
        retries = job.get("_retries", 0)
        logger.info("[worker] processing job run_id=%s retries=%d", run_id, retries)
        try:
            run_pipeline(
                user_prompt=job.get("nlp_input") or job.get("user_prompt", ""),
                user_id=job.get("user_id", ""),
                project_id=job.get("project_id", ""),
                run_id=run_id,
                api_keys=job.get("api_keys", {}),
                pipeline_id=job.get("pipeline_id"),
                checkpoint_id=job.get("checkpoint_id"),
                agent_session_jwt=job.get("agent_session_jwt"),
                template_id=job.get("template_id"),
                request_id=job.get("request_id"),
                initial_state=job.get("initial_state"),
                initial_state_override=job.get("initial_state_override"),
                resume_update=job.get("resume_update"),
            )
            logger.info("[worker] job run_id=%s completed", run_id)
        except Exception as e:
            logger.exception("[worker] job run_id=%s failed: %s", run_id, e)
            if retries < QUEUE_MAX_RETRIES:
                job["_retries"] = retries + 1
                if enqueue(job):
                    logger.info(
                        "[worker] job run_id=%s re-queued (retry %d/%d)",
                        run_id,
                        retries + 1,
                        QUEUE_MAX_RETRIES,
                    )
                else:
                    logger.error("[worker] re-queue failed for run_id=%s", run_id)
            else:
                send_to_dead(job, str(e))


def main() -> None:
    celery_enabled = os.environ.get("CELERY_ENABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if celery_enabled:
        logger.warning(
            "[worker] CELERY_ENABLED=1 detected. "
            "Run 'celery -A celery_app worker -Q pipeline --loglevel=info' instead of this script."
        )
        sys.exit(0)

    _run_redis_loop()


if __name__ == "__main__":
    main()
