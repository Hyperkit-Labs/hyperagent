"""Network feature detection and compatibility framework"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class NetworkFeature(Enum):
    """Network-specific features"""

    PEF = "pef"  # Parallel Execution Framework (Hyperion)
    METISVM = "metisvm"  # MetisVM optimizations (Hyperion)
    EIGENDA = "eigenda"  # EigenDA data availability (Mantle mainnet)
    BATCH_DEPLOYMENT = "batch_deployment"  # Batch deployment support
    FLOATING_POINT = "floating_point"  # Floating-point operations (MetisVM)
    AI_INFERENCE = "ai_inference"  # On-chain AI inference (MetisVM)


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


NETWORK_FEATURES: Dict[str, Dict[str, Any]] = {
    "hyperion_testnet": {
        "features": {
            NetworkFeature.PEF: True,
            NetworkFeature.METISVM: True,
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.FLOATING_POINT: True,
            NetworkFeature.AI_INFERENCE: True,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 133717,
        "rpc_url": "https://hyperion-testnet.metisdevops.link",
        "explorer": "https://hyperion-testnet-explorer.metisdevops.link",
        "currency": "tMETIS",
    },
    "hyperion_mainnet": {
        "features": {
            NetworkFeature.PEF: True,
            NetworkFeature.METISVM: True,
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.FLOATING_POINT: True,
            NetworkFeature.AI_INFERENCE: True,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 133718,
        "rpc_url": "https://hyperion.metisdevops.link",
        "explorer": "https://hyperion-explorer.metisdevops.link",
        "currency": "METIS",
    },
    "mantle_testnet": {
        "features": {
            NetworkFeature.PEF: False,
            NetworkFeature.METISVM: False,
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.FLOATING_POINT: False,
            NetworkFeature.AI_INFERENCE: False,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 5003,
        "rpc_url": "https://rpc.sepolia.mantle.xyz",
        "explorer": "https://sepolia.mantlescan.xyz",
        "currency": "MNT",
    },
    "mantle_mainnet": {
        "features": {
            NetworkFeature.PEF: False,
            NetworkFeature.METISVM: False,
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.FLOATING_POINT: False,
            NetworkFeature.AI_INFERENCE: False,
            NetworkFeature.EIGENDA: True,
        },
        "chain_id": 5000,
        "rpc_url": "https://rpc.mantle.xyz",
        "explorer": "https://mantlescan.xyz",
        "currency": "MNT",
    },
    "avalanche_fuji": {
        "features": {
            NetworkFeature.PEF: False,
            NetworkFeature.METISVM: False,
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.FLOATING_POINT: False,
            NetworkFeature.AI_INFERENCE: False,
            NetworkFeature.EIGENDA: False,
        },
        "chain_id": 43113,
        "rpc_url": "https://api.avax-test.network/ext/bc/C/rpc",
        "explorer": "https://testnet.snowtrace.io",
        "currency": "AVAX",
    },
    "avalanche_mainnet": {
        "features": {
            NetworkFeature.PEF: False,
            NetworkFeature.METISVM: False,
            NetworkFeature.BATCH_DEPLOYMENT: True,
            NetworkFeature.FLOATING_POINT: False,
            NetworkFeature.AI_INFERENCE: False,
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

    _hyperionkit_client: Optional[Any] = None

    @classmethod
    def _get_hyperionkit_client(cls):
        """Get or create HyperionKit client (lazy initialization)"""
        if cls._hyperionkit_client is None:
            try:
                from hyperagent.integration.hyperionkit_client import HyperionKitClient

                cls._hyperionkit_client = HyperionKitClient()
            except ImportError:
                logger.warning("HyperionKit client not available - using hardcoded configs")
                cls._hyperionkit_client = None
        return cls._hyperionkit_client

    @staticmethod
    async def get_network_config_async(network: str) -> Dict[str, Any]:
        """
        Get network config from NetworkRegistry (async) with fallback
        
        Priority:
        1. NetworkRegistry (uses HyperionKit API if available)
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
        """Get feature map for network"""
        if network not in NETWORK_FEATURES:
            return {
                NetworkFeature.PEF: False,
                NetworkFeature.METISVM: False,
                NetworkFeature.EIGENDA: False,
                NetworkFeature.BATCH_DEPLOYMENT: True,
                NetworkFeature.FLOATING_POINT: False,
                NetworkFeature.AI_INFERENCE: False,
            }
        return NETWORK_FEATURES[network]["features"]

    @staticmethod
    def supports_feature(network: str, feature: NetworkFeature) -> bool:
        """Check if network supports a specific feature"""
        features = NetworkFeatureManager.get_features(network)
        return features.get(feature, False)

    @staticmethod
    def get_network_config(network: str, load_usdc: bool = True) -> Dict[str, Any]:
        """Get full network configuration"""
        config = NETWORK_FEATURES.get(network, {}).copy()

        if load_usdc:
            from hyperagent.core.config import settings

            usdc_map = {
                "avalanche_fuji": settings.usdc_address_fuji,
                "avalanche_mainnet": settings.usdc_address_avalanche,
            }
            usdc_address = usdc_map.get(network)
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
            NetworkFeature.PEF: "sequential_deployment",
            NetworkFeature.METISVM: "standard_compilation",
            NetworkFeature.EIGENDA: "skip_data_availability",
            NetworkFeature.FLOATING_POINT: "fixed_point_math",
            NetworkFeature.AI_INFERENCE: "skip_ai_inference",
        }
        return fallbacks.get(feature)

    @staticmethod
    def is_x402_network(network: str, x402_enabled: bool, x402_enabled_networks: str) -> bool:
        """Check if network supports x402 payments"""
        if not x402_enabled:
            return False

        if not x402_enabled_networks:
            return False

        normalized_network = network.replace("-", "_").lower()

        enabled_networks = [
            n.strip().replace("-", "_").lower()
            for n in x402_enabled_networks.split(",")
            if n.strip()
        ]

        return normalized_network in enabled_networks

    @staticmethod
    def normalize_network_name(network: str) -> str:
        """Normalize network name to handle variations"""
        return network.replace("-", "_").lower()
