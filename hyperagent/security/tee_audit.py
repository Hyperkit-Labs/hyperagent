"""TEE Audit - Layer 4 of 7-Layer Security Defense"""

import logging
from typing import Any, Dict, Optional

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class TEEAuditor:
    """Performs TEE-based audits using LazAI SDK"""

    def __init__(self):
        """Initialize TEE Auditor"""
        self._lazai_client = None
        self._onchain_contract = None

    def _get_lazai_client(self):
        """Lazy initialization of LazAI client"""
        if self._lazai_client is None:
            try:
                lazai_api_key = getattr(settings, "lazai_api_key", None)
                lazai_url = getattr(settings, "lazai_url", "https://api.lazai.com")

                if not lazai_api_key:
                    logger.warning("LazAI API key not configured")
                    return None

                import httpx

                self._lazai_client = httpx.AsyncClient(
                    base_url=lazai_url,
                    headers={"Authorization": f"Bearer {lazai_api_key}"},
                )
            except Exception as e:
                logger.warning(f"Failed to initialize LazAI client: {e}")
                return None

        return self._lazai_client

    async def audit_in_tee(
        self, contract_code: str, is_private: bool = False, network: str = "mantle_testnet"
    ) -> Dict[str, Any]:
        """
        Audit contract in TEE enclave

        Args:
            contract_code: Solidity contract code
            is_private: If True, contract is private and requires TEE
            network: Target network for attestation

        Returns:
            Dictionary with audit results and attestation quote
        """
        if not is_private:
            logger.info("Contract is public, skipping TEE audit")
            return {"tee_audit": False, "reason": "Public contract"}

        client = self._get_lazai_client()
        if not client:
            logger.warning("LazAI client not available, skipping TEE audit")
            return {"tee_audit": False, "reason": "LazAI not configured"}

        try:
            logger.info("Sending contract to TEE enclave for audit")

            response = await client.post(
                "/audit",
                json={"contract_code": contract_code, "network": network},
                timeout=60.0,
            )

            if response.status_code != 200:
                logger.error(f"TEE audit failed: {response.status_code}")
                return {"tee_audit": False, "error": f"HTTP {response.status_code}"}

            result = response.json()
            attestation_quote = result.get("attestation_quote")
            audit_results = result.get("audit_results", {})

            if attestation_quote:
                await self._post_quote_onchain(attestation_quote, network)

            logger.info("TEE audit completed successfully")
            return {
                "tee_audit": True,
                "attestation_quote": attestation_quote,
                "audit_results": audit_results,
                "encrypted": True,
            }

        except Exception as e:
            logger.error(f"TEE audit failed: {e}", exc_info=True)
            return {"tee_audit": False, "error": str(e)}

    async def _post_quote_onchain(self, quote: str, network: str):
        """Post attestation quote on-chain"""
        try:
            from hyperagent.blockchain.network_manager import NetworkManager

            network_manager = NetworkManager()
            web3 = network_manager.get_web3(network)

            if not web3:
                logger.warning(f"Network {network} not available for on-chain posting")
                return

            attestation_contract_address = getattr(
                settings, "attestation_contract_address", None
            )
            if not attestation_contract_address:
                logger.warning("Attestation contract address not configured")
                return

            contract_abi = [
                {
                    "inputs": [{"internalType": "bytes", "name": "quote", "type": "bytes"}],
                    "name": "postAttestation",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function",
                }
            ]

            contract = web3.eth.contract(
                address=web3.to_checksum_address(attestation_contract_address),
                abi=contract_abi,
            )

            private_key = getattr(settings, "private_key", None)
            if not private_key:
                logger.warning("Private key not configured for on-chain posting")
                return

            from eth_account import Account

            account = Account.from_key(private_key)
            tx = contract.functions.postAttestation(quote.encode()).build_transaction(
                {
                    "from": account.address,
                    "nonce": web3.eth.get_transaction_count(account.address),
                    "gas": 200000,
                    "gasPrice": web3.eth.gas_price,
                }
            )

            signed_tx = account.sign_transaction(tx)
            tx_hash = web3.eth.send_raw_transaction(signed_tx.rawTransaction)

            logger.info(f"Attestation quote posted on-chain: {tx_hash.hex()}")
            return tx_hash.hex()

        except Exception as e:
            logger.error(f"Failed to post quote on-chain: {e}")
            return None

    async def get_audit_status(self, audit_id: str) -> Optional[Dict[str, Any]]:
        """Get status of TEE audit"""
        client = self._get_lazai_client()
        if not client:
            return None

        try:
            response = await client.get(f"/audit/{audit_id}", timeout=10.0)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get audit status: {e}")

        return None

