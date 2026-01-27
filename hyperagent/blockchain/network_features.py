"""Network feature detection and compatibility framework"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from hyperagent.blockchain.network_resolver import normalize_network_id, parse_evm_chain_id, build_thirdweb_rpc_url

logger = logging.getLogger(__name__)


class NetworkFeature(Enum):
    """Network-specific features

    HyperAgent is intentionally chain-agnostic. Features here represent optional
    capabilities that may be enabled per-network.

    NOTE: Hyperion/Metis-specific features (PEF/MetisVM/FP/AI inference) were
    removed as part of the multichain refocus.
    """

    EIGENDA = "eigenda"  # EigenDA data availability / metadata storage
    BATCH_DEPLOYMENT = "batch_deployment"  # Batch deployment support


@dataclass
class NetworkConfig:
    """Centralized network configuration"""

    name: str
    chain_id: int
    rpc_url: str
    explorer: Optional[str] = None
    currency: str = "ETH"
    usdc_address: Optional[str] = None
    features: Optional[Dict[NetworkFeature, bool]] = None


# NOTE: This dict is a fallback. The preferred approach is to load
# networks from `config/networks.yaml` (see `hyperagent/blockchain/network_config.py`).
#
# Keep this minimal to avoid hardcoding networks.
NETWORK_FEATURES: Dict[str, Dict[str, Any]] = {
    "mantle_testnet": {
        "features": {
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 5003,
        "rpc_url": "https://rpc.sepolia.mantle.xyz",
        "explorer": "https://sepolia.mantlescan.xyz",
        "currency": "MNT",
    },
    "mantle_mainnet": {
        "features": {
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.EIGENDA: True,
        },
        "chain_id": 5000,
        "rpc_url": "https://rpc.mantle.xyz",
        "explorer": "https://mantlescan.xyz",
        "currency": "MNT",
    },
    "avalanche_fuji": {
        "features": {
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 43113,
        "rpc_url": "https://api.avax-test.network/ext/bc/C/rpc",
        "explorer": "https://testnet.snowtrace.io",
        "currency": "AVAX",
    },
    "avalanche_mainnet": {
        "features": {
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 43114,
        "rpc_url": "https://api.avax.network/ext/bc/C/rpc",
        "explorer": "https://snowtrace.io",
        "currency": "AVAX",
    },
}


class NetworkFeatureManager:
    """Manage network feature detection and compatibility"""


    @staticmethod
    async def get_network_config_async(network: str) -> Dict[str, Any]:
        """
        Get network config from NetworkRegistry (async) with fallback
        
        Priority:
        1. NetworkRegistry (local config-driven)
        2. Hardcoded NETWORK_FEATURES
        """
        try:
            from hyperagent.blockchain.network_registry import NetworkRegistry
            from hyperagent.cache.redis_manager import RedisManager
            from hyperagent.core.config import settings
            
            # Initialize registry with Redis if available
            redis_manager = None
            if settings.redis_url:
                try:
                    redis_manager = RedisManager(settings.redis_url)
                except Exception:
                    pass
            
            registry = NetworkRegistry(redis_manager=redis_manager)
            return await registry.get_network(network)
        except Exception as e:
            logger.warning(f"NetworkRegistry unavailable: {e} - using fallback")
            # Fallback to hardcoded configs
        return NetworkFeatureManager.get_network_config(network)

    @staticmethod
    def get_features(network: str) -> Dict[NetworkFeature, bool]:
        """Get feature map for network.

        For unknown networks (including raw chainIds / CAIP-2 ids), return safe defaults.
        """
        normalized = normalize_network_id(network)
        if normalized not in NETWORK_FEATURES:
            return {
                NetworkFeature.EIGENDA: False,
                NetworkFeature.BATCH_DEPLOYMENT: True,
            }
        return NETWORK_FEATURES[normalized]["features"]

    @staticmethod
    def supports_feature(network: str, feature: NetworkFeature) -> bool:
        """Check if network supports a specific feature"""
        features = NetworkFeatureManager.get_features(network)
        return features.get(feature, False)

    @staticmethod
    def get_network_config(network: str, load_usdc: bool = True) -> Dict[str, Any]:
        """Get full network configuration.

        - For config-driven networks, returns the registered config.
        - For dynamic networks (raw chainId / CAIP-2), synthesizes a minimal config.
        """
        from hyperagent.core.config import settings

        normalized = normalize_network_id(network)
        config = NETWORK_FEATURES.get(normalized, {}).copy()

        # Dynamic: allow chainId / eip155:chainId
        if not config:
            chain_id = parse_evm_chain_id(network)
            if chain_id:
                return {
                    "chain_id": int(chain_id),
                    "rpc_url": build_thirdweb_rpc_url(int(chain_id), settings.thirdweb_client_id),
                    "explorer": None,
                    "currency": "ETH",
                    "features": {
                        NetworkFeature.BATCH_DEPLOYMENT: True,
                        NetworkFeature.EIGENDA: False,
                    },
                }
            return {}

        if load_usdc:
            usdc_map = {
                "avalanche_fuji": getattr(settings, "usdc_address_fuji", None),
                "avalanche_mainnet": getattr(settings, "usdc_address_avalanche", None),
                "mantle_testnet": getattr(settings, "usdc_address_mantle_sepolia", None),
                "mantle_mainnet": getattr(settings, "usdc_address_mantle", None),
                "ethereum_mainnet": getattr(settings, "usdc_address_ethereum", None),
                "ethereum_sepolia": getattr(settings, "usdc_address_ethereum_sepolia", None),
                "polygon_mainnet": getattr(settings, "usdc_address_polygon", None),
                "polygon_amoy": getattr(settings, "usdc_address_polygon_amoy", None),
                "base_mainnet": getattr(settings, "usdc_address_base", None),
                "base_sepolia": getattr(settings, "usdc_address_base_sepolia", None),
                "arbitrum_one": getattr(settings, "usdc_address_arbitrum", None),
                "arbitrum_sepolia": getattr(settings, "usdc_address_arbitrum_sepolia", None),
                "optimism_mainnet": getattr(settings, "usdc_address_optimism", None),
                "optimism_sepolia": getattr(settings, "usdc_address_optimism_sepolia", None),
            }
            usdc_address = usdc_map.get(normalized)
            if usdc_address:
                config["usdc_address"] = usdc_address

        return config

    @staticmethod
    def list_networks() -> List[str]:
        """List all registered networks"""
        return list(NETWORK_FEATURES.keys())

    @staticmethod
    def register_network(
        network_name: str,
        chain_id: int,
        rpc_url: str,
        features: Dict[NetworkFeature, bool],
        explorer: Optional[str] = None,
        currency: Optional[str] = None,
    ):
        """Register a custom network with feature flags"""
        NETWORK_FEATURES[network_name] = {
            "features": features,
            "chain_id": chain_id,
            "rpc_url": rpc_url,
            "explorer": explorer,
            "currency": currency,
        }

    @staticmethod
    def get_fallback_strategy(network: str, feature: NetworkFeature) -> Optional[str]:
        """Get fallback strategy for unavailable feature"""
        fallbacks = {
            NetworkFeature.EIGENDA: "skip_data_availability",
        }
        return fallbacks.get(feature)

    @staticmethod
    def is_x402_network(network: str, x402_enabled: bool, x402_enabled_networks: str) -> bool:
        """Check if network supports x402 payments.

        Supports:
        - exact network ids (e.g. avalanche_fuji)
        - raw chain ids (e.g. 43113)
        - CAIP-2 (e.g. eip155:43113)
        - wildcards: "*" or "all"
        """
        if not x402_enabled:
            return False

        if not x402_enabled_networks:
            return False

        normalized_network = normalize_network_id(network)
        network_chain_id = parse_evm_chain_id(network)

        enabled_tokens = [n.strip().lower() for n in x402_enabled_networks.split(",") if n.strip()]
        if any(t in ("*", "all") for t in enabled_tokens):
            return True

        for token in enabled_tokens:
            token_norm = normalize_network_id(token)
            token_chain_id = parse_evm_chain_id(token)

            if token_chain_id is not None and network_chain_id is not None:
                if int(token_chain_id) == int(network_chain_id):
                    return True
                continue

            if token_norm == normalized_network:
                return True

        return False

    @staticmethod
    def normalize_network_name(network: str) -> str:
        """Normalize network name to handle variations"""
        return network.replace("-", "_").lower()


def _load_networks_from_default_config() -> None:
    """Best-effort load of config/networks.yaml (no hard dependency).

    This allows adding/removing networks without code changes.
    """
    try:
        from hyperagent.blockchain.network_config import (
            load_default_network_config,
            register_networks_from_config,
        )

        config_path = load_default_network_config()
        if config_path:
            register_networks_from_config(config_path)
            logger.info(f"Loaded network config file: {config_path}")
    except Exception as e:
        # Keep running using fallback NETWORK_FEATURES
        logger.debug(f"No network config loaded: {e}")


# Load config-driven networks on import.
_load_networks_from_default_config()
