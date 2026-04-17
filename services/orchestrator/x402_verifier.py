"""
x402 cryptographic proof verifier with ERC-1066 status codes.

This is the module referenced in x402_middleware.py's docstring. It provides:
1. ERC-1066 status constants matching the hyperkit-erc1066 TypeScript SDK.
2. ECDSA/EIP-191 signature verification using eth-account (from web3.py).
3. A single public function: verify_signature(proof) → (ok, erc1066_code).

Status code source of truth: hyperkit-erc1066 npm SDK (ERC1066Client.mapStatusToAction):
  0x01 → execute (payment accepted)
  0x54 → request_payment (payment required / insufficient)
  0x20 → retry (too early)
  0x21 → deny (too late / expired)
  0x10 → deny (disallowed / invalid signature / policy violation)
  0x22 → deny (already executed / replay)
  0x00 → deny (generic failure)

The Python SDK (hyperkit-erc1066 Python package) is not yet published on PyPI.
All verification is done with eth-account which is already available via web3>=6.0.0.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ERC-1066 status codes — mirrors hyperkit-erc1066 TypeScript SDK types.ts
# ---------------------------------------------------------------------------

ERC1066_SUCCESS = "0x01"  # Payment accepted / execute
ERC1066_FAILURE = "0x00"  # Generic unclassified failure
ERC1066_DISALLOWED = "0x10"  # Invalid signature / policy violation
ERC1066_TOO_EARLY = "0x20"  # Nonce not yet valid
ERC1066_EXPIRED = "0x21"  # Proof past valid_before timestamp
ERC1066_REPLAY = "0x22"  # Nonce already consumed
ERC1066_INSUFFICIENT = "0x54"  # Amount too low / payment required


def _rebuild_receipt(proof: dict[str, Any]) -> str:
    """Reconstruct the canonical receipt string the client signed.

    Must produce an identical string to buildX402Receipt() in apps/studio/lib/x402Client.ts:
      JSON.stringify({ nonce, amount, payer, valid_before, [pay_to], [network] })

    TypeScript JSON.stringify uses compact output with no spaces and preserves
    insertion order. Python 3.7+ maintains dict insertion order so we build
    the dict in the same key sequence and use separators=(',', ':').
    """
    receipt: dict[str, Any] = {
        "nonce": proof["nonce"],
        "amount": proof["amount"],
        "payer": proof["payer"],
        "valid_before": proof["valid_before"],
    }
    if proof.get("pay_to"):
        receipt["pay_to"] = proof["pay_to"]
    if proof.get("network"):
        receipt["network"] = proof["network"]
    return json.dumps(receipt, separators=(",", ":"), ensure_ascii=False)


def verify_signature(proof: dict[str, Any]) -> tuple[bool, str]:
    """Verify the ECDSA/EIP-191 payment proof signature.

    Args:
        proof: Parsed X-Payment proof dict. Must contain: nonce, amount, payer,
               signature, valid_before. Optionally: pay_to, network.

    Returns:
        (ok, erc1066_code): True + 0x01 on success; False + error code on failure.

    The payer field is compared case-insensitively (Ethereum addresses are
    case-insensitive; EIP-55 checksum casing varies by client).
    """
    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
    except ImportError:
        logger.error(
            "[x402_verifier] eth-account not available. "
            "Install web3>=6.0.0 or eth-account>=0.10.0 to enable signature verification."
        )
        return False, ERC1066_FAILURE

    signature = proof.get("signature", "")
    payer = proof.get("payer", "")

    if not signature or not payer:
        logger.warning("[x402_verifier] missing signature or payer field")
        return False, ERC1066_DISALLOWED

    try:
        receipt = _rebuild_receipt(proof)
        message = encode_defunct(text=receipt)
        recovered = Account.recover_message(message, signature=signature)

        if recovered.lower() == payer.lower():
            logger.debug(
                "[x402_verifier] signature OK payer=%s nonce=%s",
                payer,
                proof.get("nonce"),
            )
            return True, ERC1066_SUCCESS

        logger.warning(
            "[x402_verifier] signature mismatch: recovered=%s claimed_payer=%s nonce=%s",
            recovered,
            payer,
            proof.get("nonce"),
        )
        return False, ERC1066_DISALLOWED

    except ValueError as exc:
        # Invalid hex in signature, wrong signature length, etc.
        logger.warning("[x402_verifier] malformed signature: %s", exc)
        return False, ERC1066_DISALLOWED
    except Exception as exc:
        logger.error(
            "[x402_verifier] unexpected verification error: %s", exc, exc_info=True
        )
        return False, ERC1066_FAILURE


def erc1066_to_action(code: str) -> str:
    """Map an ERC-1066 code to the action string matching mapStatusToAction() in the TS SDK."""
    return {
        ERC1066_SUCCESS: "execute",
        ERC1066_TOO_EARLY: "retry",
        ERC1066_INSUFFICIENT: "request_payment",
    }.get(code, "deny")
