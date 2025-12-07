"""Standard Web3 deployment (non-x402 networks)"""

import logging
from typing import Any, Dict, List, Optional

from eth_account import Account
from web3 import Web3

from hyperagent.blockchain.mantle_sdk import MantleSDKClient
from hyperagent.blockchain.networks import NetworkManager

logger = logging.getLogger(__name__)


class StandardDeploymentHelper:
    """Helper for standard Web3 deployment (non-x402 networks)"""

    def __init__(self, network_manager: NetworkManager):
        self.network_manager = network_manager

    async def deploy_manual(
        self,
        compiled: Dict[str, Any],
        network: str,
        private_key: str,
        source_code: Optional[str] = None,
        constructor_args: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        """Manual deployment using Web3.py or Mantle SDK

        For Mantle networks, attempts to use Mantle SDK if available.
        Falls back to Web3.py via NetworkManager.
        """
        # Check if this is a Mantle network and try Mantle SDK
        if network in ["mantle_testnet", "mantle_mainnet"]:
            try:
                mantle_client = MantleSDKClient(network=network)
                if mantle_client.is_available():
                    logger.info(f"Using Mantle SDK for {network} deployment")
                    account = Account.from_key(private_key)
                    result = await mantle_client.deploy_contract(
                        bytecode=compiled.get("bytecode", "0x"),
                        abi=compiled.get("abi", []),
                        wallet_address=account.address,
                        constructor_args=constructor_args,
                        network_manager=self.network_manager,
                    )
                    # If Mantle SDK returns unsigned transaction, sign and send it
                    if result.get("requires_signing"):
                        # Sign transaction and send
                        tx = result["transaction"]
                        signed_tx = account.sign_transaction(tx)
                        w3 = self.network_manager.get_web3(network)
                        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
                        return {
                            "contract_address": receipt.contractAddress,
                            "transaction_hash": receipt.transactionHash.hex(),
                            "block_number": receipt.blockNumber,
                            "gas_used": receipt.gasUsed,
                            "deployment_method": "mantle_sdk",
                        }
                    return result
                else:
                    logger.info(f"Mantle SDK not available for {network}, using Web3.py")
            except Exception as e:
                logger.warning(f"Mantle SDK deployment failed: {e}, falling back to Web3.py")

        # Standard Web3.py deployment (fallback or non-Mantle networks)
        w3 = self.network_manager.get_web3(network)
        account = Account.from_key(private_key)

        # Build contract
        contract = w3.eth.contract(
            abi=compiled.get("abi", []), bytecode=compiled.get("bytecode", "0x")
        )

        # Extract constructor ABI to determine if arguments are required
        constructor_inputs = []
        for item in compiled.get("abi", []):
            if item.get("type") == "constructor":
                constructor_inputs = item.get("inputs", [])
                break

        logger.debug(
            f"Constructor ABI found: inputs: {len(constructor_inputs)}"
        )
        logger.debug(
            f"Constructor args provided: {constructor_args is not None}, count: {len(constructor_args) if constructor_args else 0}"
        )

        # Validate constructor arguments
        needs_args = len(constructor_inputs) > 0

        if needs_args:
            # Constructor requires arguments
            if constructor_args is None:
                expected_types = [inp.get("type", "unknown") for inp in constructor_inputs]
                raise ValueError(
                    f"Constructor requires {len(constructor_inputs)} arguments but none provided. "
                    f"Expected types: {expected_types}. "
                    f"Please ensure constructor_args are generated and passed correctly."
                )
            elif len(constructor_args) == 0:
                expected_types = [inp.get("type", "unknown") for inp in constructor_inputs]
                raise ValueError(
                    f"Constructor requires {len(constructor_inputs)} arguments but empty list provided. "
                    f"Expected types: {expected_types}. "
                    f"Please check constructor value generation in GenerationAgent."
                )
            elif len(constructor_args) != len(constructor_inputs):
                expected_types = [inp.get("type", "unknown") for inp in constructor_inputs]
                raise ValueError(
                    f"Constructor argument count mismatch: expected {len(constructor_inputs)}, got {len(constructor_args)}. "
                    f"Expected types: {expected_types}. "
                    f"Provided values: {constructor_args}. "
                    f"Please verify constructor_args generation matches constructor signature."
                )
            # Validation passed - use constructor with args
            logger.debug(
                f"Using constructor with {len(constructor_args)} arguments: {constructor_args}"
            )
            constructor = contract.constructor(*constructor_args)
        else:
            # Constructor doesn't require arguments
            if constructor_args and len(constructor_args) > 0:
                logger.warning(
                    f"Constructor doesn't require arguments but {len(constructor_args)} provided. Ignoring."
                )
            logger.debug("Using constructor without arguments")
            constructor = contract.constructor()

        # Estimate gas
        try:
            gas_estimate = constructor.estimate_gas({"from": account.address})
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Gas estimation failed: {e}")

            # Provide detailed error message for constructor argument issues
            if "Incorrect argument count" in error_msg or "Expected" in error_msg:
                expected_types = (
                    [inp.get("type", "unknown") for inp in constructor_inputs]
                    if constructor_inputs
                    else []
                )
                provided_count = len(constructor_args) if constructor_args else 0
                raise ValueError(
                    f"Gas estimation failed due to constructor argument mismatch: {error_msg}. "
                    f"Constructor requires {len(constructor_inputs)} arguments ({expected_types}), "
                    f"but {provided_count} were provided. "
                    f"Constructor args received: {constructor_args}. "
                    f"Please check that constructor_args are correctly generated and passed through the pipeline."
                )
            raise ValueError(f"Gas estimation failed: {e}")

        # Get gas price (EIP-1559 support)
        network_config = self.network_manager.get_network_config(network)
        chain_id = network_config.get("chain_id")

        try:
            # Try EIP-1559 first
            fee_data = w3.eth.fee_history(1, "latest")
            base_fee = fee_data["baseFeePerGas"][0]
            max_priority_fee = w3.to_wei(2, "gwei")
            gas_price = base_fee + max_priority_fee
        except Exception:
            # Fallback to legacy gas price
            gas_price = w3.eth.gas_price

        # Get nonce
        nonce = w3.eth.get_transaction_count(account.address)

        # Build transaction
        tx = constructor.build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "gas": int(gas_estimate * 1.2),  # 20% buffer
                "gasPrice": gas_price,
                "chainId": chain_id,
            }
        )

        # Sign and send
        signed_tx = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

        logger.info(f"Deployment transaction sent: {tx_hash.hex()}")

        # Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300, poll_latency=2)

        # Calculate costs
        total_cost_wei = receipt["gasUsed"] * gas_price
        total_cost_eth = w3.from_wei(total_cost_wei, "ether")

        if not receipt.contractAddress:
            raise ValueError("Transaction receipt missing contract address")

        logger.info(
            f"Contract deployed successfully: {receipt.contractAddress} "
            f"on {network}. Tx: {tx_hash.hex()}, Block: {receipt.blockNumber}"
        )

        return {
            "status": "success",
            "contract_address": receipt.contractAddress,
            "deployer_address": account.address,
            "transaction_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "gas_price": gas_price,
            "total_cost_wei": total_cost_wei,
            "total_cost_eth": float(total_cost_eth),
            "deployment_method": "web3_standard",
            "network": network,
        }

