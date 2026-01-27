"""Alith SDK tool definitions and handlers for HyperAgent

Concept: Define tools that Alith agents can call autonomously
Logic: Bridge between Alith tool calls and HyperAgent services
Usage: Tools are registered with Alith agents for autonomous execution
"""

import logging
from typing import Any, Dict, List, Optional

from eth_account import Account
from web3 import Web3

logger = logging.getLogger(__name__)


# Tool Schema Definitions
def get_deployment_tools() -> List[Dict[str, Any]]:
    """
    Get standard deployment tools for Alith agents

    Returns:
        List of tool definitions compatible with Alith SDK
    """
    return [
        {
            "name": "deploy_contract",
            "description": "Deploy a smart contract to the blockchain network",
            "parameters": {
                "type": "object",
                "properties": {
                    "bytecode": {
                        "type": "string",
                        "description": "Contract bytecode (hex string with 0x prefix)",
                    },
                    "abi": {
                        "type": "array",
                        "description": "Contract ABI (Application Binary Interface)",
                        "items": {"type": "object"},
                    },
                    "network": {
                        "type": "string",
                        "description": "Target network (e.g., mantle_testnet)",
                    },
                    "gas_limit": {
                        "type": "number",
                        "description": "Optional gas limit (will be estimated if not provided)",
                    },
                },
                "required": ["bytecode", "network"],
            },
        },
        {
            "name": "check_balance",
            "description": "Check the balance of a wallet address on a blockchain network",
            "parameters": {
                "type": "object",
                "properties": {
                    "address": {
                        "type": "string",
                        "description": "Wallet address to check (0x format)",
                    },
                    "network": {
                        "type": "string",
                        "description": "Network to check balance on",
                    },
                },
                "required": ["address", "network"],
            },
        },
        {
            "name": "estimate_gas",
            "description": "Estimate gas cost for a contract deployment or transaction",
            "parameters": {
                "type": "object",
                "properties": {
                    "bytecode": {
                        "type": "string",
                        "description": "Contract bytecode for deployment estimation",
                    },
                    "network": {
                        "type": "string",
                        "description": "Target network",
                    },
                    "from_address": {
                        "type": "string",
                        "description": "Address deploying the contract",
                    },
                },
                "required": ["bytecode", "network"],
            },
        },
        {
            "name": "get_transaction_status",
            "description": "Get the status of a blockchain transaction",
            "parameters": {
                "type": "object",
                "properties": {
                    "tx_hash": {"type": "string", "description": "Transaction hash (0x format)"},
                    "network": {
                        "type": "string",
                        "description": "Network where transaction was sent",
                    },
                },
                "required": ["tx_hash", "network"],
            },
        },
        {
            "name": "verify_contract",
            "description": "Verify a deployed contract on blockchain explorer",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_address": {
                        "type": "string",
                        "description": "Deployed contract address",
                    },
                    "network": {
                        "type": "string",
                        "description": "Network where contract is deployed",
                    },
                },
                "required": ["contract_address", "network"],
            },
        },
    ]


