"""
Credits + x402 hybrid billing model.

1. Internal credits: Users buy credits (Stripe/fiat or USDC/USDT). Orchestrator charges per:
   - LLM tokens (approx)
   - Audit run
   - Simulation
   - Deploy

2. x402 for external/agentic access: When third-party agents call APIs (e.g. /api/v1/workflows/generate,
   /api/v1/deploy), respond with x402 402 challenges. Fixed per-endpoint prices (e.g. $0.10 compile+audit,
   $1.00 deploy). Settlement in USDC on SKALE Base; backend credits workspace once paid.

ERC-1066 status codes used in challenge responses (source: hyperkit-erc1066 TypeScript SDK types):
  0x54 = INSUFFICIENT_FUNDS → "request_payment" action (payment required, no proof)
  0x01 = SUCCESS             → "execute" action (proof accepted)
  0x10 = DISALLOWED          → "deny" action (invalid signature)
  0x21 = TOO_LATE            → "deny" action (proof expired)
  0x22 = ALREADY_EXECUTED    → "deny" action (replay detected)

See: docs.cdp.coinbase.com/x402/welcome, x402.org/ecosystem
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


_PATH_TO_RESOURCE: dict[str, str] = {
    "/api/v1/workflows/generate": "pipeline.run",
    "/api/v1/deploy": "pipeline.run",
    "/api/v1/compile": "codegen.quick",
    "/api/v1/audit": "audit.full",
}


def get_endpoint_price(path: str, method: str = "POST") -> float | None:
    """
    Return fixed price in USD for x402-gated endpoint. None = no x402 required.
    Uses registries.get_resource_price when path maps to a resource; fallback to defaults.
    """
    key = path.rstrip("/")
    resource_id = _PATH_TO_RESOURCE.get(key)
    if resource_id:
        try:
            from registries import get_resource_price

            return get_resource_price(resource_id)
        except ImportError:
            pass
    defaults: dict[str, float] = {
        "/api/v1/workflows/generate": 0.15,
        "/api/v1/deploy": 0.15,
        "/api/v1/compile": 0.02,
        "/api/v1/audit": 0.10,
    }
    return defaults.get(key)


def is_internal_caller(request_headers: dict[str, str], user_id: str | None) -> bool:
    """
    True if caller is internal (Studio user with X-User-Id) and uses credits.
    False if external agent; should get x402 402 challenge.
    """
    if user_id and (
        request_headers.get("X-User-Id") or request_headers.get("x-user-id")
    ):
        return True
    if request_headers.get("X-Internal-Token"):
        return True
    return False


def x402_challenge_response(
    path: str,
    price_usd: float,
    payment_url: str | None = None,
) -> dict[str, Any]:
    """Build 402 Payment Required response body for x402.

    Returned when an external agent calls a priced endpoint without a valid
    X-Payment proof header. Includes:
    - ERC-1066 status code (0x54 = INSUFFICIENT_FUNDS → "request_payment")
    - Standard x402 paymentRequirements object that compliant clients can parse
    - Legacy fields (code, price_usd, settlement) for backward compatibility
    """
    pay_to = os.environ.get("X402_PAY_TO_ADDRESS", "").strip()
    # Default: SKALE Base Mainnet USDC.e (IMA-bridged). Override via X402_ASSET_ADDRESS.
    asset = os.environ.get(
        "X402_ASSET_ADDRESS",
        "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20",
    ).strip()
    # CAIP-2 network id (x402 v2 + Pieverse / PayAI facilitators expect this shape).
    network_caip = os.environ.get(
        "X402_NETWORK_CAIP",
        "eip155:1187947933",
    ).strip()
    # Amount in USDC micro-units (6 decimals): $0.15 → 150000
    amount_micro = str(int(price_usd * 1_000_000))

    return {
        # ERC-1066 status — matches hyperkit-erc1066 SDK status codes.
        "erc1066_code": "0x54",  # INSUFFICIENT_FUNDS → request_payment
        "action": "request_payment",
        # Legacy / backward-compat fields (parseX402Challenge checks these)
        "error": "payment_required",
        "code": "x402",
        "message": f"Endpoint requires payment: ${price_usd:.2f} USD",
        "price_usd": price_usd,
        "payment_url": payment_url,
        "settlement": "USDC on SKALE Base",
        # Standard x402 paymentRequirements object.
        # Clients that implement the official x402 protocol parse this field.
        "paymentRequirements": {
            "x402Version": 2,
            "scheme": "exact",
            "network": network_caip,
            "maxAmountRequired": amount_micro,
            "resource": path,
            "description": f"HyperAgent API: {path}",
            "mimeType": "application/json",
            "payTo": pay_to,
            "maxTimeoutSeconds": 300,
            "asset": asset,
        },
    }
