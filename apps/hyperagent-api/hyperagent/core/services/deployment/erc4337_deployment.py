"""ERC-4337 deployment helper for user-signed deployments with paymaster"""

import logging
from typing import Any, Dict, List, Optional

import httpx
from web3 import Web3

from hyperagent.blockchain.erc4337 import ERC4337AccountAbstraction
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class ERC4337DeploymentHelper:
    """
    ERC-4337 user-signed deployment with paymaster sponsorship
    
    Flow:
    1. Prepare UserOperation for deployment
    2. Request paymaster sponsorship from TypeScript service
    3. Return UserOp to frontend for user to sign
    4. Submit signed UserOp to EntryPoint
    5. Wait for confirmation
    """
    
    def __init__(
        self,
        network_manager: NetworkManager,
        paymaster_service_url: Optional[str] = None
    ):
        self.network_manager = network_manager
        self.paymaster_service_url = paymaster_service_url or settings.x402_paymaster_service_url
        self.erc4337 = ERC4337AccountAbstraction(network_manager)
        
    async def prepare_deployment_user_operation(
        self,
        user_smart_account: str,
        compiled_contract: Dict[str, Any],
        network: str
    ) -> Dict[str, Any]:
        """
        Prepare UserOperation for contract deployment
        
        Args:
            user_smart_account: User's Smart Account address
            compiled_contract: Compiled contract (bytecode, abi, etc.)
            network: Target network
            
        Returns:
            {
                "userOp": UserOperation dict ready for signing,
                "paymasterData": Paymaster sponsorship info,
                "estimatedGas": Gas estimate
            }
        """
        logger.info(f"Preparing UserOperation for Smart Account {user_smart_account} on {network}")
        
        # 1. Encode deployment as callData
        deployment_call_data = self._encode_deployment_call(
            compiled_contract["bytecode"],
            compiled_contract.get("constructor_args", [])
        )
        
        # 2. Prepare base UserOperation
        user_op = await self.erc4337.prepare_user_operation(
            sender=user_smart_account,
            target="0x0000000000000000000000000000000000000000",  # Contract creation
            value=0,
            data=deployment_call_data,
            network=network
        )
        
        # 3. Request paymaster sponsorship from TypeScript service
        paymaster_data = await self._request_paymaster_sponsorship(
            user_op, network
        )
        
        # 4. Inject paymasterAndData into UserOp
        user_op["paymasterAndData"] = paymaster_data["paymasterAndData"]
        
        # 5. Estimate total gas
        estimated_gas = self._estimate_total_gas(user_op)
        
        logger.info(f"UserOperation prepared with paymaster sponsorship. Estimated gas: {estimated_gas}")
        
        return {
            "userOp": user_op,
            "paymasterData": paymaster_data,
            "estimatedGas": estimated_gas
        }
    
    def _encode_deployment_call(
        self,
        bytecode: str,
        constructor_args: List[Any]
    ) -> str:
        """
        Encode contract deployment as callData
        
        For Smart Account deployments, the callData is the bytecode
        plus encoded constructor arguments.
        """
        # Remove 0x prefix if present
        if bytecode.startswith("0x"):
            bytecode = bytecode[2:]
        
        # For now, assume no constructor args (will enhance later)
        if constructor_args:
            logger.warning("Constructor args not yet supported in ERC-4337 deployment")
        
        return f"0x{bytecode}"
    
    async def _request_paymaster_sponsorship(
        self,
        user_op: Dict[str, Any],
        network: str
    ) -> Dict[str, Any]:
        """
        Call TypeScript paymaster service for gas sponsorship
        
        Returns:
            {
                "paymasterAndData": "0x...",
                "paymaster": "0x...",
                "sponsor": "hyperagent"
            }
        """
        if not self.paymaster_service_url:
            raise ValueError("Paymaster service URL not configured")
        
        logger.info(f"Requesting paymaster sponsorship from {self.paymaster_service_url}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.paymaster_service_url}/sponsor-deployment",
                    json={
                        "userOp": user_op,
                        "network": network
                    }
                )
                
                if response.status_code != 200:
                    error_data = response.json() if response.headers.get("content-type") == "application/json" else response.text
                    raise RuntimeError(f"Paymaster service error: {error_data}")
                
                paymaster_data = response.json()
                logger.info(f"Paymaster sponsorship received: {paymaster_data.get('paymaster', 'unknown')}")
                
                return paymaster_data
                
        except httpx.RequestError as e:
            logger.error(f"Failed to connect to paymaster service: {e}")
            raise RuntimeError(f"Paymaster service unavailable: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error requesting paymaster sponsorship: {e}")
            raise
    
    def _estimate_total_gas(self, user_op: Dict[str, Any]) -> str:
        """
        Estimate total gas for UserOperation
        
        Total gas = callGasLimit + verificationGasLimit + preVerificationGas
        """
        call_gas = int(user_op.get("callGasLimit", "0x0"), 16)
        verification_gas = int(user_op.get("verificationGasLimit", "0x0"), 16)
        pre_verification_gas = int(user_op.get("preVerificationGas", "0x0"), 16)
        
        total_gas = call_gas + verification_gas + pre_verification_gas
        return str(total_gas)
    
    async def submit_signed_user_operation(
        self,
        signed_user_op: Dict[str, Any],
        network: str
    ) -> Dict[str, Any]:
        """
        Submit user-signed UserOperation to EntryPoint
        
        Args:
            signed_user_op: UserOperation with user's signature
            network: Target network
            
        Returns:
            {
                "transaction_hash": "0x...",
                "contract_address": "0x...",
                "block_number": 12345,
                "gas_used": 1500000
            }
        """
        logger.info(f"Submitting signed UserOperation to EntryPoint on {network}")
        
        w3 = self.network_manager.get_web3(network)
        
        # 1. Get EntryPoint contract
        entrypoint_address = self.erc4337.ENTRYPOINT_ADDRESS
        entrypoint_abi = self._get_entrypoint_abi()
        
        entrypoint_contract = w3.eth.contract(
            address=Web3.to_checksum_address(entrypoint_address),
            abi=entrypoint_abi
        )
        
        # 2. Prepare handleOps call
        user_ops = [signed_user_op]
        beneficiary = signed_user_op["sender"]  # Send any refund to sender
        
        # 3. Submit to EntryPoint (this requires a relayer or server wallet)
        # For now, we'll use the server wallet to broadcast
        from hyperagent.security.secrets import SecretsManager
        secrets_manager = SecretsManager()
        server_private_key = await secrets_manager.get_server_wallet_key()
        
        from eth_account import Account
        server_account = Account.from_key(server_private_key)
        
        # Build transaction
        tx = entrypoint_contract.functions.handleOps(
            user_ops,
            beneficiary
        ).build_transaction({
            "from": server_account.address,
            "nonce": w3.eth.get_transaction_count(server_account.address),
            "gas": 3000000,  # EntryPoint execution needs high gas
            "gasPrice": w3.eth.gas_price,
        })
        
        # Sign and send
        signed_tx = server_account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        logger.info(f"UserOperation submitted. Tx hash: {tx_hash.hex()}")
        
        # 4. Wait for confirmation
        receipt = await self._wait_for_receipt(w3, tx_hash)
        
        # 5. Extract contract address from UserOperationEvent
        contract_address = self._extract_contract_address_from_receipt(receipt)
        
        logger.info(f"Contract deployed at {contract_address}")
        
        return {
            "transaction_hash": tx_hash.hex(),
            "contract_address": contract_address,
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"]
        }
    
    async def _wait_for_receipt(self, w3: Web3, tx_hash, timeout: int = 300):
        """Wait for transaction receipt with timeout"""
        import asyncio
        
        return await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        )
    
    def _extract_contract_address_from_receipt(self, receipt: Dict[str, Any]) -> str:
        """
        Extract deployed contract address from EntryPoint logs
        
        Look for UserOperationEvent which contains the deployed address.
        For contract creation, the address is computed from the initCode hash.
        """
        if receipt.get("contractAddress"):
            return receipt["contractAddress"]
        
        try:
            w3 = self.network_manager.get_web3(receipt.get("network", "ethereum"))
            
            # EntryPoint UserOperationEvent signature
            # UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)
            user_op_event_signature = Web3.keccak(text="UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)").hex()
            
            # Parse logs to find UserOperationEvent
            for log in receipt.get("logs", []):
                topics = log.get("topics", [])
                if len(topics) >= 2:
                    # Topics are hex strings, normalize for comparison
                    topic0 = topics[0] if isinstance(topics[0], str) else topics[0].hex()
                    if topic0.lower() == user_op_event_signature.lower():
                        # Extract sender (second topic) - this is the Smart Account address
                        sender = topics[1] if isinstance(topics[1], str) else topics[1].hex()
                        logger.info(f"Found UserOperationEvent from sender {sender}")
            
            # Alternative: Look for ContractDeployed event if using custom factory
            # ContractDeployed(address indexed contractAddress, address indexed deployer)
            contract_deployed_signature = Web3.keccak(text="ContractDeployed(address,address)").hex()
            for log in receipt.get("logs", []):
                topics = log.get("topics", [])
                if len(topics) >= 2:
                    topic0 = topics[0] if isinstance(topics[0], str) else topics[0].hex()
                    if topic0.lower() == contract_deployed_signature.lower():
                        # Extract contract address (first indexed param)
                        contract_address_topic = topics[1] if isinstance(topics[1], str) else topics[1].hex()
                        # Convert topic to address (remove 0x prefix, take last 40 chars, add 0x)
                        address_hex = contract_address_topic.replace("0x", "").lower()[-40:]
                        return Web3.to_checksum_address("0x" + address_hex)
            
            # Fallback: If we have the transaction, we can compute CREATE2 address
            # This requires the initCode and salt, which we may not have here
            logger.warning("Could not extract contract address from receipt logs")
            return "0x0000000000000000000000000000000000000000"
            
        except Exception as e:
            logger.error(f"Error extracting contract address: {e}", exc_info=True)
            return "0x0000000000000000000000000000000000000000"
    
    def _get_entrypoint_abi(self) -> List[Dict[str, Any]]:
        """Get EntryPoint v0.6 ABI including events"""
        return [
            {
                "inputs": [
                    {
                        "components": [
                            {"name": "sender", "type": "address"},
                            {"name": "nonce", "type": "uint256"},
                            {"name": "initCode", "type": "bytes"},
                            {"name": "callData", "type": "bytes"},
                            {"name": "callGasLimit", "type": "uint256"},
                            {"name": "verificationGasLimit", "type": "uint256"},
                            {"name": "preVerificationGas", "type": "uint256"},
                            {"name": "maxFeePerGas", "type": "uint256"},
                            {"name": "maxPriorityFeePerGas", "type": "uint256"},
                            {"name": "paymasterAndData", "type": "bytes"},
                            {"name": "signature", "type": "bytes"}
                        ],
                        "name": "ops",
                        "type": "tuple[]"
                    },
                    {"name": "beneficiary", "type": "address"}
                ],
                "name": "handleOps",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "userOpHash", "type": "bytes32"},
                    {"indexed": True, "name": "sender", "type": "address"},
                    {"indexed": True, "name": "paymaster", "type": "address"},
                    {"indexed": False, "name": "nonce", "type": "uint256"},
                    {"indexed": False, "name": "success", "type": "bool"},
                    {"indexed": False, "name": "actualGasCost", "type": "uint256"},
                    {"indexed": False, "name": "actualGasUsed", "type": "uint256"}
                ],
                "name": "UserOperationEvent",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "contractAddress", "type": "address"},
                    {"indexed": True, "name": "deployer", "type": "address"}
                ],
                "name": "ContractDeployed",
                "type": "event"
            }
        ]

