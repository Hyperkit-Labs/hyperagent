"""HyperionKit Integration Client

HyperAgent uses hyperionkit npm package as source of truth for:
- Network configuration (RPC URLs, chain IDs)
- API contracts and endpoints
- Deployment operations
- Project/artifact management
"""

import logging
from typing import Any, Dict, List, Optional

import httpx

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class HyperionKitClient:
    """
    Client for hyperionkit npm package

    Concept: HyperAgent calls hyperionkit functions via HTTP bridge
    Logic: Node.js service exposes hyperionkit functions as HTTP endpoints
    Benefits: Single source of truth, no duplication, always in sync

    Note: This client includes fallback to hardcoded configs if hyperionkit
    is unavailable, ensuring backward compatibility.
    """

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize HyperionKit client

        Args:
            base_url: Base URL for hyperionkit bridge service
                     If None, uses HYPERIONKIT_BRIDGE_URL from settings
                     or defaults to http://localhost:3001
        """
        self.base_url = base_url or getattr(
            settings, "hyperionkit_bridge_url", "http://localhost:3001"
        )
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)
        self._cache: Dict[str, Any] = {}
        self._available = True  # Assume available until proven otherwise

    async def get_network_config(self, network: str) -> Dict[str, Any]:
        """
        Get network configuration from hyperionkit

        Replaces hardcoded NETWORK_FEATURES dict

        Args:
            network: Network name (e.g., "hyperion_testnet")

        Returns:
            Network configuration dictionary with features, chain_id, rpc_url, etc.

        Falls back to hardcoded configs if hyperionkit unavailable
        """
        cache_key = f"network_config:{network}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        if not self._available:
            # Already determined unavailable, use fallback
            return self._get_fallback_config(network)

        try:
            response = await self.client.get(f"/api/networks/{network}/config")
            response.raise_for_status()
            config = response.json()
            self._cache[cache_key] = config
            logger.info(f"Loaded network config from hyperionkit: {network}")
            return config
        except Exception as e:
            logger.warning(f"Failed to get network config from hyperionkit: {e} - using fallback")
            self._available = False
            return self._get_fallback_config(network)

    def _get_fallback_config(self, network: str) -> Dict[str, Any]:
        """Get network config from hardcoded fallback"""
        from hyperagent.blockchain.network_features import NetworkFeatureManager

        return NetworkFeatureManager.get_network_config(network)

    async def get_supported_networks(self) -> List[str]:
        """
        Get list of supported networks from hyperionkit

        Returns:
            List of network names

        Falls back to hardcoded list if hyperionkit unavailable
        """
        if not self._available:
            from hyperagent.blockchain.network_features import NetworkFeatureManager

            return NetworkFeatureManager.list_networks()

        try:
            response = await self.client.get("/api/networks")
            response.raise_for_status()
            networks = response.json()
            logger.info(f"Loaded {len(networks)} networks from hyperionkit")
            return networks
        except Exception as e:
            logger.warning(f"Failed to get networks from hyperionkit: {e} - using fallback")
            self._available = False
            from hyperagent.blockchain.network_features import NetworkFeatureManager

            return NetworkFeatureManager.list_networks()

    async def deploy_contract(
        self,
        network: str,
        bytecode: str,
        abi: list,
        constructor_args: list,
        wallet_address: str,
        use_gasless: bool = False,
    ) -> Dict[str, Any]:
        """
        Deploy contract using hyperionkit deployment functions

        Replaces raw Web3.py deployment logic

        Args:
            network: Target network name
            bytecode: Compiled contract bytecode
            abi: Contract ABI
            constructor_args: Constructor arguments
            wallet_address: User wallet address
            use_gasless: Whether to use gasless deployment

        Returns:
            Deployment result with contract_address, tx_hash, etc.

        Raises:
            Exception if deployment fails
        """
        try:
            response = await self.client.post(
                "/api/deploy",
                json={
                    "network": network,
                    "bytecode": bytecode,
                    "abi": abi,
                    "constructor_args": constructor_args,
                    "wallet_address": wallet_address,
                    "use_gasless": use_gasless,
                },
                timeout=300.0,  # Deployment can take time
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"Deployed contract via hyperionkit: {result.get('contract_address')}")
            return result
        except Exception as e:
            logger.error(f"Failed to deploy via hyperionkit: {e}")
            raise

    async def create_project(self, name: str, network: str, contract_type: str) -> Dict[str, Any]:
        """
        Create project using hyperionkit project management

        HyperAgent orchestrates, hyperionkit manages project state

        Args:
            name: Project name
            network: Target network
            contract_type: Contract type (ERC20, ERC721, etc.)

        Returns:
            Project creation result with project_id, etc.
        """
        try:
            response = await self.client.post(
                "/api/projects",
                json={"name": name, "network": network, "contract_type": contract_type},
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"Created project via hyperionkit: {result.get('project_id')}")
            return result
        except Exception as e:
            logger.error(f"Failed to create project via hyperionkit: {e}")
            raise

    async def get_project_artifacts(self, project_id: str) -> Dict[str, Any]:
        """
        Get generated artifacts from hyperionkit

        Args:
            project_id: Project ID

        Returns:
            Project artifacts (contracts, deployments, etc.)
        """
        try:
            response = await self.client.get(f"/api/projects/{project_id}/artifacts")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get artifacts from hyperionkit: {e}")
            raise

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

    def is_available(self) -> bool:
        """Check if hyperionkit service is available"""
        return self._available
