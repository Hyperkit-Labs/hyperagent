"""
Credits + x402 hybrid billing model.

1. Internal credits: Users buy credits (Stripe/fiat or USDC/USDT). Orchestrator charges per:
   - LLM tokens (approx)
   - Audit run
   - Simulation
   - Deploy

2. x402 for external/agentic access: When third-party agents call APIs (e.g. /api/v1/workflows/generate,
   /api/v1/deploy), respond with x402 402 challenges. Fixed per-endpoint prices (e.g. $0.10 compile+audit,
   $1.00 deploy). Settlement in USDC on Base/Mantle; backend credits workspace once paid.

See: docs.cdp.coinbase.com/x402/welcome, x402.org/ecosystem
"""

from __future__ import annotations

import logging
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
    """
    Build 402 Payment Required response body for x402.
    Gateway or orchestrator returns this when external agent calls without payment.
    """
    return {
        "error": "payment_required",
        "code": "x402",
        "message": f"Endpoint requires payment: ${price_usd:.2f} USD",
        "price_usd": price_usd,
        "payment_url": payment_url,
        "settlement": "USDC on Base/Mantle",
    }
