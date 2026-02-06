"""Network configuration and Web3 instance management"""

import logging
from typing import Any, Dict, List, Optional

from web3 import Web3

from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager
from hyperagent.blockchain.network_resolver import normalize_network_id, resolve_network
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class NetworkManager:
    """
    NetworkManager: Web3 connection management and RPC handling
    
    Responsibilities:
    - Manage Web3 connections to blockchain networks
    - Handle RPC provider pooling and failover
    - Provide Web3 instances for contract interactions
    - Manage connection lifecycle and health checks
    
    Note: This class handles low-level Web3 connections.
    For network configuration, use NetworkRegistry.
    For feature flags, use NetworkFeatureManager.
    """
    """Manage Web3 connections to different networks."""

    def __init__(self, use_mantle_sdk: bool = False):
        self._instances: Dict[str, Web3] = {}
        self._configs: Dict[str, Dict[str, Any]] = {}
        self.use_mantle_sdk = use_mantle_sdk
        self.mantle_sdk_clients: Dict[str, Any] = {}

    def get_network_config(self, network: str) -> Dict[str, Any]:
        """Get a resolved network configuration.

        Supports config-driven networks and dynamic chainId/CAIP-2 identifiers.
        """
        key = normalize_network_id(network)
        if key not in self._configs:
            resolved = resolve_network(network, thirdweb_client_id=settings.thirdweb_client_id)
            # Keep the legacy key shape expected by call-sites.
            self._configs[key] = {
                "chain_id": resolved.chain_id,
                "rpc_url": resolved.rpc_url,
                "explorer": resolved.explorer,
                "currency": resolved.currency,
                "rpc_source": resolved.rpc_source,
                "is_dynamic": resolved.is_dynamic,
                "network": resolved.network,
            }
        return self._configs[key]

    def get_web3(self, network: str) -> Web3:
        """Get or create Web3 instance for network."""
        key = normalize_network_id(network)

        # For Mantle networks, optionally use SDK (still returns Web3.py today).
        # Note: Mantle SDK bridge service is optional - falls back to Web3.py if unavailable
        if key.startswith("mantle") and self.use_mantle_sdk:
            try:
                from hyperagent.blockchain.mantle_sdk import MantleSDKClient

                if key not in self.mantle_sdk_clients:
                    self.mantle_sdk_clients[key] = MantleSDKClient(key)

                if self.mantle_sdk_clients[key].is_available():
                    logger.debug(f"Mantle SDK available for {key}, using Web3.py for now")
            except (ImportError, Exception) as e:
                logger.debug(f"Mantle SDK not available for {key}, using Web3.py: {e}")

        if key not in self._instances:
            config = self.get_network_config(network)
            self._instances[key] = Web3(Web3.HTTPProvider(config["rpc_url"]))

        return self._instances[key]

    def get_network_features(self, network: str) -> Dict[NetworkFeature, bool]:
        return NetworkFeatureManager.get_features(network)

    def supports_feature(self, network: str, feature: NetworkFeature) -> bool:
        return NetworkFeatureManager.supports_feature(network, feature)

    def register_custom_network(
        self,
        network_name: str,
        chain_id: int,
        rpc_url: str,
        features: Dict[NetworkFeature, bool],
        explorer: Optional[str] = None,
        currency: Optional[str] = None,
    ):
        """Register a custom network dynamically (backward compatible)."""
        NetworkFeatureManager.register_network(
            network_name, chain_id, rpc_url, features, explorer, currency
        )

        # Invalidate local cache for this network.
        key = normalize_network_id(network_name)
        self._configs.pop(key, None)
        self._instances.pop(key, None)

        logger.info(f"Registered custom network: {network_name}")

    def load_networks_from_config(self, config_path: str) -> List[str]:
        """Load and register networks from configuration file."""
        from hyperagent.blockchain.network_config import register_networks_from_config

        registered = register_networks_from_config(config_path)

        # Invalidate cache for any registered networks.
        for name in registered:
            key = normalize_network_id(name)
            self._configs.pop(key, None)
            self._instances.pop(key, None)

        return registered
