"""
Shared request/response contracts for orchestrator and services.
Use these types in provider interfaces and HTTP clients for explicit, consistent contracts.
"""

from __future__ import annotations

from typing import Any, TypedDict

# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------


class SimulateRequest(TypedDict, total=False):
    """Request shape for simulation (network, from, to?, data, value?)."""

    network: str
    from_address: str  # sent as "from" in JSON
    to_address: str | None
    data: str
    value: str


class SimulateTxResult(TypedDict, total=False):
    """Response from simulation: success, gasUsed, traces, simulationUrl, error."""

    success: bool
    gasUsed: int
    traces: Any
    simulationUrl: str | None
    error: str


# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------


class DeployPlanRequest(TypedDict, total=False):
    """Request for deploy plan: chainId, bytecode, abi, constructorArgs?."""

    chainId: int
    bytecode: str
    abi: list
    constructorArgs: list


class DeployPlanResult(TypedDict, total=False):
    """Deploy plan returned to client: rpcUrl, explorerUrl, bytecode, abi, etc."""

    deployFromConnectedAccount: bool
    chainId: int
    rpcUrl: str
    explorerUrl: str
    bytecode: str
    abi: list
    constructorArgs: list
    contractName: str | None
    network_name: str  # optional, used by deploy_agent


# ---------------------------------------------------------------------------
# Storage (for consistency; orchestrator may call storage later)
# ---------------------------------------------------------------------------


class PinRequest(TypedDict):
    """Request to pin content: content, name."""

    content: str
    name: str


class PinResult(TypedDict):
    """Result from pin: cid, gatewayUrl."""

    cid: str
    gatewayUrl: str
