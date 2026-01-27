"""Deployment Agent implementation"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from eth_account import Account
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3

from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType

logger = logging.getLogger(__name__)


class DeploymentAgent(ServiceInterface):
    """
    Deployment Agent

    Concept: Deploy contracts to blockchain
    Logic: Compile → Estimate Gas → Sign → Send → Confirm
    SLA: p99 < 300s, p95 < 200s
    """

    def __init__(
        self,
        network_manager: NetworkManager,
        eigenda_client: EigenDAClient,
        event_bus: EventBus,
        db: Optional[AsyncSession] = None,
    ):
        self.network_manager = network_manager
        self.eigenda_client = eigenda_client
        self.event_bus = event_bus
        self.db = db

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy contract to blockchain"""
        workflow_id = input_data.get("workflow_id", str(uuid.uuid4()))
        compiled = input_data["compiled_contract"]
        network = input_data["network"]
        private_key = input_data["private_key"]

        # Publish start event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.DEPLOYMENT_STARTED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data={"network": network},
                source_agent="deployment",
            )
        )

        try:
            w3 = self.network_manager.get_web3(network)
            account = Account.from_key(private_key)

            # Build transaction
            contract = w3.eth.contract(abi=compiled["abi"], bytecode=compiled["bytecode"])

            # Estimate gas
            gas_estimate = contract.constructor().estimate_gas({"from": account.address})

            # Build transaction
            tx = contract.constructor().build_transaction(
                {
                    "from": account.address,
                    "nonce": w3.eth.get_transaction_count(account.address),
                    "gas": int(gas_estimate * 1.2),  # 20% buffer
                    "gasPrice": w3.eth.gas_price,
                }
            )

            # Sign transaction
            signed_tx = account.sign_transaction(tx)

            # Send transaction
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
            
            # Log deployment audit
            if self.db:
                try:
                    audit = DeploymentAudit(
                        deployment_id=uuid.UUID(workflow_id) if workflow_id else uuid.uuid4(),
                        user_wallet=input_data.get("wallet_address", account.address),
                        server_wallet=account.address,
                        deployment_method="server-wallet",
                        network=network,
                        payment_tx_hash=input_data.get("payment_tx_hash"),
                        deployment_tx_hash=tx_hash.hex(),
                        contract_address=receipt["contractAddress"],
                        gas_used=str(receipt["gasUsed"]),
                        gas_paid_by_server=str(receipt["gasUsed"] * receipt.get("effectiveGasPrice", w3.eth.gas_price)),
                        gas_price_gwei=str(w3.from_wei(receipt.get("effectiveGasPrice", w3.eth.gas_price), "gwei")),
                    )
                    self.db.add(audit)
                    await self.db.commit()
                    logger.info(f"Deployment audit logged: {audit.id}")
                except Exception as e:
                    logger.error(f"Failed to log deployment audit: {e}")
                    await self.db.rollback()

            # EigenDA integration (for Mantle)
            eigenda_commitment = None
            if network.startswith("mantle"):
                try:
                    # Convert bytecode to bytes if needed
                    bytecode = compiled.get("bytecode", "")
                    if isinstance(bytecode, str):
                        # Remove 0x prefix if present
                        bytecode = bytecode.replace("0x", "")
                        bytecode_bytes = bytes.fromhex(bytecode)
                    else:
                        bytecode_bytes = bytecode

                    eigenda_result = await self.eigenda_client.submit_blob(bytecode_bytes)
                    eigenda_commitment = eigenda_result.get("commitment")
                except Exception as e:
                    logger.warning(f"EigenDA submission failed: {e}")
                    # Continue without EigenDA commitment

            result = {
                "status": "success",
                "contract_address": receipt["contractAddress"],
                "tx_hash": tx_hash.hex(),
                "block_number": receipt["blockNumber"],
                "gas_used": receipt["gasUsed"],
                "eigenda_commitment": eigenda_commitment,
            }

            # Publish confirmation event
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.DEPLOYMENT_CONFIRMED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data=result,
                    source_agent="deployment",
                )
            )

            return result

        except Exception as e:
            await self.on_error(e)
            raise

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate deployment input"""
        return bool(
            data.get("compiled_contract") and data.get("network") and data.get("private_key")
        )

    async def on_error(self, error: Exception) -> None:
        """Handle deployment errors"""
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.DEPLOYMENT_FAILED,
                workflow_id="",
                timestamp=datetime.now(),
                data={"error": str(error)},
                source_agent="deployment",
            )
        )
