"""
ROMA spec logic in-process (collapsed from roma-service).
When ROMA_URL is set, calls ROMA service; otherwise uses agent-runtime local fallback.
ROMA is non-negotiable: always returns a spec.
"""

import logging
import os
import sys
from pathlib import Path
from typing import Any

import httpx
from registries import get_timeout

logger = logging.getLogger(__name__)

ROMA_URL = (
    os.environ.get("ROMA_URL")
    or os.environ.get("ROMA_SERVICE_URL")
    or os.environ.get("ROMA_API_URL")
    or ""
).strip()
ROMA_PROFILE = (os.environ.get("ROMA_PROFILE") or "general").strip() or "general"
ROMA_SPEC_TIMEOUT = int(os.environ.get("ROMA_SPEC_TIMEOUT", "120"))
ROMA_MAX_DEPTH = int(os.environ.get("ROMA_MAX_DEPTH", "1"))
AGENT_RUNTIME_URL = (
    os.environ.get("AGENT_RUNTIME_URL") or "http://localhost:4001"
).rstrip("/")

_ROMA_SERVICE_ROOT = Path(__file__).resolve().parent.parent / "roma-service"
if str(_ROMA_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROMA_SERVICE_ROOT))

from spec_contract import normalize_spec_payload


def _build_roma_goal(prompt: str) -> str:
    return (
        "Turn this HyperAgent spec prompt into a structured Spec Lock JSON. "
        "Output only valid JSON matching: version (string), chains (list of chain names), "
        "token_type (e.g. ERC20, ERC721), features (list), invariants (list of objects), "
        "risk_profile (low|medium|high|critical), template_id (optional string), "
        "wizard_options (optional object), app_type (optional string), multi_contract (optional boolean), "
        "roles (optional list), oracles (optional list), frontend_actions (optional list). "
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
    from agents.agent_http import agent_runtime_headers

    headers = agent_runtime_headers(agent_session_jwt)
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
        chains = [
            c.get("network_name") or str(c.get("chain_id", "")) for c in chains if c
        ]
    out: dict[str, Any] = normalize_spec_payload(
        {
            "version": data.get("version", "1.0"),
            "chains": chains,
            "token_type": data.get("token_type", "ERC20"),
            "features": list(data.get("features") or []),
            "invariants": list(data.get("invariants") or []),
            "risk_profile": data.get("risk_profile", "medium"),
            "template_id": data.get("template_id"),
            "app_type": data.get("app_type"),
            "multi_contract": data.get("multi_contract"),
            "roles": list(data.get("roles") or []),
            "oracles": list(data.get("oracles") or []),
            "frontend_actions": list(data.get("frontend_actions") or []),
            "wizard_options": data.get("wizard_options"),
        }
    )
    return out


async def invoke_roma_spec(
    prompt: str,
    context: dict[str, Any] | None = None,
    agent_session_jwt: str | None = None,
) -> dict:
    """
    ROMA spec generation. Uses ROMA_URL when set; else agent-runtime fallback.
    Always returns a valid spec dict; never empty.
    """
    if ROMA_URL:
        try:
            from circuit_breaker import CircuitOpenError, get_breaker

            async def _call_roma() -> dict[str, Any] | None:
                async with httpx.AsyncClient(
                    timeout=float(ROMA_SPEC_TIMEOUT)
                ) as client:
                    r = await client.post(
                        f"{ROMA_URL.rstrip('/')}/spec",
                        json={
                            "prompt": prompt,
                            "context": context,
                            "agent_session_jwt": agent_session_jwt,
                        },
                    )
                    r.raise_for_status()
                    data = r.json()
                    spec = data.get("spec") or {}
                    if not spec:
                        return None
                    return normalize_spec_payload(
                        {
                            "version": spec.get("version", "1.0"),
                            "chains": list(spec.get("chains") or []),
                            "token_type": spec.get("token_type", "ERC20"),
                            "features": list(spec.get("features") or []),
                            "invariants": list(spec.get("invariants") or []),
                            "risk_profile": spec.get("risk_profile", "high"),
                            "template_id": spec.get("template_id"),
                            "app_type": spec.get("app_type"),
                            "multi_contract": spec.get("multi_contract"),
                            "roles": list(spec.get("roles") or []),
                            "oracles": list(spec.get("oracles") or []),
                            "frontend_actions": list(spec.get("frontend_actions") or []),
                            "wizard_options": spec.get("wizard_options"),
                        }
                    )

            breaker = get_breaker("roma")
            out = await breaker.call(_call_roma)
            if out:
                return out
        except CircuitOpenError:
            logger.warning("ROMA circuit open, using fallback")
        except Exception as e:
            logger.warning("ROMA service call failed, fallback: %s", e)

    try:
        spec_data = await _agent_runtime_spec(prompt, context, agent_session_jwt)
        if spec_data:
            return spec_data
    except Exception as e:
        logger.warning("ROMA agent-runtime fallback failed: %s", e)

    try:
        from registries import get_anchor_network_slug
        anchor_chain = get_anchor_network_slug()
    except Exception:
        anchor_chain = "skalebase-sepolia"

    return normalize_spec_payload(
        {
            "version": "1.0",
            "chains": [anchor_chain],
            "token_type": "ERC20",
            "features": [],
            "invariants": [],
            "risk_profile": "medium",
            "template_id": None,
        }
    )
