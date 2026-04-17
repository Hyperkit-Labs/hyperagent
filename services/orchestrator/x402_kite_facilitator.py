"""
Kite-aligned x402 facilitator client (Pieverse).

Official Kite docs recommend the Pieverse facilitator for x402 verify/settle on Kite and other supported chains:
  https://docs.gokite.ai/kite-agent-passport/service-provider-guide

Endpoints (facilitator base URL, default https://facilitator.pieverse.io):
  POST {base}/v2/verify  — verify payment signature
  POST {base}/v2/settle — settle on-chain

This is not an LLM API. It complements local EIP-191 verification in
x402_verifier.py for legacy HyperAgent receipts.

Env:
  KITE_X402_FACILITATOR_URL — default https://facilitator.pieverse.io
  KITE_X402_VERIFY_ENABLED  — 1 (default) to call /v2/verify for v2 exact payloads
  KITE_X402_SETTLE_ENABLED  — 1 (default) to call /v2/settle after verify"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_BASE = "https://facilitator.pieverse.io"
_FAC_BASE = os.environ.get("KITE_X402_FACILITATOR_URL", _DEFAULT_BASE).rstrip("/")
_VERIFY_ON = os.environ.get("KITE_X402_VERIFY_ENABLED", "1").strip().lower() in (
    "1",
    "true",
    "yes",
)
_SETTLE_ON = os.environ.get("KITE_X402_SETTLE_ENABLED", "1").strip().lower() in (
    "1",
    "true",
    "yes",
)


@lru_cache(maxsize=1)
def _pieverse_supported_networks() -> frozenset[str]:
    """CAIP-2 network ids accepted by the configured facilitator (Pieverse)."""
    try:
        with httpx.Client(timeout=8.0) as client:
            r = client.get(f"{_FAC_BASE}/v2/supported")
            if r.status_code != 200:
                return frozenset()
            data = r.json()
            kinds = data.get("kinds") or []
            nets = [k.get("network") for k in kinds if k.get("network")]
            return frozenset(str(n) for n in nets if n)
    except Exception as exc:
        logger.warning("[x402_kite] could not fetch /v2/supported: %s", exc)
        return frozenset()


def facilitator_base_url() -> str:
    return _FAC_BASE


def is_exact_x402_v2_payload(proof: dict[str, Any]) -> bool:
    """True when X-Payment decodes to an x402 v2 *exact* scheme payment payload."""
    if proof.get("x402Version") == 2 and proof.get("scheme") == "exact":
        return isinstance(proof.get("payload"), dict)
    if proof.get("scheme") == "exact" and isinstance(proof.get("payload"), dict):
        return True
    return False


def facilitator_supports_network(network: str | None) -> bool:
    if not network:
        return False
    supported = _pieverse_supported_networks()
    if not supported:
        # Fail closed: without /v2/supported we cannot assert support.
        return False
    return network in supported


def merge_payment_requirements(
    payment_requirements: dict[str, Any],
) -> dict[str, Any]:
    """Ensure facilitator-required fields (x402Version, CAIP network) are present."""
    out = dict(payment_requirements)
    out.setdefault("x402Version", 2)
    return out


def verify_payment(
    payment_payload: dict[str, Any],
    payment_requirements: dict[str, Any],
) -> tuple[bool, str]:
    if not _VERIFY_ON:
        return True, "verify_disabled"
    body = {
        "x402Version": 2,
        "paymentPayload": payment_payload,
        "paymentRequirements": merge_payment_requirements(payment_requirements),
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{_FAC_BASE}/v2/verify",
                json=body,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code in (200, 201):
                data = (
                    resp.json()
                    if resp.headers.get("content-type", "").startswith(
                        "application/json"
                    )
                    else {}
                )
                if data.get("error"):
                    return False, str(data.get("error"))
                if data.get("isValid") is False or data.get("valid") is False:
                    return False, str(
                        data.get("invalidReason")
                        or data.get("invalidMessage")
                        or data.get("reason")
                        or data.get("message")
                        or "verify_rejected"
                    )
                if data.get("isValid") is True or data.get("valid") is True:
                    return True, "ok"
                return False, f"unrecognized_verify_response:{str(data)[:180]}"
            return False, f"verify_http_{resp.status_code}:{resp.text[:200]}"
    except Exception as exc:
        logger.warning("[x402_kite] verify failed: %s", exc)
        return False, str(exc)


def settle_payment(
    payment_payload: dict[str, Any],
    payment_requirements: dict[str, Any],
) -> tuple[bool, str]:
    if not _SETTLE_ON:
        return True, "settle_disabled"
    body = {
        "x402Version": 2,
        "paymentPayload": payment_payload,
        "paymentRequirements": merge_payment_requirements(payment_requirements),
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{_FAC_BASE}/v2/settle",
                json=body,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code in (200, 201):
                data = (
                    resp.json()
                    if resp.headers.get("content-type", "").startswith(
                        "application/json"
                    )
                    else {}
                )
                tx = (
                    data.get("txHash")
                    or data.get("tx_hash")
                    or data.get("transactionHash")
                    or "settled"
                )
                return True, str(tx)
            return False, f"settle_http_{resp.status_code}:{resp.text[:200]}"
    except Exception as exc:
        logger.warning("[x402_kite] settle failed: %s", exc)
        return False, str(exc)
