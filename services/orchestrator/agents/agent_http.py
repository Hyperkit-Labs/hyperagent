"""Shared headers for agent-runtime HTTP calls. Ensures X-Internal-Token for service-to-service auth."""

from __future__ import annotations

import os


def agent_runtime_headers(agent_session_jwt: str | None = None) -> dict[str, str]:
    """Build headers for agent-runtime requests. Adds X-Internal-Token when INTERNAL_SERVICE_TOKEN is set."""
    headers: dict[str, str] = {}
    token = os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    if token:
        headers["X-Internal-Token"] = token
    if agent_session_jwt:
        headers["X-Agent-Session"] = agent_session_jwt
    return headers
