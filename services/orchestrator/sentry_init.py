"""Optional Sentry initialization for the orchestrator (set SENTRY_DSN)."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get(
                "SENTRY_ENVIRONMENT",
                os.environ.get("NODE_ENV", "development"),
            ),
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        )
    except ImportError:
        logger.warning("sentry-sdk not installed; skipping Sentry (pip install sentry-sdk)")
