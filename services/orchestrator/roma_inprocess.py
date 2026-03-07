"""
ROMA spec logic in-process (collapsed from roma-service).
When ROMA_API_URL is set, calls external ROMA; otherwise uses agent-runtime local fallback.
ROMA is non-negotiable: always returns a spec.
"""

import logging
import os
from typing import Any

import httpx

from registries import get_timeout

logger = logging.getLogger(__name__)

ROMA_API_URL = (os.environ.get("ROMA_API_URL") or "").strip()
ROMA_PROFILE = (os.environ.get("ROMA_PROFILE") or "general").strip() or "general"
ROMA_SPEC_TIMEOUT = int(os.environ.get("ROMA_SPEC_TIMEOUT", "120"))
ROMA_MAX_DEPTH = int(os.environ.get("ROMA_MAX_DEPTH", "1"))
AGENT_RUNTIME_URL = (os.environ.get("AGENT_RUNTIME_URL") or "http://localhost:4001").rstrip("/")


def _build_roma_goal(prompt: str) -> str:
    return (
        "Turn this HyperAgent spec prompt into a structured Spec Lock JSON. "
        "Output only valid JSON matching: version (string), chains (list of chain names), "
        "token_type (e.g. ERC20, ERC721), features (list), invariants (list of objects), "
        "risk_profile (low|medium|high), template_id (optional string). "
        "Prompt:\n\n" + (prompt or "")
    )


def _extract_spec_from_roma_result(roma_result: dict[str, Any]) -> dict[str, Any]:
    """Parse ROMA response; support output.spec, spec, or output as the spec object."""
    out = roma_result.get("output") or roma_result
    if isinstance(out, dict) and "spec" in out:
        return out["spec"]
    if isinstance(roma_result.get("spec"), dict):
        return roma_result["spec"]
    if isinstance(out, dict) and all(k in out for k in ("version", "token_type")):
        return out
    return {}


async def _agent_runtime_spec(
    prompt: str,
    context: dict[str, Any] | None,
    agent_session_jwt: str | None,
) -> dict[str, Any]:
    """Local fallback: call agent-runtime /agents/spec and normalize to Spec Lock format."""
    headers: dict[str, str] = {}
    if agent_session_jwt:
        headers["X-Agent-Session"] = agent_session_jwt
    payload: dict[str, Any] = {"prompt": prompt}
    if context:
        payload["context"] = context
    async with httpx.AsyncClient(timeout=get_timeout("roma")) as client:
        r = await client.post(
            f"{AGENT_RUNTIME_URL}/agents/spec",
            json=payload,
            headers=headers,
        )
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict):
        return {}
    chains = data.get("chains") or []
    if chains and isinstance(chains[0], dict):
        chains = [c.get("network_name") or str(c.get("chain_id", "")) for c in chains if c]
    return {
        "version": str(data.get("version", "1.0")),
        "chains": chains,
        "token_type": str(data.get("token_type", "ERC20")),
        "features": list(data.get("features") or []),
        "invariants": list(data.get("invariants") or []),
        "risk_profile": str(data.get("risk_profile", "medium")),
        "template_id": data.get("template_id"),
    }


async def invoke_roma_spec(
    prompt: str,
    context: dict[str, Any] | None = None,
    agent_session_jwt: str | None = None,
) -> dict:
    """
    ROMA spec generation (in-process). External ROMA when ROMA_API_URL set; else agent-runtime fallback.
    Always returns a valid spec dict; never empty.
    """
    if ROMA_API_URL:
        try:
            payload = {
                "goal": _build_roma_goal(prompt),
                "config_profile": ROMA_PROFILE,
                "max_depth": min(max(ROMA_MAX_DEPTH, 1), 2),
            }
            async with httpx.AsyncClient(timeout=float(ROMA_SPEC_TIMEOUT)) as client:
                r = await client.post(
                    f"{ROMA_API_URL.rstrip('/')}/api/v1/executions",
                    json=payload,
                )
                r.raise_for_status()
                roma_result = r.json()
            spec_data = _extract_spec_from_roma_result(roma_result)
            if spec_data:
                return spec_data
        except Exception as e:
            logger.warning("ROMA external call failed, fallback to agent-runtime: %s", e)

    try:
        spec_data = await _agent_runtime_spec(prompt, context, agent_session_jwt)
        if spec_data:
            return spec_data
    except Exception as e:
        logger.warning("ROMA agent-runtime fallback failed: %s", e)

    return {
        "version": "1.0",
        "chains": ["mantle"],
        "token_type": "ERC20",
        "features": [],
        "invariants": [],
        "risk_profile": "medium",
        "template_id": None,
    }
