"""Web3 transaction manager with queuing and nonce management"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from eth_account import Account
from web3 import Web3

from hyperagent.blockchain.networks import NetworkManager

logger = logging.getLogger(__name__)


class Web3Manager:
    """
    Web3 Transaction Manager

    Concept: Centralized transaction management
    Logic:
        - Queue transactions to prevent nonce conflicts
        - Manage nonces per address
        - Optimize gas prices (EIP-1559 support)
        - Track confirmations
    Architecture:
        ┌──────────────────┐
        │  Web3Manager     │
        ├──────────────────┤
        │ - Queue          │
        │ - Nonce Manager  │
        │ - Gas Optimizer  │
        │ - Confirmation   │
        └────────┬─────────┘
                 │
            ┌────┴────┐
            │  Web3   │
            └─────────┘
    """

    def __init__(self, network_manager: NetworkManager):
        self.network_manager = network_manager
        self._queues: Dict[str, asyncio.Queue] = {}
        self._nonces: Dict[str, int] = {}
        self._pending_txs: Dict[str, Dict] = {}
        self._queue_processors: Dict[str, asyncio.Task] = {}

    async def send_transaction(
        self,
        network: str,
        tx: Dict,
        private_key: str,
        wait_for_confirmation: bool = True,
        confirmation_blocks: int = 1,
    ) -> Dict[str, Any]:
        """
        Send transaction with queuing

        Concept: Queue transactions to prevent nonce conflicts
        Logic:
            1. Get or create queue for address
            2. Add transaction to queue
            3. Process queue sequentially
            4. Wait for confirmation if requested
            5. Return transaction hash and receipt

        Args:
            network: Network name (e.g., "mantle_testnet")
            tx: Transaction dictionary (from, to, value, data, etc.)
            private_key: Private key for signing
            wait_for_confirmation: Whether to wait for confirmation
            confirmation_blocks: Number of blocks to wait for

        Returns:
            Transaction hash and receipt (if confirmed)
        """
        account = Account.from_key(private_key)
        address = account.address
        queue_key = f"{network}:{address}"

        # Create queue if not exists
        if queue_key not in self._queues:
            self._queues[queue_key] = asyncio.Queue()
            # Start queue processor
            self._queue_processors[queue_key] = asyncio.create_task(
                self._process_queue(network, address)
            )

        # Create future for result
        future = asyncio.Future()
        await self._queues[queue_key].put(
            {
                "tx": tx,
                "private_key": private_key,
                "future": future,
                "wait_for_confirmation": wait_for_confirmation,
                "confirmation_blocks": confirmation_blocks,
            }
        )

        # Wait for result
        result = await future

        if isinstance(result, Exception):
            raise result

        return result

    async def _process_queue(self, network: str, address: str):
        """
        Process transaction queue sequentially

        Concept: Process transactions one at a time per address
        Logic:
            1. Get transaction from queue
            2. Get current nonce
            3. Set nonce in transaction
            4. Sign and send
            5. Increment nonce
            6. Wait for confirmation if requested
            7. Return result
        """
        queue_key = f"{network}:{address}"
        w3 = self.network_manager.get_web3(network)

        while True:
            try:
                item = await self._queues[queue_key].get()

                # Get current nonce
                if address not in self._nonces:
                    self._nonces[address] = w3.eth.get_transaction_count(address)

                # Set nonce in transaction
                item["tx"]["nonce"] = self._nonces[address]

                # Optimize gas price
                if "gasPrice" not in item["tx"]:
                    item["tx"]["gasPrice"] = await self._get_optimal_gas_price(w3, network)

                # Sign and send
                account = Account.from_key(item["private_key"])
                signed_tx = account.sign_transaction(item["tx"])
                tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                tx_hash_hex = tx_hash.hex()

                # Increment nonce
                self._nonces[address] += 1

                # Store pending transaction
                self._pending_txs[tx_hash_hex] = {
                    "network": network,
                    "address": address,
                    "timestamp": datetime.now(),
                    "tx_hash": tx_hash_hex,
                }

                logger.info(
                    f"Transaction sent: {tx_hash_hex[:20]}... (nonce: {self._nonces[address] - 1})"
                )

                # Wait for confirmation if requested
                result = {"tx_hash": tx_hash_hex}
                if item["wait_for_confirmation"]:
                    receipt = w3.eth.wait_for_transaction_receipt(
                        tx_hash, timeout=300, poll_latency=2
                    )
                    result["receipt"] = {
                        "block_number": receipt["blockNumber"],
                        "gas_used": receipt["gasUsed"],
                        "status": receipt["status"],
                        "contract_address": receipt.get("contractAddress"),
                    }
                    logger.info(
                        f"Transaction confirmed: {tx_hash_hex[:20]}... (block: {receipt['blockNumber']})"
                    )

                # Set result
                item["future"].set_result(result)

            except Exception as e:
                logger.error(f"Transaction processing error: {e}", exc_info=True)
                if "future" in item:
                    item["future"].set_exception(e)

    async def _get_optimal_gas_price(self, w3: Web3, network: str) -> int:
        """
        Get optimal gas price with EIP-1559 support

        Concept: Use EIP-1559 when available, fallback to legacy
        Logic:
            1. Try to get fee history (EIP-1559)
            2. Calculate base fee + priority fee
            3. Fallback to legacy gas_price if EIP-1559 not available
        """
        try:
            # Try EIP-1559
            fee_history = w3.eth.fee_history(1, "latest")
            if fee_history and "baseFeePerGas" in fee_history:
                base_fee = fee_history["baseFeePerGas"][0]
                max_priority_fee = w3.to_wei(2, "gwei")  # 2 gwei priority fee
                return base_fee + max_priority_fee
        except Exception:
            pass

        # Fallback to legacy gas price
        return w3.eth.gas_price

    async def get_transaction_status(self, tx_hash: str, network: str) -> Dict[str, Any]:
        """
        Get transaction status and receipt

        Concept: Check transaction confirmation status
        Logic:
            1. Get transaction receipt
            2. Check confirmation count
            3. Return status information
        """
        w3 = self.network_manager.get_web3(network)

        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            current_block = w3.eth.block_number
            confirmations = current_block - receipt["blockNumber"]

            return {
                "tx_hash": tx_hash,
                "status": "confirmed" if receipt["status"] == 1 else "failed",
                "block_number": receipt["blockNumber"],
                "confirmations": confirmations,
                "gas_used": receipt["gasUsed"],
            }
        except Exception as e:
            # Transaction not found or not yet mined
            try:
                tx = w3.eth.get_transaction(tx_hash)
                return {
                    "tx_hash": tx_hash,
                    "status": "pending",
                    "block_number": None,
                    "confirmations": 0,
                }
            except Exception:
                return {"tx_hash": tx_hash, "status": "not_found", "error": str(e)}

    def get_pending_transactions(self, address: Optional[str] = None) -> list:
        """Get list of pending transactions"""
        if address:
            return [tx for tx in self._pending_txs.values() if tx.get("address") == address]
        return list(self._pending_txs.values())

    async def cancel_transaction(
        self, network: str, address: str, nonce: int, private_key: str
    ) -> str:
        """
        Cancel a pending transaction by sending a replacement with higher gas

        Concept: Replace pending transaction with zero-value transaction
        Logic:
            1. Create replacement transaction with same nonce
            2. Set higher gas price
            3. Send to same address with zero value
        """
        w3 = self.network_manager.get_web3(network)
        account = Account.from_key(private_key)

        # Create cancellation transaction
        cancel_tx = {
            "from": account.address,
            "to": account.address,  # Send to self
            "value": 0,
            "nonce": nonce,
            "gas": 21000,  # Standard transfer gas
            "gasPrice": w3.eth.gas_price * 2,  # Double gas price
            "chainId": self.network_manager.get_network_config(network)["chain_id"],
        }

        # Send cancellation
        return await self.send_transaction(network, cancel_tx, private_key)
