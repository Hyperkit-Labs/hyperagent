"""
Celery application configuration for HyperAgent pipeline workers.

Broker: Redis via REDIS_URL (same Upstash TCP connection used by the checkpointer).
Result backend: Redis (optional; pipeline results are persisted to Supabase by workflow.py).

Enabled when QUEUE_ENABLED=1. Run the worker with:
    celery -A celery_app worker --loglevel=info --concurrency=2

Monitor with Flower:
    celery -A celery_app flower --port=5555
"""

from __future__ import annotations

import os

from celery import Celery
from redis_util import effective_redis_url

_raw_url = (
    os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or ""
).strip()

# Upstash TCP URLs may use rediss:// (TLS) — Celery handles both redis:// and rediss://.
BROKER_URL = effective_redis_url(_raw_url) if _raw_url else "redis://localhost:6379/0"
RESULT_BACKEND = BROKER_URL

app = Celery(
    "hyperagent",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
)

app.conf.update(
    # Task routing — keep pipeline runs in a dedicated queue for priority control.
    task_routes={
        "tasks.run_pipeline_task": {"queue": "pipeline"},
    },
    # Retry policy: Celery handles exponential backoff natively.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Serialisation
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Visibility timeout should exceed the longest pipeline run (10 min).
    broker_transport_options={"visibility_timeout": 900},
    # Result expiry: keep results 24 h for debugging via Flower.
    result_expires=86_400,
    # Worker concurrency — overridden by --concurrency on CLI.
    worker_prefetch_multiplier=1,
)
