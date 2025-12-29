"""
Gas estimation service for smart contract deployments

Provides accurate gas estimation for contract deployments and function calls
"""

import logging
from typing import Dict, Any, Optional, List
from web3 import Web3
try:
    from web3.exceptions import ContractLogicError, Web3ValidationError as ValidationError
except ImportError:
    from web3.exceptions import ContractLogicError, ValidationError

from hyperagent.blockchain.networks import NetworkManager

logger = logging.getLogger(__name__)


class GasEstimator:
    """
    Gas estimation service
    
    Provides async gas estimation for:
    - Contract deployments
    - Function calls
    - Batch operations
    """

    def __init__(self, network_manager: Optional[NetworkManager] = None):
        self.network_manager = network_manager or NetworkManager()

    async def estimate_deployment_gas(
        self,
        bytecode: str,
        network: str,
        constructor_args: Optional[List[Any]] = None,
        deployer_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Estimate gas for contract deployment
        
        Args:
            bytecode: Contract bytecode (hex string)
            network: Target network
            constructor_args: Constructor arguments (if any)
            deployer_address: Address that will deploy (for nonce/gas price)
        
        Returns:
            {
                "gas_estimate": int,
                "gas_price": int (in wei),
                "total_cost_wei": int,
                "total_cost_eth": float,
                "confidence": str ("high", "medium", "low")
            }
        """
        try:
            w3 = self.network_manager.get_web3(network)
            
            # Get deployer address or use zero address for estimation
            if not deployer_address:
                deployer_address = "0x0000000000000000000000000000000000000000"
            
            # Prepare transaction
            transaction = {
                "from": deployer_address,
                "data": bytecode,
            }
            
            # Add constructor arguments if provided
            if constructor_args:
                from web3 import Web3 as W3
                # Encode constructor arguments
                # This is simplified - in production, you'd use the ABI
                constructor_data = self._encode_constructor_args(constructor_args)
                transaction["data"] = bytecode + constructor_data
            
            # Estimate gas
            try:
                gas_estimate = w3.eth.estimate_gas(transaction)
            except ContractLogicError as e:
                logger.warning(f"Contract logic error during gas estimation: {e}")
                # Return safe default for deployment
                gas_estimate = 3000000
                confidence = "low"
            except ValidationError as e:
                logger.warning(f"Validation error during gas estimation: {e}")
                gas_estimate = 3000000
                confidence = "low"
            except Exception as e:
                logger.warning(f"Error estimating gas: {e}")
                # Use safe default
                gas_estimate = 3000000
                confidence = "low"
            else:
                # Add 20% buffer for safety
                gas_estimate = int(gas_estimate * 1.2)
                confidence = "high"
            
            # Get current gas price
            try:
                gas_price = w3.eth.gas_price
            except Exception as e:
                logger.warning(f"Error getting gas price: {e}")
                # Use default gas price (20 gwei)
                gas_price = Web3.to_wei(20, "gwei")
            
            total_cost_wei = gas_estimate * gas_price
            total_cost_eth = Web3.from_wei(total_cost_wei, "ether")
            
            return {
                "gas_estimate": gas_estimate,
                "gas_price": gas_price,
                "total_cost_wei": total_cost_wei,
                "total_cost_eth": float(total_cost_eth),
                "confidence": confidence,
            }
            
        except Exception as e:
            logger.error(f"Failed to estimate deployment gas: {e}", exc_info=True)
            # Return safe default
            return {
                "gas_estimate": 3000000,
                "gas_price": Web3.to_wei(20, "gwei"),
                "total_cost_wei": Web3.to_wei(60, "ether"),  # 3M * 20 gwei
                "total_cost_eth": 60.0,
                "confidence": "low",
            }

    async def estimate_function_call_gas(
        self,
        contract_address: str,
        function_abi: Dict[str, Any],
        function_args: List[Any],
        network: str,
        caller_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Estimate gas for contract function call
        
        Args:
            contract_address: Contract address
            function_abi: Function ABI
            function_args: Function arguments
            network: Target network
            caller_address: Address that will call (for nonce/gas price)
        
        Returns:
            {
                "gas_estimate": int,
                "gas_price": int,
                "total_cost_wei": int,
                "total_cost_eth": float,
                "confidence": str
            }
        """
        try:
            w3 = self.network_manager.get_web3(network)
            
            if not caller_address:
                caller_address = "0x0000000000000000000000000000000000000000"
            
            # Create contract instance
            contract = w3.eth.contract(address=contract_address, abi=[function_abi])
            
            # Get function
            function_name = function_abi.get("name")
            if not function_name:
                raise ValueError("Function ABI must include 'name' field")
            
            func = contract.functions[function_name]
            
            # Build transaction
            transaction = func(*function_args).build_transaction({
                "from": caller_address,
            })
            
            # Estimate gas
            try:
                gas_estimate = w3.eth.estimate_gas(transaction)
                confidence = "high"
            except ContractLogicError as e:
                logger.warning(f"Contract logic error: {e}")
                gas_estimate = 100000  # Default for function calls
                confidence = "low"
            except Exception as e:
                logger.warning(f"Error estimating gas: {e}")
                gas_estimate = 100000
                confidence = "low"
            
            # Add 10% buffer for function calls
            gas_estimate = int(gas_estimate * 1.1)
            
            # Get gas price
            try:
                gas_price = w3.eth.gas_price
            except Exception:
                gas_price = Web3.to_wei(20, "gwei")
            
            total_cost_wei = gas_estimate * gas_price
            total_cost_eth = Web3.from_wei(total_cost_wei, "ether")
            
            return {
                "gas_estimate": gas_estimate,
                "gas_price": gas_price,
                "total_cost_wei": total_cost_wei,
                "total_cost_eth": float(total_cost_eth),
                "confidence": confidence,
            }
            
        except Exception as e:
            logger.error(f"Failed to estimate function call gas: {e}", exc_info=True)
            return {
                "gas_estimate": 100000,
                "gas_price": Web3.to_wei(20, "gwei"),
                "total_cost_wei": Web3.to_wei(0.002, "ether"),
                "total_cost_eth": 0.002,
                "confidence": "low",
            }

    def _encode_constructor_args(self, args: List[Any]) -> str:
        """
        Encode constructor arguments
        
        Note: This is a simplified implementation.
        In production, you should use the contract ABI to properly encode arguments.
        """
        from eth_abi import encode
        from eth_utils import to_hex
        
        # This is a placeholder - proper implementation would use ABI
        # For now, return empty string (constructor args should be handled by caller)
        return ""

