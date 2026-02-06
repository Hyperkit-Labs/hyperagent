"""
Block explorer contract verification

Supports verification on:
- Etherscan (Ethereum, Polygon, Avalanche, etc.)
- Blockscout (various networks)
- Custom explorers
"""

import logging
import os
from typing import Dict, Any, Optional
import httpx

from hyperagent.blockchain.networks import NetworkManager

logger = logging.getLogger(__name__)


class ContractVerifier:
    """
    Contract verification service for block explorers
    
    Supports multiple explorers:
    - Etherscan API (Ethereum, Polygon, Avalanche, BSC, etc.)
    - Blockscout API
    - Custom explorers
    """

    def __init__(self, network_manager: Optional[NetworkManager] = None):
        self.network_manager = network_manager or NetworkManager()
        
        # API keys from environment
        self.etherscan_api_key = os.getenv("ETHERSCAN_API_KEY", "")
        self.polygonscan_api_key = os.getenv("POLYGONSCAN_API_KEY", "")
        self.avalanche_api_key = os.getenv("AVALANCHE_API_KEY", "")
        self.bscscan_api_key = os.getenv("BSCSCAN_API_KEY", "")
        self.blockscout_api_key = os.getenv("BLOCKSCOUT_API_KEY", "")

    def get_explorer_api_url(self, network: str) -> Optional[str]:
        """
        Get explorer API URL for network
        
        Returns:
            API URL or None if not supported
        """
        explorer_urls = {
            "ethereum_mainnet": "https://api.etherscan.io/api",
            "ethereum_sepolia": "https://api-sepolia.etherscan.io/api",
            "polygon_mainnet": "https://api.polygonscan.com/api",
            "polygon_mumbai": "https://api-testnet.polygonscan.com/api",
            "avalanche_mainnet": "https://api.snowtrace.io/api",
            "avalanche_fuji": "https://api-testnet.snowtrace.io/api",
            "bsc_mainnet": "https://api.bscscan.com/api",
            "bsc_testnet": "https://api-testnet.bscscan.com/api",
            "mantle_mainnet": "https://explorer.mantle.xyz/api",
            "mantle_testnet": "https://explorer.testnet.mantle.xyz/api",
        }
        
        return explorer_urls.get(network)

    def get_api_key(self, network: str) -> Optional[str]:
        """Get API key for network"""
        if "ethereum" in network:
            return self.etherscan_api_key
        elif "polygon" in network:
            return self.polygonscan_api_key
        elif "avalanche" in network:
            return self.avalanche_api_key
        elif "bsc" in network or "binance" in network:
            return self.bscscan_api_key
        elif "blockscout" in network or "mantle" in network:
            return self.blockscout_api_key
        return None

    async def verify_contract(
        self,
        contract_address: str,
        source_code: str,
        contract_name: str,
        compiler_version: str,
        network: str,
        constructor_args: Optional[str] = None,
        optimization_enabled: bool = False,
        optimization_runs: int = 200,
    ) -> Dict[str, Any]:
        """
        Verify contract on block explorer
        
        Args:
            contract_address: Contract address
            source_code: Solidity source code
            contract_name: Contract name
            compiler_version: Solidity compiler version (e.g., "0.8.24")
            network: Network name
            constructor_args: Encoded constructor arguments (hex string)
            optimization_enabled: Whether optimization was enabled
            optimization_runs: Number of optimization runs
        
        Returns:
            {
                "success": bool,
                "guid": str (for Etherscan),
                "message": str,
                "explorer_url": str
            }
        """
        api_url = self.get_explorer_api_url(network)
        if not api_url:
            return {
                "success": False,
                "message": f"Contract verification not supported for network: {network}",
            }
        
        api_key = self.get_api_key(network)
        if not api_key:
            logger.warning(f"No API key configured for {network}")
            return {
                "success": False,
                "message": f"API key not configured for {network}. Set ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, etc.",
            }
        
        # Prepare verification request
        # Format depends on explorer type
        if "etherscan" in api_url or "snowtrace" in api_url or "bscscan" in api_url:
            return await self._verify_etherscan(
                api_url=api_url,
                api_key=api_key,
                contract_address=contract_address,
                source_code=source_code,
                contract_name=contract_name,
                compiler_version=compiler_version,
                constructor_args=constructor_args,
                optimization_enabled=optimization_enabled,
                optimization_runs=optimization_runs,
            )
        elif "blockscout" in api_url or "mantle" in api_url:
            return await self._verify_blockscout(
                api_url=api_url,
                api_key=api_key,
                contract_address=contract_address,
                source_code=source_code,
                contract_name=contract_name,
                compiler_version=compiler_version,
                constructor_args=constructor_args,
                optimization_enabled=optimization_enabled,
                optimization_runs=optimization_runs,
            )
        else:
            return {
                "success": False,
                "message": f"Unsupported explorer type for {network}",
            }

    async def _verify_etherscan(
        self,
        api_url: str,
        api_key: str,
        contract_address: str,
        source_code: str,
        contract_name: str,
        compiler_version: str,
        constructor_args: Optional[str],
        optimization_enabled: bool,
        optimization_runs: int,
    ) -> Dict[str, Any]:
        """Verify contract on Etherscan-compatible API"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Submit verification
                data = {
                    "apikey": api_key,
                    "module": "contract",
                    "action": "verifysourcecode",
                    "address": contract_address,
                    "codeformat": "solidity-single-file",
                    "contractname": contract_name,
                    "compilerversion": f"v{compiler_version}",
                    "optimizationUsed": "1" if optimization_enabled else "0",
                    "runs": str(optimization_runs),
                    "sourceCode": source_code,
                }
                
                if constructor_args:
                    data["constructorArguements"] = constructor_args
                
                response = await client.post(api_url, data=data)
                response.raise_for_status()
                result = response.json()
                
                if result.get("status") == "1" and result.get("message") == "OK":
                    guid = result.get("result")
                    return {
                        "success": True,
                        "guid": guid,
                        "message": "Verification submitted successfully. Check status with get_verification_status().",
                        "explorer_url": f"{api_url.replace('/api', '')}/address/{contract_address}#code",
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "Verification failed"),
                    }
        except Exception as e:
            logger.error(f"Failed to verify contract on Etherscan: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"Verification error: {str(e)}",
            }

    async def _verify_blockscout(
        self,
        api_url: str,
        api_key: str,
        contract_address: str,
        source_code: str,
        contract_name: str,
        compiler_version: str,
        constructor_args: Optional[str],
        optimization_enabled: bool,
        optimization_runs: int,
    ) -> Dict[str, Any]:
        """Verify contract on Blockscout-compatible API"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                data = {
                    "addressHash": contract_address,
                    "name": contract_name,
                    "compilerVersion": compiler_version,
                    "optimization": optimization_enabled,
                    "optimizationRuns": optimization_runs,
                    "sourceCode": source_code,
                }
                
                if constructor_args:
                    data["constructorArguments"] = constructor_args
                
                headers = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                
                response = await client.post(
                    f"{api_url}/contracts/verify",
                    json=data,
                    headers=headers
                )
                response.raise_for_status()
                result = response.json()
                
                return {
                    "success": True,
                    "message": "Verification submitted successfully",
                    "explorer_url": f"{api_url.replace('/api', '')}/address/{contract_address}",
                }
        except Exception as e:
            logger.error(f"Failed to verify contract on Blockscout: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"Verification error: {str(e)}",
            }

    async def get_verification_status(
        self,
        guid: str,
        network: str,
    ) -> Dict[str, Any]:
        """
        Check verification status (Etherscan only)
        
        Args:
            guid: Verification GUID from verify_contract()
            network: Network name
        
        Returns:
            {
                "status": str ("pending", "success", "failed"),
                "message": str
            }
        """
        api_url = self.get_explorer_api_url(network)
        api_key = self.get_api_key(network)
        
        if not api_url or "etherscan" not in api_url:
            return {
                "status": "unsupported",
                "message": "Status checking only supported for Etherscan-compatible explorers",
            }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    api_url,
                    params={
                        "apikey": api_key,
                        "module": "contract",
                        "action": "checkverifystatus",
                        "guid": guid,
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                if result.get("status") == "1":
                    if "already verified" in result.get("result", "").lower():
                        return {"status": "success", "message": "Contract already verified"}
                    return {"status": "pending", "message": result.get("result", "Verification in progress")}
                else:
                    return {"status": "failed", "message": result.get("result", "Verification failed")}
        except Exception as e:
            logger.error(f"Failed to check verification status: {e}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error checking status: {str(e)}",
            }

