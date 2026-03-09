"""Call ROMA service for deep reasoning spec. ROMA is non-negotiable: always calls roma-service which uses external ROMA or local fallback."""

import logging
import os
from typing import Any

import httpx
from registries import get_timeout

logger = logging.getLogger(__name__)


def _roma_base_url() -> str | None:
    url = (
        os.environ.get("ROMA_URL") or os.environ.get("ROMA_SERVICE_URL") or ""
    ).strip()
    return url.rstrip("/") if url else None


async def invoke_roma_spec(
    prompt: str,
    context: dict[str, Any] | None = None,
    agent_session_jwt: str | None = None,
) -> dict:
    base = _roma_base_url()
    if not base:
        return {}
    payload: dict[str, Any] = {"prompt": prompt}
    if context is not None:
        payload["context"] = context
    if agent_session_jwt:
        payload["agent_session_jwt"] = agent_session_jwt
    try:
        async with httpx.AsyncClient(timeout=get_timeout("roma")) as client:
            r = await client.post(f"{base}/spec", json=payload)
            r.raise_for_status()
            data = r.json()
            spec = data.get("spec", {})
            return spec if isinstance(spec, dict) else {}
    except Exception as e:
        logger.warning("ROMA spec call failed, fallback to local spec agent: %s", e)
        return {}
