"""Design agent: call agent-runtime /agents/design. BYOK via X-Agent-Session when JWT present."""

import os

import httpx
from agents.agent_http import agent_runtime_headers
from registries import get_timeout

AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001")


async def generate_design(
    spec: dict,
    target_chains: list,
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
    body: dict = {
        "spec": spec,
        "targetChains": target_chains or spec.get("chains", []),
        "context": context,
    }
    if security_context:
        body["securityContext"] = security_context
    async with httpx.AsyncClient(timeout=get_timeout("design")) as client:
        r = await client.post(
            f"{AGENT_RUNTIME_URL.rstrip('/')}/agents/design",
            json=body,
            headers=headers,
        )
        r.raise_for_status()
        return r.json()
