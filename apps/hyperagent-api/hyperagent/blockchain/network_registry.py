"""Network Registry Service

Centralized network management supporting 1000+ networks with pagination,
search, and dynamic loading from multiple sources.
"""

import logging
from typing import Any, Dict, List, Optional

from hyperagent.blockchain.network_features import (
    NETWORK_FEATURES,
    NetworkFeature,
    NetworkFeatureManager,
)
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class NetworkRegistry:
    """
    NetworkRegistry: Network configuration storage and retrieval
    
    Responsibilities:
    - Store and retrieve network configurations (chain ID, RPC URLs, etc.)
    - Manage network metadata (name, explorer URLs, etc.)
    - Provide network configuration lookup by ID or name
    - Handle network configuration validation
    
    Note: This class handles network configuration data.
    For Web3 connections, use NetworkManager.
    For feature flags, use NetworkFeatureManager.
    """
    """
    Centralized network registry supporting 1000+ networks
    
    Sources (in priority order):
    1. Redis cache (optional)
    2. Local config-driven registry (config/networks.yaml)
    3. Hardcoded NETWORK_FEATURES fallback
    
    Features:
    - Paginated network listing
    - Search by name, chain_id, currency
    - Feature filtering
    - Caching for performance
    - Dynamic network registration
    """

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize network registry
        
        Args:
            redis_manager: Optional Redis manager for caching
        """
        self.redis_manager = redis_manager
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._all_networks_cache: Optional[List[Dict[str, Any]]] = None


    async def get_network(self, network_id: str) -> Dict[str, Any]:
        """
        Get single network config with fallback chain
        
        Priority:
        1. Redis cache (if available)
        2. Local config-driven registry (NETWORK_FEATURES / config/networks.yaml)
        
        Args:
            network_id: Network identifier (e.g., "avalanche_fuji")
        
        Returns:
            Network configuration dictionary
        """
        # Normalize network ID
        network_id = network_id.replace("-", "_").lower()
        
        # Check local cache first
        if network_id in self._cache:
            return self._cache[network_id]
        
        # Try Redis cache
        if self.redis_manager:
            try:
                cached = await self.redis_manager.get(f"network_config:{network_id}")
                if cached:
                    import json
                    config = json.loads(cached) if isinstance(cached, str) else cached
                    self._cache[network_id] = config
                    return config
            except Exception as e:
                logger.debug(f"Redis cache miss for {network_id}: {e}")
        
        # Fallback to hardcoded configs
        config = NetworkFeatureManager.get_network_config(network_id)
        self._cache[network_id] = config
        return config

    async def list_networks(
        self,
        page: int = 1,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        List networks with pagination and filtering
        
        Args:
            page: Page number (1-indexed)
            limit: Number of networks per page
            filters: Optional filters:
                - features: List of feature names to filter by
                - x402_enabled: bool - filter by x402 support
                - testnet_only: bool - filter testnets only
                - mainnet_only: bool - filter mainnets only
                - currency: str - filter by currency
        
        Returns:
            {
                "networks": List[Dict],
                "total": int,
                "page": int,
                "limit": int,
                "has_next": bool,
                "has_prev": bool
            }
        """
        filters = filters or {}
        
        # Get all networks (cached)
        all_networks = await self._get_all_networks()
        
        # Apply filters
        filtered_networks = self._apply_filters(all_networks, filters)
        
        # Calculate pagination
        total = len(filtered_networks)
        start = (page - 1) * limit
        end = start + limit
        paginated_networks = filtered_networks[start:end]
        
        return {
            "networks": paginated_networks,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": end < total,
            "has_prev": page > 1,
        }

    async def search_networks(self, query: str) -> List[Dict[str, Any]]:
        """
        Search networks by name, chain_id, or currency
        
        Args:
            query: Search query string
        
        Returns:
            List of matching network configs
        """
        query_lower = query.lower()
        all_networks = await self._get_all_networks()
        
        results = []
        for network in all_networks:
            # Search in name
            if query_lower in network.get("name", "").lower():
                results.append(network)
                continue
            
            # Search in chain_id
            if query_lower in str(network.get("chain_id", "")):
                results.append(network)
                continue
            
            # Search in currency
            if query_lower in network.get("currency", "").lower():
                results.append(network)
                continue
        
        return results

    async def _get_all_networks(self) -> List[Dict[str, Any]]:
        """
        Get all networks from all sources
        
        Returns cached result if available
        """
        if self._all_networks_cache is not None:
            return self._all_networks_cache
        
        networks = []
        
        # Add hardcoded networks (merge, avoid duplicates)
        existing_ids = {net["network"] for net in networks}
        for network_id, config in NETWORK_FEATURES.items():
            if network_id not in existing_ids:
                networks.append(self._format_network_response(network_id, config))
        
        # Cache result
        self._all_networks_cache = networks
        return networks

    def _format_network_response(self, network_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Format network config for API response"""
        from hyperagent.core.config import settings
        
        features = config.get("features", {})
        if isinstance(features, dict) and any(isinstance(k, NetworkFeature) for k in features.keys()):
            # Convert NetworkFeature enum keys to strings
            features = {k.value if hasattr(k, "value") else str(k): v for k, v in features.items()}
        
        # Check x402 support
        supports_x402 = NetworkFeatureManager.is_x402_network(
            network_id, settings.x402_enabled, settings.x402_enabled_networks
        )
        
        return {
            "network": network_id,
            "name": network_id.replace("_", " ").title(),
            "chain_id": config.get("chain_id"),
            "rpc_url": config.get("rpc_url"),
            "explorer": config.get("explorer"),
            "currency": config.get("currency", "ETH"),
            "usdc_address": config.get("usdc_address"),
            "features": features,
            "supports_x402": supports_x402,
            "is_testnet": network_id.endswith("_testnet") or "testnet" in network_id.lower(),
        }

    def _apply_filters(
        self, networks: List[Dict[str, Any]], filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply filters to network list"""
        filtered = networks
        
        # Filter by features
        if "features" in filters:
            required_features = filters["features"]
            if isinstance(required_features, str):
                required_features = [required_features]
            filtered = [
                net
                for net in filtered
                if any(
                    net.get("features", {}).get(feat, False)
                    for feat in required_features
                )
            ]
        
        # Filter by x402 support
        if "x402_enabled" in filters:
            x402_only = filters["x402_enabled"]
            filtered = [net for net in filtered if net.get("supports_x402") == x402_only]
        
        # Filter by testnet/mainnet
        if filters.get("testnet_only"):
            filtered = [net for net in filtered if net.get("is_testnet", False)]
        elif filters.get("mainnet_only"):
            filtered = [net for net in filtered if not net.get("is_testnet", True)]
        
        # Filter by currency
        if "currency" in filters:
            currency = filters["currency"].upper()
            filtered = [net for net in filtered if net.get("currency", "").upper() == currency]
        
        return filtered

    async def register_network(
        self,
        network_name: str,
        chain_id: int,
        rpc_url: str,
        features: Dict[NetworkFeature, bool],
        explorer: Optional[str] = None,
        currency: Optional[str] = None,
        usdc_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dynamically register a new network
        
        Args:
            network_name: Network identifier
            chain_id: Chain ID
            rpc_url: RPC endpoint URL
            features: Feature flags
            explorer: Block explorer URL
            currency: Native currency symbol
            usdc_address: USDC token address
        
        Returns:
            Registered network config
        """
        # Register in NetworkFeatureManager (updates hardcoded dict)
        NetworkFeatureManager.register_network(
            network_name, chain_id, rpc_url, features, explorer, currency
        )
        
        # Build config
        config = {
            "chain_id": chain_id,
            "rpc_url": rpc_url,
            "explorer": explorer,
            "currency": currency or "ETH",
            "usdc_address": usdc_address,
            "features": features,
        }
        
        # Cache locally
        self._cache[network_name] = config
        
        # Cache in Redis if available
        if self.redis_manager:
            try:
                import json
                await self.redis_manager.set(
                    f"network_config:{network_name}",
                    json.dumps(config),
                    ttl=3600
                )
            except Exception as e:
                logger.debug(f"Failed to cache registered network in Redis: {e}")
        
        # Invalidate all networks cache
        self._all_networks_cache = None
        
        logger.info(f"Registered new network: {network_name}")
        return self._format_network_response(network_name, config)

