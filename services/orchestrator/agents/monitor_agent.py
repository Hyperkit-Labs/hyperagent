"""
Monitor agent: post-deploy health check. Runs after deploy step.
When simulation service is configured and deployments have contract_address, verifies each contract
is live via Tenderly simulation (ERC20 totalSupply() or ERC721 balanceOf read).
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

SIMULATION_SERVICE_URL = (
    os.environ.get("SIMULATION_SERVICE_URL") or "http://localhost:8002"
).rstrip("/")

# ERC20 totalSupply() selector; ERC721 balanceOf(address) selector (address param: zero-padded)
ERC20_TOTAL_SUPPLY = "0x18160ddd"
ERC721_BALANCE_OF = "0x70a08231" + "0" * 63 + "1"

SUPPORTED_READ_SELECTORS = {"totalSupply", "balanceOf"}


def _read_call_data(abi: list) -> tuple[str | None, str | None]:
    """Return (hex_call_data, unsupported_reason). Fail-closed: None when ABI has no supported read."""
    if not abi:
        return ERC20_TOTAL_SUPPLY, None
    for entry in abi:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        if name == "totalSupply" and entry.get("stateMutability") in ("view", "pure"):
            return ERC20_TOTAL_SUPPLY, None
        if name == "balanceOf" and entry.get("stateMutability") in ("view", "pure"):
            return ERC721_BALANCE_OF + "0" * 24, None
    return (
        None,
        "ABI has no totalSupply or balanceOf; monitor supports ERC20/ERC721 only",
    )


async def run_monitor(deployments: list[dict], run_id: str) -> dict:
    """
    Post-deploy monitoring. Returns { ok: bool, message: str, details?: dict }.
    When deployments have contract_address, verifies each via simulation service read call.
    """
    if not deployments:
        return {"ok": True, "message": "No deployments to monitor"}
    with_address = [d for d in deployments if d.get("contract_address")]
    if not with_address:
        return {"ok": True, "message": "Deployments pending signature; monitor skipped"}
    verified: list[dict] = []
    failed: list[dict] = []
    for dep in with_address:
        addr = dep.get("contract_address")
        chain_id = dep.get("chain_id") or dep.get("plan", {}).get("chainId")
        if not addr or not chain_id:
            continue
        abi = dep.get("abi") or dep.get("plan", {}).get("abi") or []
        data, unsupported = _read_call_data(abi)
        if data is None:
            failed.append(
                {
                    "address": addr,
                    "chain_id": chain_id,
                    "error": unsupported or "unsupported contract type",
                }
            )
            continue
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    f"{SIMULATION_SERVICE_URL}/simulate",
                    json={
                        "network": str(chain_id),
                        "from": "0x0000000000000000000000000000000000000001",
                        "to": addr,
                        "data": data,
                        "value": "0",
                    },
                )
                if r.status_code == 200:
                    j = r.json()
                    if j.get("success"):
                        verified.append({"address": addr, "chain_id": chain_id})
                    else:
                        failed.append(
                            {
                                "address": addr,
                                "chain_id": chain_id,
                                "error": j.get("error", "simulation failed"),
                            }
                        )
                else:
                    failed.append(
                        {
                            "address": addr,
                            "chain_id": chain_id,
                            "error": f"HTTP {r.status_code}",
                        }
                    )
        except Exception as e:
            failed.append(
                {"address": addr, "chain_id": chain_id, "error": str(e)[:200]}
            )
    ok = len(failed) == 0
    logger.info(
        "[monitor] run_id=%s verified=%d failed=%d", run_id, len(verified), len(failed)
    )
    return {
        "ok": ok,
        "message": (
            f"Verified {len(verified)} contract(s)"
            if ok
            else f"{len(failed)} contract(s) verification failed"
        ),
        "verified": verified,
        "failed": failed if failed else None,
        "deployments_count": len(deployments),
    }
