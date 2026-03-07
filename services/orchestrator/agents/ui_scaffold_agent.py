"""
UI scaffold agent: build chain-agnostic UiAppSchema from deployments + ABI.
Selects common read/write functions and maps to UiAction with params.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

from registries import get_timeout

COMPILE_SERVICE_URL = os.environ.get("COMPILE_SERVICE_URL", "http://localhost:8004").rstrip("/")

READ_FNS = {"balanceOf", "totalSupply", "symbol", "name", "decimals", "ownerOf", "getApproved", "tokenURI"}
WRITE_FNS = {"transfer", "approve", "transferFrom", "mint", "burn", "safeTransferFrom"}


def _abi_input_to_param(inp: dict[str, Any]) -> dict[str, Any]:
    t = inp.get("type", "string")
    name = inp.get("name", "param")
    return {
        "name": name,
        "type": t,
        "required": True,
        "widget": "address" if t == "address" else ("number" if "int" in t else "text"),
    }


def _build_actions_from_abi(abi: list[dict], chain_id: int) -> list[dict]:
    actions = []
    seen = set()
    for item in abi:
        if item.get("type") != "function":
            continue
        name = item.get("name")
        if not name or name in seen:
            continue
        is_read = name in READ_FNS or (item.get("stateMutability") in ("view", "pure"))
        is_write = name in WRITE_FNS or (item.get("stateMutability") not in ("view", "pure") and not is_read)
        if not is_read and not is_write:
            continue
        kind = "read" if is_read else "write"
        inputs = item.get("inputs") or []
        params = [_abi_input_to_param(i) for i in inputs]
        actions.append({
            "id": f"{name}_{len(actions)}",
            "label": name.replace("_", " ").title(),
            "kind": kind,
            "fn": name,
            "params": params,
            "payable": item.get("stateMutability") == "payable",
            "network": chain_id,
            "executionMode": "eoa",
        })
        seen.add(name)
    return actions


def build_ui_schema(
    contract_address: str,
    chain_id: int,
    abi: list[dict],
    name: str = "Contract",
    description: str = "",
) -> dict[str, Any]:
    """Build UiAppSchema from contract address, chain, and ABI."""
    actions = _build_actions_from_abi(abi, chain_id)
    return {
        "name": name,
        "description": description or f"Interact with {name}",
        "chainId": chain_id,
        "contractAddress": contract_address,
        "abi": abi,
        "actions": actions,
    }


async def get_abi_from_compile(contract_source: str, framework: str = "hardhat") -> list[dict] | None:
    """Call compile service to get ABI for contract source."""
    try:
        async with httpx.AsyncClient(timeout=get_timeout("ui_scaffold")) as client:
            r = await client.post(
                f"{COMPILE_SERVICE_URL}/compile",
                json={"contractCode": contract_source, "framework": framework},
            )
            r.raise_for_status()
            data = r.json()
            if data.get("success") and data.get("abi"):
                return data["abi"]
    except Exception:
        pass
    return None


async def generate_ui_schema(
    deployments: list[dict],
    contracts: dict[str, Any],
    network: str = "",
) -> dict[str, Any] | None:
    """
    Generate UiAppSchema from first deployment. Uses deployment.abi if present;
    otherwise compiles first contract to get ABI.
    """
    if not deployments:
        return None
    first = deployments[0]
    contract_address = first.get("contract_address") or first.get("contractAddress")
    if not contract_address:
        return None
    chain_id = first.get("chain_id") or first.get("chainId") or 8453
    abi = first.get("abi")
    first_name = next((n for n in (contracts or {}) if isinstance((contracts or {}).get(n), str)), None)
    if not abi and first_name and contracts:
        abi = await get_abi_from_compile(contracts[first_name])
    if not abi:
        return None
    name = (first.get("contract_name") or (first_name or "Contract").replace(".sol", "")).replace(".sol", "")
    return build_ui_schema(contract_address, chain_id, abi, name=name, description=network or "")
