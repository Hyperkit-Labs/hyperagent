"""
UI scaffold agent: build chain-agnostic UiAppSchema from deployments + ABI.
Selects common read/write functions and maps to UiAction with params.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from registries import get_default_chain_id, get_timeout
from trace_context import get_trace_headers

COMPILE_SERVICE_URL = os.environ.get(
    "COMPILE_SERVICE_URL", "http://localhost:8004"
).rstrip("/")

READ_FNS = {
    "balanceOf",
    "totalSupply",
    "symbol",
    "name",
    "decimals",
    "ownerOf",
    "getApproved",
    "tokenURI",
    "deposit",
    "withdraw",
    "borrow",
    "repay",
    "healthFactor",
    "getAccountLiquidity",
    "getReserveData",
    "listings",
    "getListing",
    "tokenOfOwnerByIndex",
    "getProposal",
    "proposalVotes",
    "state",
    "getTransactionCount",
    "getConfirmationCount",
    "isConfirmed",
    "getOwners",
    "getReserves",
    "getAmountOut",
    "getAmountIn",
    "balanceOf",
    "totalSupply",
}
WRITE_FNS = {
    "transfer",
    "approve",
    "transferFrom",
    "mint",
    "burn",
    "safeTransferFrom",
    "deposit",
    "withdraw",
    "borrow",
    "repay",
    "liquidate",
    "list",
    "buy",
    "cancelListing",
    "updateListing",
    "propose",
    "vote",
    "queue",
    "execute",
    "submitTransaction",
    "confirmTransaction",
    "revokeConfirmation",
    "executeTransaction",
    "swap",
    "addLiquidity",
    "removeLiquidity",
    "swapExactTokensForTokens",
    "swapTokensForExactTokens",
}


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
        is_write = name in WRITE_FNS or (
            item.get("stateMutability") not in ("view", "pure") and not is_read
        )
        if not is_read and not is_write:
            continue
        kind = "read" if is_read else "write"
        inputs = item.get("inputs") or []
        params = [_abi_input_to_param(i) for i in inputs]
        actions.append(
            {
                "id": f"{name}_{len(actions)}",
                "label": name.replace("_", " ").title(),
                "kind": kind,
                "fn": name,
                "params": params,
                "payable": item.get("stateMutability") == "payable",
                "network": chain_id,
                "executionMode": "eoa",
            }
        )
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


async def get_abi_from_compile(
    contract_source: str, framework: str = "hardhat"
) -> list[dict] | None:
    """Call compile service to get ABI for contract source."""
    try:
        headers = get_trace_headers()
        async with httpx.AsyncClient(timeout=get_timeout("ui_scaffold")) as client:
            r = await client.post(
                f"{COMPILE_SERVICE_URL}/compile",
                json={"contractCode": contract_source, "framework": framework},
                headers=headers,
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
    Generate UiAppSchema from deployments. Uses first deployment as primary; when multiple
    deployments exist, merges actions from all with contract context (contractAddress, contractName).
    """
    if not deployments:
        return None
    first = deployments[0]
    contract_address = first.get("contract_address") or first.get("contractAddress")
    if not contract_address:
        return None
    chain_id = first.get("chain_id") or first.get("chainId") or get_default_chain_id()
    all_actions: list[dict] = []
    all_abis: list[dict] = []
    contract_names = list(contracts.keys()) if contracts else []

    for idx, dep in enumerate(deployments):
        addr = dep.get("contract_address") or dep.get("contractAddress")
        if not addr:
            continue
        abi = dep.get("abi") or (dep.get("plan") or {}).get("abi")
        cname = dep.get("contract_name") or (
            contract_names[idx] if idx < len(contract_names) else f"Contract{idx}"
        ).replace(".sol", "")
        if not abi and contracts:
            src_name = (
                contract_names[idx]
                if idx < len(contract_names)
                else next(
                    (n for n in contracts if isinstance(contracts.get(n), str)), None
                )
            )
            if src_name:
                abi = await get_abi_from_compile(contracts[src_name])
        if not abi:
            continue
        all_abis.append(abi)
        actions = _build_actions_from_abi(abi, chain_id)
        multi = len(deployments) > 1
        for a in actions:
            a = dict(a)
            if multi:
                a["contractAddress"] = addr
                a["contractName"] = cname
            all_actions.append(a)

    if not all_actions:
        return None
    primary_abi = first.get("abi") or (all_abis[0] if all_abis else [])
    if not primary_abi and contract_names and contracts:
        primary_abi = (
            await get_abi_from_compile(contracts.get(contract_names[0], "")) or []
        )
    name = (
        first.get("contract_name")
        or (contract_names[0] if contract_names else "Contract").replace(".sol", "")
    ).replace(".sol", "")
    return {
        "name": name,
        "description": network or f"Interact with {name}",
        "chainId": chain_id,
        "contractAddress": contract_address,
        "abi": primary_abi,
        "actions": all_actions,
        "contracts": (
            [
                {
                    "address": d.get("contract_address") or d.get("contractAddress"),
                    "name": d.get("contract_name", "").replace(".sol", ""),
                }
                for d in deployments
            ]
            if len(deployments) > 1
            else None
        ),
    }
