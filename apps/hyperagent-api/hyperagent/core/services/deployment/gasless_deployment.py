"""Gasless deployment via facilitator (EOA only - NOT for x402 networks)"""

import logging
from typing import Any, Dict, List

from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class GaslessDeploymentHelper:
    """Helper for gasless deployment via facilitator (EOA only)"""

    def __init__(self, network_manager: NetworkManager):
        self.network_manager = network_manager

    async def deploy_gasless_via_facilitator(
        self,
        compiled: Dict[str, Any],
        network: str,
        constructor_args: List[Any],
        wallet_address: str,
        deploy_manual_with_retry,  # Callback to deployment method
    ) -> Dict[str, Any]:
        """
        Deploy contract using gasless facilitator (EOA only - NOT for x402 networks)

        Uses Thirdweb facilitator wallet (EOA) to sponsor gas fees on behalf of users.
        The facilitator wallet pays for gas, allowing users to deploy without native tokens.

        NOTE: This method is for non-x402 networks only. For x402 networks (Avalanche),
        the facilitator is an ERC-4337 Smart Account (not EOA), which requires Thirdweb SDK
        integration (not available in Python backend). Use user-signed transactions instead.
        """
        # Check if this is an x402 network
        enabled_networks = (
            [n.strip() for n in settings.x402_enabled_networks.split(",") if n.strip()]
            if settings.x402_enabled_networks
            else []
        )
        is_x402_network = network in enabled_networks and settings.x402_enabled

        if is_x402_network:
            raise ValueError(
                f"Gasless deployment via facilitator is not supported for x402 networks ({network}). "
                f"x402 networks use ERC-4337 Smart Accounts (not EOA), which require Thirdweb SDK integration "
                f"(not available in Python backend). "
                f"Please use user-signed transaction deployment instead. "
                f"Provide a signed_transaction from user wallet for direct deployment."
            )

        facilitator_address = settings.thirdweb_server_wallet_address
        facilitator_private_key = (
            settings.thirdweb_server_wallet_private_key
            if settings.thirdweb_server_wallet_private_key
            else None
        )

        if not facilitator_private_key:
            raise ValueError(
                f"Gasless deployment on non-x402 network ({network}) requires facilitator wallet configuration. "
                f"Alternatively, provide a signed_transaction from user wallet for direct deployment."
            )

        logger.info(
            f"Using Thirdweb facilitator for gasless deployment on {network}. "
            f"User wallet: {wallet_address}, Facilitator: {facilitator_address}"
        )

        # Deploy using facilitator's private key (facilitator sponsors gas)
        source_code = None  # Can be passed if needed
        return await deploy_manual_with_retry(
            compiled, network, facilitator_private_key, source_code, constructor_args
        )
