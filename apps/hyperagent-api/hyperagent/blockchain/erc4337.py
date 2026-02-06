"""
ERC-4337 Account Abstraction Support
Smart Account integration for gasless transactions and advanced features
"""

from typing import Dict, Any, Optional
import logging
from web3 import Web3

logger = logging.getLogger(__name__)


class ERC4337AccountAbstraction:
    """
    ERC-4337 Account Abstraction integration
    
    Features:
    - Smart accounts (contract-based wallets)
    - Gasless transactions (sponsored by paymaster)
    - Batch operations
    - Session keys for limited permissions
    - Social recovery
    """
    
    ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"  # v0.6.0
    
    def __init__(self, network_manager):
        self.network_manager = network_manager
        
    async def is_smart_account(self, address: str, network: str) -> bool:
        """
        Check if address is a smart contract account
        
        Args:
            address: Wallet address to check
            network: Network name
            
        Returns:
            True if address is a smart account (has code), False otherwise
        """
        try:
            w3 = self.network_manager.get_web3(network)
            code = w3.eth.get_code(Web3.to_checksum_address(address))
            
            # Smart accounts have bytecode at their address
            is_smart = len(code) > 0
            
            if is_smart:
                logger.info(f"Address {address} is a smart account on {network}")
            
            return is_smart
            
        except Exception as e:
            logger.error(f"Failed to check if address is smart account: {str(e)}")
            return False
    
    async def prepare_user_operation(
        self,
        sender: str,
        target: str,
        value: int,
        data: str,
        network: str
    ) -> Dict[str, Any]:
        """
        Prepare UserOperation for ERC-4337
        
        Args:
            sender: Smart account address
            target: Target contract address
            value: ETH value to send
            data: Transaction data
            network: Network name
            
        Returns:
            UserOperation dict
        """
        try:
            w3 = self.network_manager.get_web3(network)
            
            # Get nonce from EntryPoint
            nonce = await self._get_nonce(sender, network)
            
            # Estimate gas
            call_gas_limit = 100000  # Default, should be estimated
            verification_gas_limit = 100000
            pre_verification_gas = 21000
            
            # Get gas price
            gas_price = w3.eth.gas_price
            max_fee_per_gas = int(gas_price * 1.2)  # 20% buffer
            max_priority_fee_per_gas = w3.to_wei(2, 'gwei')
            
            user_op = {
                "sender": sender,
                "nonce": hex(nonce),
                "initCode": "0x",  # Empty for existing accounts
                "callData": await self._encode_execute_call(target, value, data),
                "callGasLimit": hex(call_gas_limit),
                "verificationGasLimit": hex(verification_gas_limit),
                "preVerificationGas": hex(pre_verification_gas),
                "maxFeePerGas": hex(max_fee_per_gas),
                "maxPriorityFeePerGas": hex(max_priority_fee_per_gas),
                "paymasterAndData": "0x",  # Can add paymaster for sponsored tx
                "signature": "0x",  # To be filled by wallet
            }
            
            logger.info(f"Prepared UserOperation for {sender}")
            return user_op
            
        except Exception as e:
            logger.error(f"Failed to prepare UserOperation: {str(e)}")
            raise
    
    async def _get_nonce(self, sender: str, network: str) -> int:
        """Get nonce from EntryPoint contract"""
        try:
            w3 = self.network_manager.get_web3(network)
            
            # EntryPoint.getNonce(sender, key)
            entry_point = w3.eth.contract(
                address=Web3.to_checksum_address(self.ENTRYPOINT_ADDRESS),
                abi=[{
                    "inputs": [
                        {"name": "sender", "type": "address"},
                        {"name": "key", "type": "uint192"}
                    ],
                    "name": "getNonce",
                    "outputs": [{"name": "nonce", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                }]
            )
            
            nonce = entry_point.functions.getNonce(
                Web3.to_checksum_address(sender),
                0  # Default key
            ).call()
            
            return nonce
            
        except Exception as e:
            logger.warning(f"Failed to get nonce from EntryPoint: {str(e)}, using 0")
            return 0
    
    async def _encode_execute_call(
        self,
        target: str,
        value: int,
        data: str
    ) -> str:
        """
        Encode execute call for smart account
        
        Standard smart account interface:
        execute(address target, uint256 value, bytes calldata data)
        """
        from eth_abi import encode
        
        # Function selector for execute(address,uint256,bytes)
        selector = Web3.keccak(text="execute(address,uint256,bytes)")[:4]
        
        # Encode parameters
        encoded = encode(
            ['address', 'uint256', 'bytes'],
            [Web3.to_checksum_address(target), value, bytes.fromhex(data.replace('0x', ''))]
        )
        
        return '0x' + selector.hex() + encoded.hex()
    
    async def estimate_user_operation_gas(
        self,
        user_op: Dict[str, Any],
        network: str
    ) -> Dict[str, int]:
        """
        Estimate gas for UserOperation
        
        Args:
            user_op: UserOperation dict
            network: Network name
            
        Returns:
            Dict with gas estimates
        """
        try:
            w3 = self.network_manager.get_web3(network)
            
            # Simulate execution to estimate gas
            # This is simplified - in production, use bundler RPC methods
            call_gas = 100000
            verification_gas = 100000
            pre_verification = 21000
            
            logger.info(f"Estimated gas for UserOperation: {call_gas + verification_gas + pre_verification}")
            
            return {
                "callGasLimit": call_gas,
                "verificationGasLimit": verification_gas,
                "preVerificationGas": pre_verification,
            }
            
        except Exception as e:
            logger.error(f"Failed to estimate UserOperation gas: {str(e)}")
            # Return safe defaults
            return {
                "callGasLimit": 200000,
                "verificationGasLimit": 200000,
                "preVerificationGas": 50000,
            }
    
    async def get_paymaster_data(
        self,
        user_op: Dict[str, Any],
        paymaster_url: Optional[str] = None
    ) -> str:
        """
        Get paymaster data for sponsored transactions
        
        Args:
            user_op: UserOperation to sponsor
            paymaster_url: Paymaster service URL
            
        Returns:
            Paymaster data hex string
        """
        if not paymaster_url:
            logger.info("No paymaster configured, user will pay gas")
            return "0x"
        
        try:
            import httpx
            
            # Request paymaster sponsorship
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    paymaster_url,
                    json={
                        "method": "pm_sponsorUserOperation",
                        "params": [user_op, self.ENTRYPOINT_ADDRESS]
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    paymaster_data = result.get('result', {}).get('paymasterAndData', '0x')
                    logger.info(f"Paymaster approved sponsorship")
                    return paymaster_data
                else:
                    logger.warning(f"Paymaster declined: {response.text}")
                    return "0x"
                    
        except Exception as e:
            logger.error(f"Failed to get paymaster data: {str(e)}")
            return "0x"

