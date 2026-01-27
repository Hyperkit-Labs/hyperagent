"""Thirdweb client for x402 payment verification via TypeScript service"""

import json
import logging
from typing import Any, Dict, Optional

import httpx

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class ThirdwebClient:
    """
    Thirdweb Client for x402 Payment Verification

    Concept: Integrate with TypeScript x402 verification service that uses Thirdweb facilitator
    Logic:
        1. Calls local TypeScript service (which uses Thirdweb SDK)
        2. TypeScript service uses settlePayment() with facilitator
        3. Returns verification result
    """

    def __init__(self):
        self.x402_service_url = settings.x402_service_url
        self.merchant_wallet_address = settings.merchant_wallet_address

        if not self.x402_service_url:
            logger.warning("x402_service_url not configured. x402 payments will not work.")

    async def settle_payment(
        self,
        resource_url: str,
        method: str,
        payment_data: Any,
        network: str,
        price: str,
        route_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Settle x402 payment via TypeScript service (which uses Thirdweb facilitator)

        Args:
            resource_url: Full URL of the resource requiring payment
            method: HTTP method (GET, POST, etc.)
            payment_data: Payment data from x-payment header (can be string or dict)
            network: Target network (avalanche_fuji or avalanche_mainnet)
            price: Price string (e.g., "$1.00" or "1.0")
            route_config: Optional route configuration

        Returns:
            Dictionary with settlement result:
            {
                "status": 200 if verified, 402 if payment required,
                "verified": bool,
                "responseBody": optional,
                "responseHeaders": optional
            }
        """
        if not self.x402_service_url:
            logger.error("x402_service_url not configured")
            return {"status": 500, "verified": False, "error": "x402 service URL not configured"}

        if not self.merchant_wallet_address:
            logger.error("merchant_wallet_address not configured")
            return {
                "status": 500,
                "verified": False,
                "error": "merchant wallet address not configured",
            }

        # Prepare payment data - convert to string if it's a dict
        payment_data_str = payment_data
        if isinstance(payment_data, dict):
            payment_data_str = json.dumps(payment_data)
        elif payment_data is None:
            payment_data_str = None

        # Thirdweb x402 supports price strings (e.g. "$0.10") and will return
        # chain-specific payment requirements (including permit / ERC-3009 support).
        try:
            price_float = float(str(price).replace("$", "").strip())
            price_str = f"${price_float}"
        except Exception:
            # Best-effort: pass through unchanged
            price_str = str(price)
            if not price_str.startswith("$"):
                price_str = f"${price_str}"

        # Resolve network into a chainId for the verifier (so we don't need a giant name map)
        from hyperagent.blockchain.network_resolver import parse_evm_chain_id
        from hyperagent.blockchain.network_features import NetworkFeatureManager

        chain_id = None
        cfg = NetworkFeatureManager.get_network_config(network, load_usdc=False) or {}
        chain_id = cfg.get("chain_id") or parse_evm_chain_id(network)

        network_for_verifier = network
        if chain_id:
            network_for_verifier = f"eip155:{int(chain_id)}"

        # Prepare request payload
        request_payload = {
            "resourceUrl": resource_url,
            "method": method,
            "paymentData": payment_data_str,
            "payTo": self.merchant_wallet_address,
            "network": network_for_verifier,
            "price": price_str,
            "routeConfig": route_config
            or {
                "description": "HyperAgent API endpoint",
                "mimeType": "application/json",
                "maxTimeoutSeconds": 300,
            },
        }

        # Retry logic with exponential backoff for 502 errors
        max_retries = 3
        retry_delay = 1.0  # Start with 1 second
        last_error = None

        for attempt in range(max_retries):
            try:
                # Call TypeScript x402 verification service with increased timeout
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self.x402_service_url}/settle-payment",
                        json=request_payload,
                        timeout=60.0,  # Increased timeout to 60 seconds
                    )

                    # Handle 502 Bad Gateway with retry
                    if response.status_code == 502:
                        if attempt < max_retries - 1:
                            logger.warning(
                                f"x402 settlement service returned 502 Bad Gateway (attempt {attempt + 1}/{max_retries}). "
                                f"Retrying in {retry_delay} seconds..."
                            )
                            import asyncio

                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                            continue
                        else:
                            # Last attempt failed
                            error_msg = "Settlement service temporarily unavailable (502 Bad Gateway). Please try again later."
                            logger.error(
                                f"x402 settlement failed after {max_retries} attempts: {error_msg}"
                            )
                            return {
                                "status": 502,
                                "verified": False,
                                "error": error_msg,
                                "errorMessage": error_msg,
                            }

                    # Handle response - might be JSON or text (for 402 JWT tokens)
                    try:
                        result = response.json()
                    except (ValueError, json.JSONDecodeError):
                        # If response is not JSON (e.g., plain text JWT token), handle it
                        text_content = response.text
                        return {
                            "status": response.status_code,
                            "verified": False,
                            "responseBody": text_content,  # JWT token string
                            "responseHeaders": dict(response.headers),
                            "error": text_content if response.status_code != 402 else None,
                        }

                    # Check if result contains error from settlement service
                    if result.get("error") and "502" in str(result.get("error", "")):
                        if attempt < max_retries - 1:
                            logger.warning(
                                f"Settlement error in response (attempt {attempt + 1}/{max_retries}): {result.get('error')}. "
                                f"Retrying in {retry_delay} seconds..."
                            )
                            import asyncio

                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2
                            continue

                    return {
                        "status": result.get("status", response.status_code),
                        "verified": result.get("verified", False),
                        "responseBody": result.get("responseBody"),
                        "responseHeaders": result.get("responseHeaders"),
                        "error": result.get("error"),
                        "errorMessage": result.get(
                            "errorMessage"
                        ),  # Include errorMessage if present
                    }

            except httpx.TimeoutException as e:
                if attempt < max_retries - 1:
                    logger.warning(
                        f"x402 settlement request timed out (attempt {attempt + 1}/{max_retries}). "
                        f"Retrying in {retry_delay} seconds..."
                    )
                    import asyncio

                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    last_error = f"Request timeout: {str(e)}"
                    continue
                else:
                    logger.error(f"x402 settlement request timed out after {max_retries} attempts")
                    return {
                        "status": 504,
                        "verified": False,
                        "error": "Settlement service request timeout. Please try again later.",
                        "errorMessage": "Settlement service request timeout. Please try again later.",
                    }
            except httpx.RequestError as e:
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Error connecting to x402 service (attempt {attempt + 1}/{max_retries}): {e}. "
                        f"Retrying in {retry_delay} seconds..."
                    )
                    import asyncio

                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    last_error = str(e)
                    continue
                else:
                    logger.error(
                        f"Failed to connect to x402 service after {max_retries} attempts: {e}"
                    )
                    return {
                        "status": 500,
                        "verified": False,
                        "error": f"Failed to connect to x402 service: {str(e)}",
                        "errorMessage": f"Failed to connect to x402 service: {str(e)}",
                    }
            except Exception as e:
                logger.error(f"Unexpected error settling payment: {e}", exc_info=True)
                return {
                    "status": 500,
                    "verified": False,
                    "error": f"Settlement error: {str(e)}",
                    "errorMessage": f"Settlement error: {str(e)}",
                }

        # If we get here, all retries failed
        return {
            "status": 500,
            "verified": False,
            "error": f"Settlement failed after {max_retries} attempts. Last error: {last_error}",
            "errorMessage": f"Settlement failed after {max_retries} attempts. Last error: {last_error}",
        }

    async def verify_payment(
        self,
        payment_data: Any,
        resource_url: str,
        method: str,
        price: str,
        network: str = "avalanche_fuji",
    ) -> bool:
        """
        Verify x402 payment (wrapper around settle_payment)

        Args:
            payment_data: Payment data from x-payment header
            resource_url: Full URL of the resource
            method: HTTP method
            price: Price string (e.g., "$1.00")
            network: Target network

        Returns:
            True if payment is verified, False otherwise
        """
        result = await self.settle_payment(
            resource_url=resource_url,
            method=method,
            payment_data=payment_data,
            network=network,
            price=price,
        )

        return result.get("verified", False) and result.get("status") == 200

    def get_facilitator_config(self) -> Dict[str, Any]:
        """Get facilitator configuration"""
        return {
            "x402_service_url": self.x402_service_url,
            "merchant_wallet_address": self.merchant_wallet_address,
            "network": "avalanche_fuji",  # Default to Fuji for testing
        }