# Tool Execution Handlers
class AlithToolHandler:
    """
    Handler for executing Alith tool calls

    Concept: Execute tools called by Alith agents
    Logic: Bridge between Alith tool calls and HyperAgent services
    """

    def __init__(self, network_manager, eigenda_client=None, private_key: Optional[str] = None):
        """
        Initialize tool handler

        Args:
            network_manager: NetworkManager instance for Web3 operations
            eigenda_client: Optional EigenDAClient for Mantle deployments
            private_key: Optional private key for transactions
        """
        self.network_manager = network_manager
        self.eigenda_client = eigenda_client
        self.private_key = private_key

    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool called by an Alith agent

        Args:
            tool_name: Name of the tool to execute
            parameters: Tool parameters from agent

        Returns:
            Tool execution result
        """
        try:
            if tool_name == "deploy_contract":
                return await self._deploy_contract(parameters)
            elif tool_name == "check_balance":
                return await self._check_balance(parameters)
            elif tool_name == "estimate_gas":
                return await self._estimate_gas(parameters)
            elif tool_name == "get_transaction_status":
                return await self._get_transaction_status(parameters)
            elif tool_name == "verify_contract":
                return await self._verify_contract(parameters)
            else:
                return {"success": False, "error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.error(f"Tool execution error for {tool_name}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _deploy_contract(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute contract deployment"""
        from hyperagent.core.config import settings

        bytecode = params.get("bytecode", "")
        network = params.get("network")
        abi = params.get("abi", [])
        gas_limit = params.get("gas_limit")

        if not bytecode or not network:
            return {"success": False, "error": "bytecode and network are required"}

        private_key = self.private_key or settings.private_key
        if not private_key:
            return {"success": False, "error": "Private key required for deployment"}

        try:
            w3 = self.network_manager.get_web3(network)
            account = Account.from_key(private_key)

            # Build contract
            contract = w3.eth.contract(abi=abi, bytecode=bytecode)

            # Estimate gas if not provided
            if not gas_limit:
                gas_limit = contract.constructor().estimate_gas({"from": account.address})

            # Get gas price
            try:
                fee_data = w3.eth.fee_history(1, "latest")
                base_fee = fee_data["baseFeePerGas"][0]
                max_priority_fee = w3.to_wei(2, "gwei")
                gas_price = base_fee + max_priority_fee
            except Exception:
                gas_price = w3.eth.gas_price

            # Build and send transaction
            tx = contract.constructor().build_transaction(
                {
                    "from": account.address,
                    "nonce": w3.eth.get_transaction_count(account.address),
                    "gas": int(gas_limit * 1.2),
                    "gasPrice": gas_price,
                    "chainId": self.network_manager.get_network_config(network).get("chain_id"),
                }
            )

            signed_tx = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300, poll_latency=2)

            # EigenDA integration for Mantle
            eigenda_commitment = None
            if network.startswith("mantle") and self.eigenda_client:
                try:
                    bytecode_bytes = bytes.fromhex(bytecode.replace("0x", ""))
                    if bytecode_bytes:
                        eigenda_result = await self.eigenda_client.submit_blob(bytecode_bytes)
                        eigenda_commitment = eigenda_result.get("commitment")
                except Exception as e:
                    logger.warning(f"EigenDA submission failed: {e}")

            return {
                "success": True,
                "contract_address": receipt["contractAddress"],
                "transaction_hash": tx_hash.hex(),
                "block_number": receipt["blockNumber"],
                "gas_used": receipt["gasUsed"],
                "eigenda_commitment": eigenda_commitment,
            }
        except Exception as e:
            logger.error(f"Deployment failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _check_balance(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Check wallet balance"""
        address = params.get("address")
        network = params.get("network")

        if not address or not network:
            return {"success": False, "error": "address and network are required"}

        try:
            w3 = self.network_manager.get_web3(network)
            balance_wei = w3.eth.get_balance(address)
            balance_eth = w3.from_wei(balance_wei, "ether")

            return {
                "success": True,
                "address": address,
                "balance_wei": str(balance_wei),
                "balance_eth": float(balance_eth),
                "network": network,
            }
        except Exception as e:
            logger.error(f"Balance check failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _estimate_gas(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Estimate gas for deployment"""
        bytecode = params.get("bytecode", "")
        network = params.get("network")
        from_address = params.get("from_address")

        if not bytecode or not network:
            return {"success": False, "error": "bytecode and network are required"}

        try:
            w3 = self.network_manager.get_web3(network)

            if not from_address:
                # Use default account if available
                from hyperagent.core.config import settings

                if settings.private_key:
                    account = Account.from_key(settings.private_key)
                    from_address = account.address
                else:
                    return {"success": False, "error": "from_address or private_key required"}

            contract = w3.eth.contract(bytecode=bytecode)
            gas_estimate = contract.constructor().estimate_gas({"from": from_address})

            # Get current gas price
            try:
                fee_data = w3.eth.fee_history(1, "latest")
                base_fee = fee_data["baseFeePerGas"][0]
                max_priority_fee = w3.to_wei(2, "gwei")
                gas_price = base_fee + max_priority_fee
            except Exception:
                gas_price = w3.eth.gas_price

            estimated_cost_wei = gas_estimate * gas_price
            estimated_cost_eth = w3.from_wei(estimated_cost_wei, "ether")

            return {
                "success": True,
                "gas_estimate": int(gas_estimate),
                "gas_price": str(gas_price),
                "estimated_cost_wei": str(estimated_cost_wei),
                "estimated_cost_eth": float(estimated_cost_eth),
                "network": network,
            }
        except Exception as e:
            logger.error(f"Gas estimation failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _get_transaction_status(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get transaction status"""
        tx_hash = params.get("tx_hash")
        network = params.get("network")

        if not tx_hash or not network:
            return {"success": False, "error": "tx_hash and network are required"}

        try:
            w3 = self.network_manager.get_web3(network)
            receipt = w3.eth.get_transaction_receipt(tx_hash)

            return {
                "success": True,
                "transaction_hash": tx_hash,
                "status": "success" if receipt.get("status") == 1 else "failed",
                "block_number": receipt.get("blockNumber"),
                "gas_used": receipt.get("gasUsed"),
                "contract_address": receipt.get("contractAddress"),
                "network": network,
            }
        except Exception as e:
            logger.error(f"Transaction status check failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def _verify_contract(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Verify contract on blockchain explorer"""
        from hyperagent.blockchain.verification import ContractVerifier
        
        contract_address = params.get("contract_address")
        network = params.get("network")
        source_code = params.get("source_code")
        contract_name = params.get("contract_name", "Contract")
        compiler_version = params.get("compiler_version")
        optimization_enabled = params.get("optimization_enabled", False)

        if not contract_address or not network:
            return {"success": False, "error": "contract_address and network are required"}

        try:
            # Use the ContractVerifier for full explorer API integration
            verifier = ContractVerifier(self.network_manager)
            
            # Basic verification: check if contract has code
            w3 = self.network_manager.get_web3(network)
            code = w3.eth.get_code(contract_address)
            
            if len(code) == 0:
                return {
                    "success": False,
                    "error": "Contract has no code at this address",
                    "contract_address": contract_address,
                    "network": network,
                }
            
            # If source code is provided, attempt full verification
            if source_code:
                try:
                    verification_result = await verifier.verify_contract(
                        contract_address=contract_address,
                        source_code=source_code,
                        contract_name=contract_name,
                        compiler_version=compiler_version or "0.8.24",
                        optimization_enabled=optimization_enabled,
                        network=network,
                    )
                    return verification_result
                except Exception as e:
                    logger.warning(f"Full verification failed, returning basic check: {e}")
            
            # Return basic verification result
            return {
                "success": True,
                "contract_address": contract_address,
                "has_code": True,
                "code_length": len(code),
                "network": network,
                "verified": False,
                "note": "Contract has code but source verification not attempted (provide source_code for full verification)",
            }
        except Exception as e:
            logger.error(f"Contract verification failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
