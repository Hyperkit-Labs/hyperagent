"""Moralis Webhooks integration for real-time event streaming"""

import logging
from typing import Any, Callable, Dict, List, Optional

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class MoralisWebhooks:
    """Manages Moralis webhooks for contract event streaming"""

    def __init__(self):
        """Initialize Moralis Webhooks"""
        self._moralis_client = None
        self._webhook_handlers: Dict[str, List[Callable]] = {}
        self._websocket_server = None

    def _get_moralis_client(self):
        """Lazy initialization of Moralis client"""
        if self._moralis_client is None:
            try:
                api_key = getattr(settings, "moralis_api_key", None)
                if not api_key:
                    logger.warning("Moralis API key not configured")
                    return None

                import httpx

                self._moralis_client = httpx.AsyncClient(
                    base_url="https://deep-index.moralis.io/api/v2",
                    headers={"X-API-Key": api_key},
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Moralis client: {e}")
                return None

        return self._moralis_client

    async def setup_webhook(
        self, contract_address: str, network: str, events: List[str]
    ) -> Optional[str]:
        """
        Set up webhook for contract events

        Args:
            contract_address: Contract address to monitor
            network: Blockchain network
            events: List of event names to monitor

        Returns:
            Webhook ID if successful
        """
        client = self._get_moralis_client()
        if not client:
            return None

        try:
            webhook_url = getattr(settings, "moralis_webhook_url", None)
            if not webhook_url:
                logger.warning("Moralis webhook URL not configured")
                return None

            response = await client.post(
                "/webhook",
                json={
                    "url": webhook_url,
                    "description": f"HyperKit webhook for {contract_address}",
                    "chains": [self._network_to_chain_id(network)],
                    "address": contract_address,
                    "topic0": events,
                },
                timeout=10.0,
            )

            if response.status_code == 200:
                webhook_id = response.json().get("id")
                logger.info(f"Webhook registered for {contract_address}: {webhook_id}")
                return webhook_id
            else:
                logger.error(f"Failed to register webhook: {response.status_code}")

        except Exception as e:
            logger.error(f"Failed to setup webhook: {e}")
            return None

        return None

    async def handle_event(self, event: Dict[str, Any]):
        """
        Handle incoming webhook event

        Args:
            event: Event dictionary from Moralis
        """
        try:
            event_type = event.get("eventName") or event.get("topic0")
            contract_address = event.get("address", "").lower()

            logger.info(f"Received event {event_type} from {contract_address}")

            handlers = self._webhook_handlers.get(contract_address, [])
            for handler in handlers:
                try:
                    await handler(event)
                except Exception as e:
                    logger.error(f"Event handler failed: {e}")

            await self._broadcast_via_websocket(event)

        except Exception as e:
            logger.error(f"Failed to handle event: {e}", exc_info=True)

    async def _broadcast_via_websocket(self, event: Dict[str, Any]):
        """Broadcast event via WebSocket"""
        try:
            from hyperagent.api.websocket import ConnectionManager

            manager = ConnectionManager()
            await manager.broadcast_to_workflow(
                workflow_id=event.get("workflow_id", "global"),
                message={"type": "contract_event", "data": event},
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast via WebSocket: {e}")

    def register_handler(self, contract_address: str, handler: Callable):
        """Register event handler for contract"""
        address_lower = contract_address.lower()
        if address_lower not in self._webhook_handlers:
            self._webhook_handlers[address_lower] = []
        self._webhook_handlers[address_lower].append(handler)
        logger.info(f"Registered handler for {contract_address}")

    async def get_contract_events(
        self, contract_address: str, network: str, from_block: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get contract events from Moralis

        Args:
            contract_address: Contract address
            network: Blockchain network
            from_block: Starting block number

        Returns:
            List of events
        """
        client = self._get_moralis_client()
        if not client:
            return []

        try:
            chain = self._network_to_chain_id(network)
            response = await client.get(
                f"/{contract_address}/events",
                params={"chain": chain, "from_block": from_block},
                timeout=10.0,
            )

            if response.status_code == 200:
                return response.json().get("result", [])

        except Exception as e:
            logger.error(f"Failed to get contract events: {e}")
            return []

        return []

    async def track_tvl_changes(self, contract_address: str, network: str):
        """Track TVL changes for contract"""
        events = await self.get_contract_events(contract_address, network)
        for event in events:
            if event.get("eventName") in ["Deposit", "Withdraw", "Transfer"]:
                await self.handle_event(event)

    def _network_to_chain_id(self, network: str) -> str:
        """Convert network name to Moralis chain ID"""
        chain_map = {
            "ethereum": "eth",
            "polygon": "polygon",
            "avalanche": "avalanche",
            "bsc": "bsc",
            "mantle": "mantle",
            "mantle_testnet": "mantle-testnet",
        }
        return chain_map.get(network.lower(), "eth")

