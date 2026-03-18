"""Security and exploit-sim policy. Single source for policy resolution and contract-type mapping."""

from __future__ import annotations

import os
from typing import Any

EXPLOIT_SIM_CONTRACT_TYPE_TO_POC: dict[str, list[str]] = {
    "dex": ["src/test/DEX", "src/test/uniswap", "src/test/2024-04", "src/test/2024-05"],
    "lending": ["src/test/lending", "src/test/aave", "src/test/2024-04", "src/test/2024-05"],
    "vault": ["src/test/vault", "src/test/2024-04", "src/test/2024-05"],
    "erc20": ["src/test/2024-04", "src/test/2024-05", "src/test/erc20", "src/test/token"],
    "erc721": ["src/test/nft", "src/test/2024-04", "src/test/2024-05", "src/test/erc721"],
    "nft": ["src/test/nft", "src/test/2024-04", "src/test/2024-05", "src/test/erc721"],
}


def get_exploit_sim_enabled() -> bool:
    """Production defaults to True (fail-closed). Dev defaults to False."""
    raw = os.environ.get("EXPLOIT_SIM_ENABLED", "").strip().lower()
    if raw in ("1", "true", "yes"):
        return True
    if raw in ("0", "false", "no"):
        return False
    env = (os.environ.get("ENV") or os.environ.get("NODE_ENV") or "").strip().lower()
    is_production = env in ("production", "prod")
    return is_production


def resolve_contract_type(spec: dict[str, Any], design: dict[str, Any]) -> str:
    """Infer contract type from spec and design for PoC path mapping."""
    token_type = (spec.get("token_type") or "").lower()
    if token_type in ("dex", "amm", "swap"):
        return "dex"
    if token_type in ("lending", "lend", "borrow"):
        return "lending"
    if token_type in ("vault", "staking"):
        return "vault"
    if token_type in ("erc721", "nft"):
        return "nft"
    if token_type in ("erc20", "token"):
        return "erc20"

    components = design.get("components") or []
    for c in components:
        name = (c.get("name") or "").lower()
        if "dex" in name or "swap" in name or "amm" in name:
            return "dex"
        if "lend" in name or "borrow" in name or "aave" in name:
            return "lending"
        if "vault" in name or "stake" in name:
            return "vault"
    return "erc20"


def get_poc_paths_for_contract_type(contract_type: str) -> list[str]:
    """Return PoC test paths for the given contract type."""
    return list(EXPLOIT_SIM_CONTRACT_TYPE_TO_POC.get(contract_type, EXPLOIT_SIM_CONTRACT_TYPE_TO_POC["erc20"]))
