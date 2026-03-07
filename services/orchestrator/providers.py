"""
Toolkit interfaces (capability abstraction) for simulation, deploy, and storage.
Implementations are thin HTTP clients calling existing services; actual Tenderly/Pinata
logic stays inside the respective services. Propagate x-request-id for trace correlation.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Protocol

import httpx

from registries import get_timeout
from trace_context import get_request_id


def _trace_headers() -> dict[str, str]:
    """Headers to propagate for request correlation (log filtering by run/request)."""
    headers: dict[str, str] = {}
    rid = get_request_id()
    if rid:
        headers["x-request-id"] = rid
    token = os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    if token:
        headers["X-Internal-Token"] = token
    return headers

# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

class SimulationProvider(Protocol):
    """Protocol: simulate(network, from_addr, data, to_addr?, value?) -> SimulateTxResult."""

    async def simulate(
        self,
        network: str,
        from_address: str,
        data: str,
        to_address: str | None = None,
        value: str = "0",
    ) -> dict[str, Any]:
        """Run simulation; returns SimulateTxResult-shaped dict."""
        ...


class SimulationHttpProvider:
    """HTTP client calling the simulation service (same URL as before)."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002")).rstrip("/")

    async def simulate(
        self,
        network: str,
        from_address: str,
        data: str,
        to_address: str | None = None,
        value: str = "0",
    ) -> dict[str, Any]:
        headers = _trace_headers()
        async with httpx.AsyncClient(timeout=get_timeout("simulation")) as client:
            r = await client.post(
                f"{self.base_url}/simulate",
                headers=headers,
                json={
                    "network": network,
                    "from": from_address,
                    "to": to_address or "",
                    "data": data,
                    "value": value,
                },
            )
            if r.status_code == 503:
                return {"success": False, "error": "Tenderly not configured", "gasUsed": 0}
            r.raise_for_status()
            return r.json()


# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

class DeployProvider(Protocol):
    """Protocol: get_deploy_plan(chain_id, bytecode, abi, constructor_args?) -> DeployPlanResult."""

    async def get_deploy_plan(
        self,
        chain_id: int,
        bytecode: str,
        abi: list,
        constructor_args: list | None = None,
    ) -> dict[str, Any]:
        """Return deploy plan (rpcUrl, explorerUrl, bytecode, abi, etc.)."""
        ...


class DeployHttpProvider:
    """HTTP client calling the deploy service."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or os.environ.get("DEPLOY_SERVICE_URL", "http://localhost:8003")).rstrip("/")

    async def get_deploy_plan(
        self,
        chain_id: int,
        bytecode: str,
        abi: list,
        constructor_args: list | None = None,
    ) -> dict[str, Any]:
        logger = logging.getLogger(__name__)
        headers = _trace_headers()
        async with httpx.AsyncClient(timeout=get_timeout("deploy_client")) as client:
            r = await client.post(
                f"{self.base_url}/deploy",
                headers=headers,
                json={
                    "chainId": chain_id,
                    "bytecode": bytecode,
                    "abi": abi,
                    "constructorArgs": constructor_args or [],
                },
            )
            if r.status_code >= 400:
                try:
                    body = r.json()
                    err = body.get("error", body)
                except Exception:
                    err = r.text[:500] if r.text else r.reason_phrase
                logger.warning("[deploy] %s %s: %s", r.status_code, self.base_url, err)
            r.raise_for_status()
            return r.json()


# ---------------------------------------------------------------------------
# Storage (orchestrator may call later; agent-runtime calls today)
# ---------------------------------------------------------------------------

class StorageProvider(Protocol):
    """Protocol: pin(content, name) -> PinResult, unpin(cid) -> None."""

    async def pin(self, content: str, name: str) -> dict[str, Any]:
        """Pin content; returns PinResult-shaped dict (cid, gatewayUrl)."""
        ...

    async def unpin(self, cid: str) -> None:
        """Unpin by CID."""
        ...


class StorageHttpProvider:
    """HTTP client calling the storage service."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or os.environ.get("STORAGE_SERVICE_URL", "http://localhost:4005")).rstrip("/")

    async def pin(self, content: str, name: str) -> dict[str, Any]:
        headers = _trace_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{self.base_url}/ipfs/pin",
                headers=headers,
                json={"content": content, "name": name},
            )
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                raise RuntimeError(data.get("error", "Pin failed"))
            return {"cid": data["cid"], "gatewayUrl": data["gatewayUrl"]}

    async def unpin(self, cid: str) -> None:
        headers = _trace_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{self.base_url}/ipfs/unpin",
                headers=headers,
                json={"cid": cid},
            )
            r.raise_for_status()


# ---------------------------------------------------------------------------
# Default instances (inject or override in tests)
# ---------------------------------------------------------------------------

_default_simulation: SimulationProvider | None = None
_default_deploy: DeployProvider | None = None
_default_storage: StorageProvider | None = None


def get_simulation_provider() -> SimulationProvider:
    global _default_simulation
    if _default_simulation is None:
        _default_simulation = SimulationHttpProvider()
    return _default_simulation


def get_deploy_provider() -> DeployProvider:
    global _default_deploy
    if _default_deploy is None:
        _default_deploy = DeployHttpProvider()
    return _default_deploy


def get_storage_provider() -> StorageProvider:
    global _default_storage
    if _default_storage is None:
        _default_storage = StorageHttpProvider()
    return _default_storage


def set_simulation_provider(provider: SimulationProvider | None) -> None:
    global _default_simulation
    _default_simulation = provider


def set_deploy_provider(provider: DeployProvider | None) -> None:
    global _default_deploy
    _default_deploy = provider


def set_storage_provider(provider: StorageProvider | None) -> None:
    global _default_storage
    _default_storage = provider
