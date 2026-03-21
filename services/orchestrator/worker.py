#!/usr/bin/env python3
"""
Pipeline worker: consumes queue:hyperagent:pipeline, runs pipeline via workflow.run_pipeline.
Retries on failure up to QUEUE_MAX_RETRIES; sends to dead-letter queue when exhausted.
Set QUEUE_ENABLED=1 and REDIS_URL. Run as separate process/container.
"""

import asyncio
import logging
import os
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure orchestrator is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    from queue_client import QUEUE_MAX_RETRIES, dequeue, enqueue, send_to_dead
    from workflow import run_pipeline

    logger.info("[worker] starting pipeline worker (max_retries=%d)", QUEUE_MAX_RETRIES)
    while True:
        job = dequeue(timeout=30)
        if not job:
            continue
        run_id = job.get("run_id") or job.get("workflow_id", "")
        retries = job.get("_retries", 0)
        logger.info("[worker] processing job run_id=%s retries=%d", run_id, retries)
        try:
            user_prompt = job.get("nlp_input") or job.get("user_prompt", "")
            run_pipeline(
                user_prompt=user_prompt,
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
                    logger.info("[worker] job run_id=%s re-queued (retry %d/%d)", run_id, retries + 1, QUEUE_MAX_RETRIES)
            else:
                send_to_dead(job, str(e))


if __name__ == "__main__":
    main()
