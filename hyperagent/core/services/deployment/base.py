"""Base deployment helper with common utilities"""

import logging
from typing import Any, Dict, Optional

from hyperagent.blockchain.networks import NetworkManager

logger = logging.getLogger(__name__)


class BaseDeploymentHelper:
    """Base helper with common deployment utilities"""

    def __init__(self, network_manager: NetworkManager):
        self.network_manager = network_manager

    async def validate_deployment_requirements(
        self,
        network: str,
        private_key: str,
        wallet_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validate deployment requirements (wallet balance, network connectivity, etc.)

        Args:
            network: Target network
            private_key: Private key for deployment
            wallet_address: Optional wallet address (if not provided, derived from private_key)

        Returns:
            Validation result with details
        """
        from eth_account import Account
        from web3 import Web3

        w3 = self.network_manager.get_web3(network)
        account = Account.from_key(private_key)
        address = wallet_address or account.address

        # Check network connectivity
        try:
            latest_block = w3.eth.get_block("latest")
        except Exception as e:
            raise ValueError(f"Network connectivity check failed: {e}")

        # Check wallet balance
        balance_wei = w3.eth.get_balance(address)
        balance_eth = Web3.from_wei(balance_wei, "ether")

        # Get gas price for estimation
        try:
            fee_data = w3.eth.fee_history(1, "latest")
            base_fee = fee_data["baseFeePerGas"][0]
            max_priority_fee = w3.to_wei(2, "gwei")
            gas_price = base_fee + max_priority_fee
        except Exception:
            gas_price = w3.eth.gas_price

        # Estimate minimum required balance (for a typical deployment)
        estimated_gas = 2000000  # Conservative estimate
        min_required_wei = estimated_gas * gas_price
        min_required_eth = Web3.from_wei(min_required_wei, "ether")

        if balance_wei < min_required_wei:
            currency = "AVAX" if network in ["avalanche_fuji", "avalanche_mainnet"] else "ETH"
            raise ValueError(
                f"Insufficient balance: {balance_eth:.6f} {currency} "
                f"(minimum required: {min_required_eth:.6f} {currency} for deployment)"
            )

        return {
            "wallet_address": address,
            "balance_wei": balance_wei,
            "balance_eth": float(balance_eth),
            "gas_price": gas_price,
            "estimated_min_required": float(min_required_eth),
            "latest_block": latest_block["number"],
            "validation_passed": True,
        }
