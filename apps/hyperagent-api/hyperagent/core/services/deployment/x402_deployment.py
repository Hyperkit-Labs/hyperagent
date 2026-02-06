"""x402 network deployment (user-signed transactions)"""

import logging
from typing import Any, Dict

from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.exceptions import DeploymentError, NetworkError, WalletError

logger = logging.getLogger(__name__)


class X402DeploymentHelper:
    """Helper for x402 network deployment (user-signed transactions)"""

    def __init__(self, network_manager: NetworkManager):
        self.network_manager = network_manager

    async def deploy_with_signed_transaction(
        self, signed_transaction: str, network: str, wallet_address: str
    ) -> Dict[str, Any]:
        """
        Deploy contract using signed transaction from user's wallet

        Concept: User signs transaction on frontend, backend broadcasts it
        Logic:
            1. Decode signed transaction (hex string)
            2. Broadcast to network
            3. Wait for confirmation
            4. Return deployment details

        Note: signed_transaction should be a hex string (0x-prefixed or not)
        """
        from web3 import Web3

        w3 = self.network_manager.get_web3(network)

        try:
            # Ensure transaction is hex string
            if isinstance(signed_transaction, str):
                # Remove 0x prefix if present, then add it back for consistency
                tx_hex = signed_transaction.strip()
                if not tx_hex.startswith("0x"):
                    tx_hex = "0x" + tx_hex
            else:
                raise ValueError(
                    f"Invalid transaction format: expected hex string, got {type(signed_transaction)}"
                )

            # Send raw transaction
            tx_hash = w3.eth.send_raw_transaction(tx_hex)

            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)

            # Extract contract address from receipt
            contract_address = receipt.contractAddress

            if not contract_address:
                raise ValueError("Contract address not found in transaction receipt")

            logger.info(
                f"Contract deployed via user wallet {wallet_address} "
                f"to {network}: {contract_address}"
            )

            return {
                "status": "success",
                "contract_address": contract_address,
                "transaction_hash": receipt.transactionHash.hex(),
                "tx_hash": receipt.transactionHash.hex(),  # Alias for backward compatibility
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "deployment_method": "user_wallet",
            }
        except NetworkError:
            raise  # Re-raise network errors as-is
        except WalletError:
            raise  # Re-raise wallet errors as-is
        except Exception as e:
            logger.error(f"Failed to deploy with signed transaction: {e}", exc_info=True)
            raise DeploymentError(
                f"Deployment failed: {str(e)}",
                details={
                    "network": network,
                    "wallet_address": wallet_address,
                    "error_type": type(e).__name__,
                },
            )
