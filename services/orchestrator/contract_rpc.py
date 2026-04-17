"""Contract read (eth_call) and call (build transaction) via chain RPC. Uses registry for RPC URL."""

from __future__ import annotations

import logging
from typing import Any

from web3 import Web3

logger = logging.getLogger(__name__)

# SKALE chains use legacy (Type 0) transactions only.
# EIP-1559 fields (maxFeePerGas, maxPriorityFeePerGas) cause reverts on SKALE.
_SKALE_CHAIN_IDS: frozenset[int] = frozenset({1187947933, 324705682})


def _normalize_address(addr: str) -> str:
    if not addr or not isinstance(addr, str):
        return ""
    a = addr.strip()
    if a.startswith("0x") and len(a) == 42:
        return a
    if len(a) == 40:
        return "0x" + a
    return a


def contract_read(
    rpc_url: str,
    contract_address: str,
    abi: list[Any],
    function_name: str,
    args: list[Any],
) -> tuple[bool, Any, str]:
    """Execute view/pure contract function via eth_call. Returns (success, result_or_none, error_message)."""
    address = _normalize_address(contract_address)
    if not address:
        return (False, None, "Invalid contract_address")
    if not function_name or not abi:
        return (False, None, "abi and function_name required")
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 15}))
        if not w3.is_connected():
            return (False, None, "RPC connection failed")
        contract = w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)
        fn = getattr(contract.functions, function_name, None)
        if fn is None:
            return (False, None, f"Function {function_name} not found in ABI")
        if args:
            result = fn(*args).call()
        else:
            result = fn().call()
        if hasattr(result, "__iter__") and not isinstance(result, (str, bytes)):
            try:
                result = list(result)
            except Exception:
                pass
        return (True, result, "")
    except Exception as e:
        logger.warning("contract_read failed: %s", e)
        return (False, None, str(e))


def contract_call_build_tx(
    rpc_url: str,
    contract_address: str,
    abi: list[Any],
    function_name: str,
    args: list[Any],
    value: str = "0",
    gas_limit: int | None = None,
    caller_address: str | None = None,
    chain_id: int | None = None,
) -> tuple[bool, dict[str, Any] | None, str]:
    """Build unsigned transaction for contract write. Returns (success, tx_dict_or_none, error_message)."""
    address = _normalize_address(contract_address)
    if not address:
        return (False, None, "Invalid contract_address")
    if not function_name or not abi:
        return (False, None, "abi and function_name required")
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 15}))
        if not w3.is_connected():
            return (False, None, "RPC connection failed")
        contract = w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)
        fn = getattr(contract.functions, function_name, None)
        if fn is None:
            return (False, None, f"Function {function_name} not found in ABI")
        try:
            value_wei = w3.to_wei(value, "ether") if value else 0
        except Exception:
            value_wei = 0
        tx_params: dict[str, Any] = {"value": value_wei}
        from_addr = (
            caller_address
            if caller_address
            else "0x0000000000000000000000000000000000000000"
        )
        tx_params["from"] = Web3.to_checksum_address(_normalize_address(from_addr))
        if gas_limit is not None and gas_limit > 0:
            tx_params["gas"] = gas_limit
        if chain_id is not None:
            tx_params["chainId"] = chain_id
        is_skale = chain_id is not None and chain_id in _SKALE_CHAIN_IDS
        if is_skale:
            # SKALE only supports legacy (Type 0) transactions. Forcing type=0
            # prevents web3.py from adding EIP-1559 gas fields that cause reverts.
            # SKALE transactions are gasless (gasPrice=0), so set it explicitly.
            tx_params["type"] = 0
            tx_params["gasPrice"] = 0
            # Strip any EIP-1559 fields that may have been set by the caller.
            tx_params.pop("maxFeePerGas", None)
            tx_params.pop("maxPriorityFeePerGas", None)

        if args:
            built = fn(*args).build_transaction(tx_params)
        else:
            built = fn().build_transaction(tx_params)

        out: dict[str, Any] = {
            "to": built.get("to"),
            "data": built.get("data"),
            "value": hex(built.get("value", 0)),
            "gas": built.get("gas"),
            "chainId": built.get("chainId"),
        }
        if is_skale:
            # Return gasPrice=0 for SKALE; omit EIP-1559 fields entirely.
            out["gasPrice"] = "0x0"
            out["type"] = "0x0"
        else:
            gas_price = built.get("gasPrice")
            if gas_price is not None:
                out["gasPrice"] = gas_price
        return (True, {k: v for k, v in out.items() if v is not None}, "")
    except Exception as e:
        logger.warning("contract_call_build_tx failed: %s", e)
        return (False, None, str(e))
