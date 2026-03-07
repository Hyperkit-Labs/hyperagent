"""
HyperAgent ROMA Service
Adapter around ROMA's /api/v1/executions for deep spec generation.
When ROMA_API_URL is set, calls ROMA; otherwise uses agent-runtime local fallback
"""

import logging
import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, ValidationError

ROMA_API_URL = os.environ.get("ROMA_API_URL", "").strip()
ROMA_PROFILE = os.environ.get("ROMA_PROFILE", "general").strip() or "general"
ROMA_SPEC_TIMEOUT = int(os.environ.get("ROMA_SPEC_TIMEOUT", "120"))
ROMA_MAX_DEPTH = int(os.environ.get("ROMA_MAX_DEPTH", "1"))
AGENT_RUNTIME_URL = (os.environ.get("AGENT_RUNTIME_URL") or "http://localhost:4001").rstrip("/")

logger = logging.getLogger(__name__)
app = FastAPI(title="HyperAgent ROMA Service", version="0.1.0")


class SpecRequest(BaseModel):
    prompt: str = Field(..., description="Natural language specification prompt")
    context: dict[str, Any] | None = Field(None, description="Agent context (apiKeys, userId, etc.) for local fallback")
    agent_session_jwt: str | None = Field(None, description="JWT for agent-runtime auth when using local fallback")


class SpecModel(BaseModel):
    """Structured specification (Spec Lock format)."""

    version: str
    chains: list[str] = Field(default_factory=list)
    token_type: str
    features: list[str] = Field(default_factory=list)
    invariants: list[dict] = Field(default_factory=list)
    risk_profile: str = "medium"
    template_id: str | None = None


class SpecResponse(BaseModel):
    spec: SpecModel
    reasoning: str | None = None


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
    if isinstance(out, dict) and all(
        k in out for k in ("version", "token_type")
    ):
        return out
    return {}


async def _agent_runtime_spec(prompt: str, context: dict | None, agent_session_jwt: str | None) -> dict[str, Any]:
    """Local fallback: call agent-runtime /agents/spec and normalize to Spec Lock format."""
    headers: dict[str, str] = {}
    if agent_session_jwt:
        headers["X-Agent-Session"] = agent_session_jwt
    payload: dict[str, Any] = {"prompt": prompt}
    if context:
        payload["context"] = context
    async with httpx.AsyncClient(timeout=float(ROMA_SPEC_TIMEOUT)) as client:
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


@app.post("/spec", response_model=SpecResponse)
async def invoke_roma_spec(req: SpecRequest) -> SpecResponse:
    """
    Call ROMA /api/v1/executions when ROMA_API_URL is set; return structured Spec Lock.
    When ROMA_API_URL is not set, use agent-runtime local fallback (always succeeds).
    """
    logger.info("ROMA spec request: prompt_len=%d", len(req.prompt or ""))

    if not ROMA_API_URL:
        try:
            spec_data = await _agent_runtime_spec(req.prompt, req.context, req.agent_session_jwt)
            spec_data = spec_data or {
                "version": "1.0",
                "chains": ["mantle"],
                "token_type": "ERC20",
                "features": [],
                "invariants": [],
                "risk_profile": "medium",
                "template_id": None,
            }
            spec = SpecModel(**spec_data)
            return SpecResponse(spec=spec, reasoning="(local fallback via agent-runtime)")
        except Exception as e:
            logger.warning("ROMA local fallback failed: %s", e)
            raise HTTPException(status_code=503, detail=f"Local spec fallback failed: {e}") from e

    payload = {
        "goal": _build_roma_goal(req.prompt),
        "config_profile": ROMA_PROFILE,
        "max_depth": min(max(ROMA_MAX_DEPTH, 1), 2),
    }

    try:
        async with httpx.AsyncClient(timeout=float(ROMA_SPEC_TIMEOUT)) as client:
            r = await client.post(
                f"{ROMA_API_URL.rstrip('/')}/api/v1/executions",
                json=payload,
            )
            r.raise_for_status()
            roma_result = r.json()
    except httpx.TimeoutException as e:
        logger.warning("ROMA spec timeout: %s", e)
        raise HTTPException(
            status_code=503,
            detail="ROMA execution timed out; orchestrator will use local spec agent.",
        ) from e
    except httpx.HTTPStatusError as e:
        logger.warning("ROMA spec HTTP error: %s %s", e.response.status_code, e.response.text[:200])
        raise HTTPException(
            status_code=503,
            detail="ROMA execution failed; orchestrator will use local spec agent.",
        ) from e
    except Exception as e:
        logger.warning("ROMA spec call failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="ROMA execution failed; orchestrator will use local spec agent.",
        ) from e

    execution_id = roma_result.get("execution_id") or roma_result.get("id")
    if execution_id:
        logger.info("ROMA execution_id=%s", execution_id)

    spec_data = _extract_spec_from_roma_result(roma_result)
    if not spec_data:
        logger.warning("ROMA response missing spec; returning 503 for fallback")
        raise HTTPException(
            status_code=503,
            detail="ROMA did not return a valid spec; orchestrator will use local spec agent.",
        )

    try:
        spec = SpecModel(
            version=str(spec_data.get("version", "1.0")),
            chains=list(spec_data.get("chains") or []),
            token_type=str(spec_data.get("token_type", "ERC20")),
            features=list(spec_data.get("features") or []),
            invariants=list(spec_data.get("invariants") or []),
            risk_profile=str(spec_data.get("risk_profile", "medium")),
            template_id=spec_data.get("template_id"),
        )
    except (ValidationError, TypeError) as e:
        logger.warning("ROMA spec validation failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="ROMA spec invalid; orchestrator will use local spec agent.",
        ) from e

    reasoning = roma_result.get("reasoning") or roma_result.get("output_reasoning")
    if isinstance(reasoning, dict):
        reasoning = reasoning.get("text") or str(reasoning)[:500]
    return SpecResponse(spec=spec, reasoning=reasoning)


@app.get("/health")
def health():
    return {"status": "ok"}
