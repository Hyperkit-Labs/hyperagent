"""Orchestrator-local Spec Lock contract mirror.

This file intentionally mirrors services/roma-service/spec_contract.py so the
orchestrator image can import the Spec contract without depending on files from
another service image. Keep parity via contract tests.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Mapping

from pydantic import BaseModel, ConfigDict, Field

SPEC_LOCK_EXAMPLE: dict[str, Any] = {
    "version": "1.0",
    "chains": [{"chain_id": 84532, "network_name": "base-sepolia"}],
    "token_type": "ERC20",
    "features": ["mintable", "burnable"],
    "invariants": [
        {
            "name": "supply_cap",
            "description": "Total minted supply must not exceed configured cap.",
        }
    ],
    "risk_profile": "medium",
    "template_id": "erc20-standard",
    "app_type": "token",
    "multi_contract": False,
    "roles": ["owner", "minter"],
    "oracles": [],
    "frontend_actions": ["mint", "transfer"],
    "wizard_options": {
        "name": "HyperToken",
        "symbol": "HYP",
        "premint": "1000000",
        "mintable": True,
    },
}


class SpecRiskProfile(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SpecChainTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chain_id: int | None = None
    network_name: str | None = None


class SpecRequest(BaseModel):
    prompt: str = Field(..., description="Natural language specification prompt")
    context: dict[str, Any] | None = Field(
        None, description="Agent context (apiKeys, userId, etc.) for local fallback"
    )
    agent_session_jwt: str | None = Field(
        None, description="JWT for agent-runtime auth when using local fallback"
    )


class SpecModel(BaseModel):
    """Structured specification contract ("Spec Lock")."""

    model_config = ConfigDict(
        title="SpecLock",
        extra="forbid",
        json_schema_extra={"examples": [SPEC_LOCK_EXAMPLE]},
    )

    version: str = Field(..., min_length=1)
    chains: list[str | SpecChainTarget] = Field(default_factory=list)
    token_type: str = Field(..., min_length=1)
    features: list[str] = Field(default_factory=list)
    invariants: list[dict[str, Any]] = Field(default_factory=list)
    risk_profile: SpecRiskProfile = Field(default=SpecRiskProfile.medium)
    template_id: str | None = None
    app_type: str | None = None
    multi_contract: bool | None = None
    roles: list[str] = Field(default_factory=list)
    oracles: list[dict[str, Any]] = Field(default_factory=list)
    frontend_actions: list[str] = Field(default_factory=list)
    wizard_options: dict[str, Any] | None = None


class SpecResponse(BaseModel):
    spec: SpecModel
    reasoning: str | None = None


def normalize_spec_payload(
    raw: Mapping[str, Any] | None,
    *,
    default_chain: str | None = None,
    default_risk: SpecRiskProfile = SpecRiskProfile.medium,
) -> dict[str, Any]:
    """Normalize mixed LLM / fallback output into the canonical SpecModel shape."""
    data = dict(raw or {})
    chains = data.get("chains") or []
    normalized_chains: list[str | dict[str, Any]] = []
    for chain in chains:
        if isinstance(chain, dict):
            cid = chain.get("chain_id") or chain.get("id")
            network_name = chain.get("network_name") or chain.get("name")
            normalized_chains.append(
                {
                    "chain_id": int(cid) if cid is not None else None,
                    "network_name": str(network_name) if network_name else None,
                }
            )
        elif isinstance(chain, str):
            normalized_chains.append(chain)
        elif isinstance(chain, int):
            normalized_chains.append({"chain_id": chain, "network_name": None})

    if not normalized_chains and default_chain:
        normalized_chains = [default_chain]

    spec = SpecModel(
        version=str(data.get("version", "1.0")),
        chains=normalized_chains,
        token_type=str(data.get("token_type", "ERC20")),
        features=[str(item) for item in list(data.get("features") or [])],
        invariants=list(data.get("invariants") or []),
        risk_profile=str(data.get("risk_profile", default_risk.value)),
        template_id=data.get("template_id"),
        app_type=data.get("app_type"),
        multi_contract=data.get("multi_contract"),
        roles=[str(item) for item in list(data.get("roles") or [])],
        oracles=list(data.get("oracles") or []),
        frontend_actions=[
            str(item) for item in list(data.get("frontend_actions") or [])
        ],
        wizard_options=(
            dict(data.get("wizard_options"))
            if isinstance(data.get("wizard_options"), dict)
            else None
        ),
    )
    return spec.model_dump(mode="json", exclude_none=True)


def spec_lock_json_schema() -> dict[str, Any]:
    """Return the canonical JSON Schema for the Spec Lock contract."""
    return SpecModel.model_json_schema()
