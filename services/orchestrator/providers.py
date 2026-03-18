"""
Toolkit interfaces (capability abstraction) for simulation, deploy, and storage.
Implementations are thin HTTP clients calling existing services; actual Tenderly/Pinata
logic stays inside the respective services. Propagate x-request-id for trace correlation.
Circuit breakers and retries applied to all external HTTP calls.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Awaitable, Callable, Protocol, TypeVar

import httpx
from circuit_breaker import CircuitOpenError, get_breaker
from registries import get_timeout
from trace_context import get_request_id

logger = logging.getLogger(__name__)

RETRY_MAX_ATTEMPTS = int(os.environ.get("ORCHESTRATOR_HTTP_RETRY_ATTEMPTS", "3"))
RETRY_BASE_DELAY_SEC = float(os.environ.get("ORCHESTRATOR_HTTP_RETRY_BASE_SEC", "1.0"))

T = TypeVar("T")


async def _retry_http(
    fn: Callable[[], Awaitable[T]],
    service_name: str,
) -> T:
    """Retry on 5xx, connection errors, timeout. Exponential backoff."""
    last_err: BaseException | None = None
    for attempt in range(RETRY_MAX_ATTEMPTS):
        try:
            return await fn()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as e:
            last_err = e
            if attempt < RETRY_MAX_ATTEMPTS - 1:
                delay = RETRY_BASE_DELAY_SEC * (2**attempt)
                logger.warning(
                    "[%s] attempt %d/%d failed: %s; retrying in %.1fs",
                    service_name,
                    attempt + 1,
                    RETRY_MAX_ATTEMPTS,
                    type(e).__name__,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                raise
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500 and attempt < RETRY_MAX_ATTEMPTS - 1:
                last_err = e
                delay = RETRY_BASE_DELAY_SEC * (2**attempt)
                logger.warning(
                    "[%s] attempt %d/%d got %d; retrying in %.1fs",
                    service_name,
                    attempt + 1,
                    RETRY_MAX_ATTEMPTS,
                    e.response.status_code,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                raise
    if last_err:
        raise last_err
    raise RuntimeError("retry exhausted")


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
    """Protocol: simulate(...) and simulate_bundle(...) -> SimulateTxResult / SimulateBundleResult."""

    async def simulate(
        self,
        network: str,
        from_address: str,
        data: str,
        to_address: str | None = None,
        value: str = "0",
        design_rationale: str = "",
    ) -> dict[str, Any]:
        """Run single simulation; returns SimulateTxResult-shaped dict."""
        ...

    async def simulate_bundle(self, simulations: list[dict[str, Any]]) -> dict[str, Any]:
        """Run bundled simulations; returns SimulateBundleResult-shaped dict."""
        ...


class SimulationHttpProvider:
    """HTTP client calling the simulation service (same URL as before)."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (
            base_url
            or os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002")
        ).rstrip("/")

    async def simulate(
        self,
        network: str,
        from_address: str,
        data: str,
        to_address: str | None = None,
        value: str = "0",
        design_rationale: str = "",
    ) -> dict[str, Any]:
        breaker = get_breaker("simulation")
        if not breaker.can_execute():
            logger.warning("[simulation] circuit open, skipping simulate")
            return {"success": False, "error": "Simulation service circuit open", "gasUsed": 0}
        headers = _trace_headers()
        payload: dict[str, Any] = {
            "network": network,
            "from": from_address,
            "to": to_address or "",
            "data": data,
            "value": value,
        }
        if design_rationale:
            payload["design_rationale"] = design_rationale

        async def _do_simulate() -> dict[str, Any]:
            async def _req() -> dict[str, Any]:
                async with httpx.AsyncClient(timeout=get_timeout("simulation")) as client:
                    r = await client.post(
                        f"{self.base_url}/simulate",
                        headers=headers,
                        json=payload,
                    )
                if r.status_code == 503:
                    return {
                        "success": False,
                        "error": "Tenderly not configured",
                        "gasUsed": 0,
                    }
                r.raise_for_status()
                return r.json()

            return await _retry_http(_req, "simulation")

        try:
            result = await breaker.call(_do_simulate)
            return result
        except CircuitOpenError:
            return {"success": False, "error": "Simulation service circuit open", "gasUsed": 0}

    async def simulate_bundle(
        self,
        simulations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Tenderly Bundled Simulations: run multiple txs consecutively in one block.
        Each item: network_id, from, to?, input, value?, gas?, state_objects?
        See https://docs.tenderly.co/simulations/bundled-simulations
        """
        breaker = get_breaker("simulation")
        if not breaker.can_execute():
            logger.warning("[simulation] circuit open, skipping simulate_bundle")
            return {"success": False, "error": "Simulation service circuit open", "gasUsed": 0}
        headers = _trace_headers()
        payload: dict[str, Any] = {"simulations": simulations}

        async def _do_bundle() -> dict[str, Any]:
            async def _req() -> dict[str, Any]:
                async with httpx.AsyncClient(timeout=get_timeout("simulation")) as client:
                    r = await client.post(
                        f"{self.base_url}/simulate-bundle",
                        headers=headers,
                        json=payload,
                    )
                if r.status_code == 503:
                    return {
                        "success": False,
                        "error": "Tenderly not configured",
                        "gasUsed": 0,
                    }
                r.raise_for_status()
                return r.json()

            return await _retry_http(_req, "simulation")

        try:
            return await breaker.call(_do_bundle)
        except CircuitOpenError:
            return {"success": False, "error": "Simulation service circuit open", "gasUsed": 0}


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
        self.base_url = (
            base_url or os.environ.get("DEPLOY_SERVICE_URL", "http://localhost:8003")
        ).rstrip("/")

    async def get_deploy_plan(
        self,
        chain_id: int,
        bytecode: str,
        abi: list,
        constructor_args: list | None = None,
    ) -> dict[str, Any]:
        breaker = get_breaker("deploy")
        if not breaker.can_execute():
            logger.warning("[deploy] circuit open, skipping get_deploy_plan")
            raise CircuitOpenError("Deploy service circuit open")
        headers = _trace_headers()

        async def _do_deploy() -> dict[str, Any]:
            async def _req() -> dict[str, Any]:
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

            return await _retry_http(_req, "deploy")

        return await breaker.call(_do_deploy)


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
        self.base_url = (
            base_url or os.environ.get("STORAGE_SERVICE_URL", "http://localhost:4005")
        ).rstrip("/")

    async def pin(self, content: str, name: str) -> dict[str, Any]:
        breaker = get_breaker("storage")
        if not breaker.can_execute():
            logger.warning("[storage] circuit open, skipping pin")
            raise CircuitOpenError("Storage service circuit open")
        headers = _trace_headers()

        async def _do_pin() -> dict[str, Any]:
            async def _req() -> dict[str, Any]:
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

            return await _retry_http(_req, "storage")

        return await breaker.call(_do_pin)

    async def unpin(self, cid: str) -> None:
        breaker = get_breaker("storage")
        if not breaker.can_execute():
            logger.warning("[storage] circuit open, skipping unpin")
            raise CircuitOpenError("Storage service circuit open")
        headers = _trace_headers()

        async def _do_unpin() -> None:
            async def _req() -> None:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    r = await client.post(
                        f"{self.base_url}/ipfs/unpin",
                        headers=headers,
                        json={"cid": cid},
                    )
                r.raise_for_status()

            await _retry_http(_req, "storage")

        await breaker.call(_do_unpin)


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
