"""Network configuration and Web3 instance management"""

from typing import Any, Dict, List, Optional

from web3 import Web3

from hyperagent.blockchain.network_features import (
    NETWORK_FEATURES,
    NetworkFeature,
    NetworkFeatureManager,
)

# Merge NETWORKS dict with feature registry for backward compatibility
NETWORKS = {}
for network_name, config in NETWORK_FEATURES.items():
    NETWORKS[network_name] = {
        "chain_id": config.get("chain_id"),
        "rpc_url": config.get("rpc_url"),
        "explorer": config.get("explorer"),
        "currency": config.get("currency"),
    }


class NetworkManager:
    """Manage Web3 connections to different networks"""

    def __init__(self, use_mantle_sdk: bool = False):
        """
        Initialize NetworkManager

        Args:
            use_mantle_sdk: If True, use Mantle SDK for Mantle networks (when available)
        """
        self._instances: Dict[str, Web3] = {}
        self.use_mantle_sdk = use_mantle_sdk
        self.mantle_sdk_clients: Dict[str, Any] = {}

    def get_web3(self, network: str) -> Web3:
        """
        Get or create Web3 instance for network

        For Mantle networks, optionally use Mantle SDK if available and enabled.
        Otherwise, use standard Web3.py.
        """
        if network not in NETWORKS:
            raise ValueError(f"Unknown network: {network}")

        # For Mantle networks, optionally use SDK
        if network.startswith("mantle") and self.use_mantle_sdk:
            from hyperagent.blockchain.mantle_sdk import MantleSDKClient

            if network not in self.mantle_sdk_clients:
                self.mantle_sdk_clients[network] = MantleSDKClient(network)

            # Mantle SDK Integration Status:
            # - MantleSDKClient is initialized and available for future use
            # - Currently using Web3.py as the primary client for all networks
            # - SDK wrapper implementation is planned for future enhancement
            # - When SDK wrapper is available, it will implement Web3 interface for seamless integration
            if self.mantle_sdk_clients[network].is_available():
                logger.debug(f"Mantle SDK available for {network}, using Web3.py for now")
                # Continue to Web3.py initialization below

        # Standard Web3.py initialization
        if network not in self._instances:
            config = NETWORKS[network]
            self._instances[network] = Web3(Web3.HTTPProvider(config["rpc_url"]))

        return self._instances[network]

    def get_network_config(self, network: str) -> Dict[str, Any]:
        """Get network configuration"""
        if network not in NETWORKS:
            raise ValueError(f"Unknown network: {network}")
        return NETWORKS[network]

    def get_network_features(self, network: str) -> Dict[NetworkFeature, bool]:
        """
        Get feature map for network

        Args:
            network: Network name

        Returns:
            Dictionary mapping NetworkFeature to bool
        """
        return NetworkFeatureManager.get_features(network)

    def supports_feature(self, network: str, feature: NetworkFeature) -> bool:
        """
        Check if network supports a specific feature

        Args:
            network: Network name
            feature: NetworkFeature enum value

        Returns:
            True if feature is supported, False otherwise
        """
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
        """
        Register a custom network dynamically

        Concept: Add new network at runtime
        Logic:
            1. Register network in feature registry
            2. Add to NETWORKS dict for backward compatibility
            3. Network becomes immediately available

        Args:
            network_name: Unique network identifier
            chain_id: Blockchain chain ID
            rpc_url: RPC endpoint URL
            features: Dictionary mapping NetworkFeature to bool
            explorer: Optional block explorer URL
            currency: Optional native currency symbol
        """
        # Register in feature registry
        NetworkFeatureManager.register_network(
            network_name, chain_id, rpc_url, features, explorer, currency
        )

        # Add to NETWORKS dict for backward compatibility
        NETWORKS[network_name] = {
            "chain_id": chain_id,
            "rpc_url": rpc_url,
            "explorer": explorer,
            "currency": currency,
        }

        logger.info(f"Registered custom network: {network_name}")

    def load_networks_from_config(self, config_path: str) -> List[str]:
        """
        Load and register networks from configuration file

        Args:
            config_path: Path to network configuration file (JSON or YAML)

        Returns:
            List of registered network names
        """
        from hyperagent.blockchain.network_config import register_networks_from_config

        registered = register_networks_from_config(config_path)

        # Update NETWORKS dict for backward compatibility
        for network_name in registered:
            config = NetworkFeatureManager.get_network_config(network_name)
            NETWORKS[network_name] = {
                "chain_id": config.get("chain_id"),
                "rpc_url": config.get("rpc_url"),
                "explorer": config.get("explorer"),
                "currency": config.get("currency"),
            }

        return registered
