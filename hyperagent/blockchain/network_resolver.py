"""Network resolution helpers

Goal: accept flexible network identifiers and resolve them into a usable EVM network config.

Supported identifiers:
- canonical names from config/networks.yaml (e.g. "mantle_testnet")
- raw chain IDs (e.g. "5003")
- CAIP-2 EVM IDs (e.g. "eip155:5003")

For unknown networks, we can synthesize an RPC URL using Thirdweb's public RPC pattern.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


def normalize_network_id(network: str) -> str:
    return (network or "").strip().lower().replace("-", "_")


def parse_evm_chain_id(network: str) -> Optional[int]:
    """Parse chainId from either a numeric string or a CAIP-2 EVM identifier."""
    raw = (network or "").strip().lower()

    if not raw:
        return None

    # CAIP-2: eip155:<chainId>
    if raw.startswith("eip155:"):
        tail = raw.split(":", 1)[1]
        if tail.isdigit():
            return int(tail)
        return None

    if raw.isdigit():
        return int(raw)

    return None


def build_thirdweb_rpc_url(chain_id: int, thirdweb_client_id: Optional[str]) -> str:
    """Construct a Thirdweb RPC URL.

    If THIRDWEB_CLIENT_ID is present, include it for higher rate limits.
    """
    base = f"https://{chain_id}.rpc.thirdweb.com"
    if thirdweb_client_id:
        return f"{base}/{thirdweb_client_id}"
    return base


@dataclass
class ResolvedNetwork:
    network: str
    chain_id: int
    rpc_url: str
    explorer: Optional[str] = None
    currency: str = "ETH"
    rpc_source: str = "config"  # config | thirdweb
    is_dynamic: bool = False

    def as_dict(self) -> Dict[str, Any]:
        return {
            "network": self.network,
            "chain_id": self.chain_id,
            "rpc_url": self.rpc_url,
            "explorer": self.explorer,
            "currency": self.currency,
            "rpc_source": self.rpc_source,
            "is_dynamic": self.is_dynamic,
        }


def resolve_network(network: str, *, thirdweb_client_id: Optional[str]) -> ResolvedNetwork:
    """Resolve a network string into a fully usable config.

    Priority:
    1) Config-driven registry (NetworkFeatureManager / config/networks.yaml)
    2) Dynamic chainId/CAIP-2 + Thirdweb RPC
    """

    from hyperagent.blockchain.network_features import NetworkFeatureManager

    normalized = normalize_network_id(network)

    # Try config-driven
    cfg = NetworkFeatureManager.get_network_config(normalized, load_usdc=False) or {}
    chain_id = cfg.get("chain_id")

    # NOTE: cfg may also be stored under "id" in some older paths, keep best-effort.
    if not chain_id:
        chain_id = cfg.get("id")

    parsed_chain_id = parse_evm_chain_id(network)
    if not chain_id and parsed_chain_id:
        chain_id = parsed_chain_id

    if not chain_id:
        raise ValueError(
            f"Unknown network '{network}'. Provide a known network id, a chain id (e.g. '56'), "
            "or a CAIP-2 id like 'eip155:56'."
        )

    # Determine rpc
    rpc_url = cfg.get("rpc_url")
    if not rpc_url:
        rpc_urls = cfg.get("rpc_urls")
        if isinstance(rpc_urls, list) and rpc_urls:
            rpc_url = rpc_urls[0]

    is_dynamic = False
    rpc_source = "config"

    if not rpc_url:
        # Dynamic fallback
        rpc_url = build_thirdweb_rpc_url(int(chain_id), thirdweb_client_id)
        is_dynamic = True
        rpc_source = "thirdweb"

    explorer = cfg.get("explorer")
    currency = cfg.get("currency") or "ETH"

    # Prefer a stable identifier for dynamic networks
    resolved_network_id = normalized if normalized and not parsed_chain_id else f"eip155:{int(chain_id)}"

    return ResolvedNetwork(
        network=resolved_network_id,
        chain_id=int(chain_id),
        rpc_url=rpc_url,
        explorer=explorer,
        currency=currency,
        rpc_source=rpc_source,
        is_dynamic=is_dynamic,
    )
