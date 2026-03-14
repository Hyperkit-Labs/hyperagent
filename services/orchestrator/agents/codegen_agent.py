"""Codegen agent: call agent-runtime /agents/codegen. BYOK via X-Agent-Session when JWT present."""

import logging
import os

import httpx
from circuit_breaker import CircuitOpenError, get_breaker
from registries import get_timeout

from agents.agent_http import agent_runtime_headers

logger = logging.getLogger(__name__)
AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001")


async def generate_contracts(
    spec: dict,
    design: dict,
    framework: str,
    user_id: str,
    project_id: str,
    run_id: str,
    api_keys: dict,
    agent_session_jwt: str | None = None,
    security_context: dict | None = None,
) -> dict:
    context: dict = {
        "userId": user_id,
        "projectId": project_id,
        "runId": run_id,
        "apiKeys": api_keys or {},
    }
    headers = agent_runtime_headers(agent_session_jwt)
    body: dict = {"spec": spec, "design": design, "context": context}
    if security_context:
        body["securityContext"] = security_context

    async def _do() -> dict:
        async with httpx.AsyncClient(timeout=get_timeout("codegen")) as client:
            r = await client.post(
                f"{AGENT_RUNTIME_URL.rstrip('/')}/agents/codegen",
                json=body,
                headers=headers,
            )
            r.raise_for_status()
            return r.json()

    try:
        return await get_breaker("codegen").call(_do)
    except CircuitOpenError:
        logger.warning("[codegen] circuit open, failing fast")
        raise RuntimeError("Codegen service unavailable. Circuit breaker open.") from None
