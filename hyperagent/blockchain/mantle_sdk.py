"""Mantle SDK integration wrapper for Mantle network deployments"""

import logging
from typing import Any, Dict, List, Optional

import httpx

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class MantleSDKClient:
    """Mantle SDK client wrapper for Mantle network deployments

    Uses HTTP bridge to TypeScript Mantle SDK service for cross-chain operations.
    Falls back to Web3.py via NetworkManager for direct L2 deployments.
    """

    def __init__(self, network: str = "mantle_testnet"):
        """Initialize Mantle SDK client

        Args:
            network: Target Mantle network (mantle_testnet or mantle_mainnet)
        """
        self.network = network
        self.bridge_service_url = getattr(
            settings, "mantle_bridge_service_url", "http://localhost:3002"
        )
        self.bridge_available = False

        # Check if bridge service is available
        try:
            import httpx

            # Will be checked on first use
            self.bridge_available = True
        except ImportError:
            logger.warning("httpx not available. Mantle bridge service will not be used.")

        if not self.bridge_available:
            logger.info(
                f"Mantle bridge service not available for {network}. Using Web3.py via NetworkManager."
            )

    async def _check_bridge_service(self) -> bool:
        """Check if Mantle bridge service is available"""
        if not self.bridge_available:
            return False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.bridge_service_url}/health", timeout=2.0)
                return response.status_code == 200
        except Exception:
            return False

    def is_available(self) -> bool:
        """Check if Mantle SDK bridge is available"""
        return self.bridge_available

    async def deploy_with_cross_chain(
        self,
        bytecode: str,
        abi: List[Dict],
        constructor_args: Optional[List[Any]] = None,
        l1_private_key: Optional[str] = None,
        l2_private_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Deploy contract with cross-chain support (L1→L2)

        Args:
            bytecode: Contract bytecode
            abi: Contract ABI
            constructor_args: Optional constructor arguments
            l1_private_key: L1 private key (for server-side deployment)
            l2_private_key: L2 private key (for server-side deployment)

        Returns:
            Deployment result with L1 contract address, tx hash, etc.
        """
        if await self._check_bridge_service() and l1_private_key and l2_private_key:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.bridge_service_url}/deploy-with-cross-chain",
                        json={
                            "bytecode": bytecode,
                            "abi": abi,
                            "constructorArgs": constructor_args or [],
                            "l1PrivateKey": l1_private_key,
                            "l2PrivateKey": l2_private_key,
                        },
                        timeout=60.0,
                    )
                    if response.status_code == 200:
                        return response.json()
            except Exception as e:
                logger.warning(
                    f"Mantle bridge service error: {e}. Falling back to direct L2 deployment."
                )

        raise ValueError("Cross-chain deployment requires Mantle bridge service and private keys")

    async def deposit_erc20(
        self, l1_token_address: str, l2_token_address: str, amount: str, private_key: str
    ) -> Dict[str, Any]:
        """Deposit ERC20 tokens from L1 to L2

        Args:
            l1_token_address: L1 token contract address
            l2_token_address: L2 token contract address
            amount: Amount to deposit (in ether units)
            private_key: Private key for signing

        Returns:
            Transaction hashes and status
        """
        if await self._check_bridge_service():
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.bridge_service_url}/deposit-erc20",
                        json={
                            "l1TokenAddress": l1_token_address,
                            "l2TokenAddress": l2_token_address,
                            "amount": amount,
                            "privateKey": private_key,
                        },
                        timeout=120.0,
                    )
                    if response.status_code == 200:
                        return response.json()
            except Exception as e:
                logger.error(f"Mantle bridge service error: {e}")
                raise

        raise ValueError("ERC20 deposit requires Mantle bridge service")

    async def withdraw_erc20(
        self, l1_token_address: str, l2_token_address: str, amount: str, private_key: str
    ) -> Dict[str, Any]:
        """Withdraw ERC20 tokens from L2 to L1

        Args:
            l1_token_address: L1 token contract address
            l2_token_address: L2 token contract address
            amount: Amount to withdraw (in ether units)
            private_key: Private key for signing

        Returns:
            Transaction hash and status
        """
        if await self._check_bridge_service():
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.bridge_service_url}/withdraw-erc20",
                        json={
                            "l1TokenAddress": l1_token_address,
                            "l2TokenAddress": l2_token_address,
                            "amount": amount,
                            "privateKey": private_key,
                        },
                        timeout=120.0,
                    )
                    if response.status_code == 200:
                        return response.json()
            except Exception as e:
                logger.error(f"Mantle bridge service error: {e}")
                raise

        raise ValueError("ERC20 withdrawal requires Mantle bridge service")

    async def wait_for_message_status(
        self, tx_hash: str, target_status: str = "RELAYED"
    ) -> Dict[str, Any]:
        """Wait for cross-chain message to reach target status

        Args:
            tx_hash: Transaction hash
            target_status: Target status (RELAYED, READY_TO_PROVE, etc.)

        Returns:
            Status information
        """
        if await self._check_bridge_service():
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.bridge_service_url}/wait-for-message-status",
                        json={"txHash": tx_hash, "targetStatus": target_status},
                        timeout=300.0,
                    )
                    if response.status_code == 200:
                        return response.json()
            except Exception as e:
                logger.error(f"Mantle bridge service error: {e}")
                raise

        raise ValueError("Message status check requires Mantle bridge service")

    async def estimate_gas(self, from_address: str, to_address: str, data: str) -> Dict[str, Any]:
        """Estimate gas for L2 transaction

        Args:
            from_address: Sender address
            to_address: Recipient address
            data: Transaction data (hex string)

        Returns:
            Gas estimation results
        """
        if await self._check_bridge_service():
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.bridge_service_url}/estimate-gas",
                        json={"from": from_address, "to": to_address, "data": data},
                        timeout=10.0,
                    )
                    if response.status_code == 200:
                        return response.json()
            except Exception as e:
                logger.warning(f"Mantle bridge service error: {e}. Using Web3.py fallback.")

        # Fallback to Web3.py
        from hyperagent.blockchain.networks import NetworkManager

        network_manager = NetworkManager()
        web3 = network_manager.get_web3(self.network)

        tx = {"from": from_address, "to": to_address, "data": data}
        estimated_gas = web3.eth.estimate_gas(tx)
        gas_price = web3.eth.gas_price

        return {
            "estimatedGas": str(estimated_gas),
            "gasPrice": str(gas_price),
            "totalCost": str(estimated_gas * gas_price),
            "method": "Web3.py fallback",
        }

    async def deploy_contract(
        self,
        bytecode: str,
        abi: List[Dict],
        wallet_address: str,
        constructor_args: Optional[List[Any]] = None,
        network_manager: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Deploy contract directly on L2 (no cross-chain)

        Uses Web3.py via NetworkManager for direct L2 deployment.

        Args:
            bytecode: Contract bytecode
            abi: Contract ABI
            wallet_address: Deployer wallet address
            constructor_args: Optional constructor arguments
            network_manager: NetworkManager instance for Web3.py

        Returns:
            Deployment result with transaction details
        """
        if not network_manager:
            from hyperagent.blockchain.networks import NetworkManager

            network_manager = NetworkManager()

        web3 = network_manager.get_web3(self.network)

        contract = web3.eth.contract(abi=abi, bytecode=bytecode)
        constructor = contract.constructor(*constructor_args or [])
        tx = constructor.build_transaction(
            {
                "from": wallet_address,
                "nonce": web3.eth.get_transaction_count(wallet_address),
                "gas": 0,
                "gasPrice": web3.eth.gas_price,
            }
        )

        tx["gas"] = web3.eth.estimate_gas(tx)

        return {
            "network": self.network,
            "transaction": tx,
            "bytecode": bytecode,
            "abi": abi,
            "requires_signing": True,
        }

    def get_network_info(self) -> Dict[str, Any]:
        """Get Mantle network information"""
        return {
            "network": self.network,
            "bridge_available": self.bridge_available,
            "bridge_service_url": self.bridge_service_url,
            "chain_id": 5003 if "testnet" in self.network else 5000,
            "deployment_method": "Mantle Bridge Service (HTTP) or Web3.py fallback",
        }
