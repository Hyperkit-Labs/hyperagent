"""
slowapi rate limiter for the orchestrator.

Provides a second defense layer after the API-gateway's Upstash rate limits.
The gateway enforces per-IP and per-user limits via Redis; the orchestrator
layer below catches any requests that bypass or saturate the gateway.

Limits (conservative defaults, tuneable via env):
  - POST /workflows/generate : RATE_LIMIT_ORCHESTRATOR_GENERATE (default 10/minute per user)
  - POST /deploy endpoints   : RATE_LIMIT_ORCHESTRATOR_DEPLOY   (default 5/minute per user)

Key function: X-User-Id header → per-user limits; falls back to remote IP for
unauthenticated calls (defense-in-depth against unauthenticated bursts).
"""

from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _get_user_or_ip(request: Request) -> str:
    """Rate-limit key: X-User-Id when set, else remote IP."""
    uid = (
        request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
    ).strip()
    return uid if uid else get_remote_address(request)


limiter = Limiter(key_func=_get_user_or_ip)

GENERATE_LIMIT = os.environ.get("RATE_LIMIT_ORCHESTRATOR_GENERATE", "10/minute")
DEPLOY_LIMIT = os.environ.get("RATE_LIMIT_ORCHESTRATOR_DEPLOY", "5/minute")
