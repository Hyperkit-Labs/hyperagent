"""
x402 enforcement middleware for FastAPI.

Intercepts protected endpoints and enforces the x402 payment protocol:
1. Checks if endpoint requires payment (via billing.get_endpoint_price)
2. Internal callers (Studio users with X-User-Id) skip x402; they use credits instead
3. External callers must provide a payment proof in the X-Payment header
4. Validates proof structure, expiry, and replay protection
5. Returns 402 Payment Required with challenge body if missing/invalid

This is the server-side enforcement layer referenced in all_findings.md.
Proof verification delegates to x402_verifier for cryptographic checks.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any

import billing
import db

# ---------------------------------------------------------------------------
# PayAI facilitator — settles ERC-3009 TransferWithAuthorization on-chain
# ---------------------------------------------------------------------------
_FACILITATOR_URL = os.environ.get(
    "X402_FACILITATOR_URL", "https://facilitator.payai.network"
).rstrip("/")
_FACILITATOR_ENABLED = os.environ.get(
    "X402_FACILITATOR_ENABLED", "1"
).strip().lower() in ("1", "true", "yes")


def _call_facilitator(
    proof: dict[str, Any], payment_requirements: dict[str, Any]
) -> tuple[bool, str]:
    """Submit the ERC-3009 payment proof to the PayAI facilitator for on-chain settlement.

    Returns (settled, tx_hash_or_error).
    Requires X402_FACILITATOR_ENABLED=1 (default) and X402_FACILITATOR_URL.

    The facilitator verifies the ERC-3009 TransferWithAuthorization signature
    and submits the USDC transfer on SKALE Base, so no gas is required from
    the payer or the server.
    """
    if not _FACILITATOR_ENABLED:
        return True, "facilitator_disabled"
    try:
        import httpx

        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{_FACILITATOR_URL}/settle",
                json={
                    "payment": proof,
                    "paymentRequirements": payment_requirements,
                },
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code in (200, 201):
                body = (
                    resp.json()
                    if resp.headers.get("content-type", "").startswith(
                        "application/json"
                    )
                    else {}
                )
                tx_hash = body.get("txHash") or body.get("tx_hash") or "settled"
                logger.info("[x402] facilitator settled payment: %s", tx_hash)
                return True, tx_hash
            logger.warning(
                "[x402] facilitator returned %d: %s", resp.status_code, resp.text[:200]
            )
            return False, f"facilitator_error_{resp.status_code}"
    except Exception as exc:
        logger.warning("[x402] facilitator call failed: %s", exc)
        if _facilitator_unreachable_allows_request():
            return True, f"facilitator_unreachable:{exc}"
        return False, f"facilitator_unreachable:{exc}"


from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger(__name__)

REPLAY_WINDOW_SECONDS = int(os.environ.get("X402_REPLAY_WINDOW", "300"))
_X402_MANDATORY_V01 = os.environ.get("X402_MANDATORY_V01", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

_nonce_cache: dict[str, float] = {}
_NONCE_CACHE_MAX = 10_000
_nonce_cache_warned = False


def _is_production_env() -> bool:
    """Match orchestrator main.py: cloud / production-shaped environments."""
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


def _facilitator_unreachable_allows_request() -> bool:
    """If True, facilitator HTTP errors still admit the request (no on-chain settlement proof).

    Default **False** in production-shaped environments so traffic is not accepted
    without settlement. Non-production defaults **True** for local dev; set
    ``X402_FACILITATOR_FAIL_OPEN=0`` to fail closed everywhere, or ``=1`` to allow
    (incident / lab only in prod).
    """
    raw = (os.environ.get("X402_FACILITATOR_FAIL_OPEN") or "").strip().lower()
    if raw in ("1", "true", "yes"):
        return True
    if raw in ("0", "false", "no"):
        return False
    return not _is_production_env()


def _effective_x402_enabled_env() -> str:
    """Effective ``X402_ENABLED`` string (read at call time).

    When unset: ``\"1\"`` in production-shaped env (payments on), else ``\"0\"``.
    Set ``X402_ENABLED=0`` explicitly to disable x402 in production (incident / lab only).
    """
    explicit = (os.environ.get("X402_ENABLED") or "").strip()
    if explicit:
        return explicit
    return "1" if _is_production_env() else "0"


def _redis_url_candidates() -> list[str]:
    urls: list[str] = []
    for key in ("REDIS_URL", "UPSTASH_REDIS_URL"):
        v = (os.environ.get(key) or "").strip()
        if v:
            urls.append(v)
    return urls


def _redis_configured_in_env() -> bool:
    """True when a TCP Redis URL is set (required for cross-worker nonce replay safety)."""
    return bool(_redis_url_candidates())


def _x402_allow_inmemory_nonce() -> bool:
    """Escape hatch for single-worker labs; never use in real multi-instance production."""
    return os.environ.get("X402_ALLOW_INMEMORY_NONCE", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _replay_backend_unacceptable_for_payment() -> bool:
    """x402 priced routes require a TCP Redis URL unless in-memory escape is set."""
    if not _is_x402_enabled():
        return False
    if _x402_allow_inmemory_nonce():
        return False
    return not _redis_configured_in_env()


def _get_redis_client() -> Any | None:
    """Return a Redis-compatible client, trying REDIS_URL then UPSTASH_REDIS_URL."""
    import redis

    for redis_url in _redis_url_candidates():
        try:
            return redis.from_url(redis_url, decode_responses=True)
        except Exception:
            continue
    return None


_redis: Any | None = None
_redis_checked = False


def _redis_client() -> Any | None:
    global _redis, _redis_checked
    if not _redis_checked:
        _redis_checked = True
        _redis = _get_redis_client()
        if _redis is None and not _replay_requires_redis_backend():
            logger.warning(
                "[x402] No working Redis client (check REDIS_URL / UPSTASH_REDIS_URL). "
                "Using in-memory nonce cache (single-worker dev only)."
            )
    return _redis


def _is_x402_enabled() -> bool:
    """x402 gate: X402_MANDATORY_V01 (hard enforcement), X402_ENABLED env, or registry flag."""
    if _X402_MANDATORY_V01:
        return True
    if _effective_x402_enabled_env().lower() in ("1", "true", "yes"):
        return True
    try:
        from registries import get_x402_enabled

        return get_x402_enabled()
    except ImportError:
        return False


def _replay_requires_redis_backend() -> bool:
    """When True, nonce replay must use Redis; in-memory fallback is forbidden."""
    return _is_x402_enabled() and not _x402_allow_inmemory_nonce()


def ensure_x402_redis_for_startup() -> None:
    """Fail fast when x402 is on but Redis is missing or unreachable (unless in-memory escape)."""
    if not _is_x402_enabled():
        return
    if _x402_allow_inmemory_nonce():
        logger.warning(
            "[x402] X402_ALLOW_INMEMORY_NONCE=1: replay protection is not safe across workers."
        )
        return
    if not _redis_configured_in_env():
        raise RuntimeError(
            "x402 is enabled but REDIS_URL or UPSTASH_REDIS_URL is not set. "
            "Use TCP Redis for cross-worker nonce replay protection, or set "
            "X402_ALLOW_INMEMORY_NONCE=1 only for approved single-worker setups."
        )
    global _redis, _redis_checked
    _redis_checked = False
    _redis = None
    client = _redis_client()
    if client is None:
        raise RuntimeError(
            "x402 is enabled but Redis client could not be created from REDIS_URL / UPSTASH_REDIS_URL."
        )
    try:
        client.ping()
    except Exception as exc:
        raise RuntimeError(f"x402 Redis ping failed: {exc}") from exc


def _x402_enforce_internal() -> bool:
    """When true, Studio callers (X-User-Id) cannot bypass priced routes; must send X-Payment."""
    return os.environ.get("X402_ENFORCE_INTERNAL", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _record_x402_replay_blocked() -> None:
    try:
        from observability import inc_x402_replay_blocked

        inc_x402_replay_blocked()
    except ImportError:
        pass


def _prune_nonce_cache() -> None:
    if len(_nonce_cache) < _NONCE_CACHE_MAX:
        return
    cutoff = time.time() - REPLAY_WINDOW_SECONDS
    stale = [k for k, v in _nonce_cache.items() if v < cutoff]
    for k in stale:
        del _nonce_cache[k]


def _check_replay(nonce: str) -> bool:
    """Return True if nonce was already seen (replay). False if fresh.

    Uses Redis SET NX with TTL when x402 requires Redis (enabled and not
    ``X402_ALLOW_INMEMORY_NONCE``). Otherwise prefers Redis but may fall back
    to an in-process dict for local development only.
    """
    global _nonce_cache_warned

    if _replay_requires_redis_backend():
        r = _redis_client()
        if r is None:
            raise RuntimeError(
                "x402 replay protection requires Redis but no client is available."
            )
        try:
            key = f"x402:nonce:{nonce}"
            was_set = r.set(key, "1", nx=True, ex=REPLAY_WINDOW_SECONDS)
            if not was_set:
                _record_x402_replay_blocked()
            return not was_set
        except Exception as exc:
            raise RuntimeError(f"x402 Redis nonce check failed: {exc}") from exc

    r = _redis_client()
    if r is not None:
        try:
            key = f"x402:nonce:{nonce}"
            was_set = r.set(key, "1", nx=True, ex=REPLAY_WINDOW_SECONDS)
            if not was_set:
                _record_x402_replay_blocked()
            return not was_set
        except Exception as exc:
            logger.warning(
                "[x402] Redis nonce check failed, falling back to memory: %s", exc
            )
            if _is_production_env() and _is_x402_enabled():
                raise RuntimeError(
                    "x402 Redis nonce check failed; refusing in-memory fallback in production"
                ) from exc

    if not _nonce_cache_warned and _is_production_env():
        _nonce_cache_warned = True
        logger.error(
            "[x402] PRODUCTION WARNING: in-memory nonce cache active. "
            "Replay protection is NOT safe across multiple workers. "
            "Set REDIS_URL or UPSTASH_REDIS_URL, or set X402_ALLOW_INMEMORY_NONCE=1 only for single-worker."
        )

    _prune_nonce_cache()
    if nonce in _nonce_cache:
        _record_x402_replay_blocked()
        return True
    _nonce_cache[nonce] = time.time()
    return False


def _v2_authorization_replay_key(proof: dict[str, Any]) -> str:
    """Stable replay key for x402 v2 exact payloads (ERC-3009 authorization nonce)."""
    try:
        pl = proof.get("payload")
        if isinstance(pl, dict):
            auth = pl.get("authorization")
            if isinstance(auth, dict) and auth.get("nonce") is not None:
                return f"v2:{proof.get('network', '')}:{auth.get('nonce')}"
    except Exception:
        pass
    return f"v2:{proof.get('network', '')}:{proof.get('payload', {})!s}"[:512]


def _parse_payment_header(raw: str) -> dict[str, Any] | None:
    """Parse X-Payment header. Expected: base64-encoded JSON with proof fields."""
    try:
        import base64

        decoded = base64.b64decode(raw)
        data = json.loads(decoded)
        if not isinstance(data, dict):
            return None
        return data
    except Exception:
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else None
        except Exception:
            return None


def _validate_proof_structure(
    proof: dict[str, Any], path: str, price_usd: float
) -> str | None:
    """Validate proof has required fields. Returns error string or None if valid."""
    required = ("nonce", "amount", "payer", "signature", "valid_before")
    for field in required:
        if field not in proof:
            return f"missing field: {field}"

    if not isinstance(proof["nonce"], str) or len(proof["nonce"]) < 8:
        return "nonce must be a string of at least 8 characters"

    try:
        amount = float(proof["amount"])
    except (TypeError, ValueError):
        return "amount must be a number"

    if amount < price_usd:
        return f"amount {amount} below required {price_usd}"

    try:
        valid_before = int(proof["valid_before"])
    except (TypeError, ValueError):
        return "valid_before must be a unix timestamp"

    if valid_before < time.time():
        return "payment proof expired"

    if _check_replay(proof["nonce"]):
        return "nonce already used (replay detected)"

    return None


def _log_x402_event(
    event: str,
    path: str,
    user_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {"event": event, "path": path}
    if user_id:
        payload["user_id"] = user_id
    if extra:
        payload.update(extra)
    logger.info("[x402] %s", json.dumps(payload))


class X402EnforcementMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that enforces x402 payment on protected endpoints."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if not _is_x402_enabled():
            return await call_next(request)

        path = request.url.path.rstrip("/")
        method = request.method.upper()

        price = billing.get_endpoint_price(path, method)
        if price is None:
            return await call_next(request)

        user_id = (
            request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
        ).strip() or None

        headers_dict = dict(request.headers)
        # X402_MANDATORY_V01 disables the internal-caller bypass so Studio users
        # must also present a valid payment proof on priced routes.
        if (
            billing.is_internal_caller(headers_dict, user_id)
            and not _x402_enforce_internal()
            and not _X402_MANDATORY_V01
        ):
            return await call_next(request)

        payment_header = request.headers.get("X-Payment") or request.headers.get(
            "x-payment"
        )
        if not payment_header:
            _log_x402_event("challenge_issued", path, extra={"price_usd": price})
            challenge = billing.x402_challenge_response(path, price)
            return Response(
                content=json.dumps(challenge),
                status_code=402,
                media_type="application/json",
                headers={"X-Payment-Required": "true"},
            )

        if _replay_backend_unacceptable_for_payment():
            _log_x402_event(
                "replay_backend_misconfigured",
                path,
                extra={"price_usd": price},
            )
            return Response(
                content=json.dumps(
                    {
                        "error": "service_unavailable",
                        "message": (
                            "x402 replay protection requires REDIS_URL or UPSTASH_REDIS_URL "
                            "in production. Set one of these, or X402_ALLOW_INMEMORY_NONCE=1 "
                            "only for approved single-worker deployments."
                        ),
                    }
                ),
                status_code=503,
                media_type="application/json",
            )

        proof = _parse_payment_header(payment_header)
        if proof is None:
            _log_x402_event("invalid_proof_format", path)
            return Response(
                content=json.dumps(
                    {
                        "error": "invalid_payment_proof",
                        "message": "Could not parse X-Payment header",
                    }
                ),
                status_code=402,
                media_type="application/json",
            )

        import x402_kite_facilitator
        import x402_verifier

        # --- x402 v2 "exact" (EIP-3009): @x402/fetch + facilitator verify/settle ---
        # Kite docs recommend Pieverse for verify/settle on supported CAIP networks.
        # SKALE Base is not on Pieverse; PayAI settle validates and executes there.
        if x402_kite_facilitator.is_exact_x402_v2_payload(proof):
            rkey = _v2_authorization_replay_key(proof)
            if _check_replay(rkey):
                _log_x402_event("proof_rejected", path, extra={"reason": "v2 replay"})
                return Response(
                    content=json.dumps(
                        {
                            "error": "payment_rejected",
                            "message": "authorization nonce already used (replay detected)",
                            "erc1066_code": x402_verifier.ERC1066_REPLAY,
                            "action": x402_verifier.erc1066_to_action(
                                x402_verifier.ERC1066_REPLAY
                            ),
                        }
                    ),
                    status_code=402,
                    media_type="application/json",
                )

            challenge = billing.x402_challenge_response(path, price)
            payment_requirements = challenge.get("paymentRequirements", {})
            net = proof.get("network")

            if x402_kite_facilitator.facilitator_supports_network(net):
                v_ok, v_err = x402_kite_facilitator.verify_payment(
                    proof, payment_requirements
                )
                if not v_ok:
                    _log_x402_event(
                        "facilitator_verify_failed",
                        path,
                        extra={"network": net, "detail": v_err},
                    )
                    return Response(
                        content=json.dumps(
                            {
                                "error": "payment_rejected",
                                "message": f"Facilitator verify failed: {v_err}",
                                "erc1066_code": x402_verifier.ERC1066_DISALLOWED,
                                "action": x402_verifier.erc1066_to_action(
                                    x402_verifier.ERC1066_DISALLOWED
                                ),
                            }
                        ),
                        status_code=402,
                        media_type="application/json",
                    )
                settled, tx_ref = x402_kite_facilitator.settle_payment(
                    proof, payment_requirements
                )
            else:
                settled, tx_ref = _call_facilitator(proof, payment_requirements)

            if not settled:
                _log_x402_event(
                    "settlement_failed",
                    path,
                    extra={"tx_ref": tx_ref, "network": net},
                )
                return Response(
                    content=json.dumps(
                        {
                            "error": "payment_settlement_failed",
                            "message": "Payment proof valid but on-chain settlement failed. Retry or contact support.",
                            "erc1066_code": x402_verifier.ERC1066_FAILURE,
                            "action": "retry",
                        }
                    ),
                    status_code=402,
                    media_type="application/json",
                )

            pl = proof.get("payload") if isinstance(proof.get("payload"), dict) else {}
            auth = pl.get("authorization") if isinstance(pl, dict) else {}
            payer_addr = (
                auth.get("from") if isinstance(auth, dict) else None
            ) or proof.get("payer")

            _log_x402_event(
                "proof_accepted",
                path,
                user_id=str(payer_addr) if payer_addr else None,
                extra={
                    "erc1066_code": x402_verifier.ERC1066_SUCCESS,
                    "tx_ref": tx_ref,
                    "x402_version": 2,
                },
            )
            request.state.x402_proof = proof
            request.state.x402_price = price
            request.state.erc1066_code = x402_verifier.ERC1066_SUCCESS
            request.state.x402_tx_ref = tx_ref
            return await call_next(request)

        validation_error = _validate_proof_structure(proof, path, price)
        if validation_error:
            # Map structural validation errors to ERC-1066 codes for consistent client handling.
            from x402_verifier import (
                ERC1066_EXPIRED,
                ERC1066_INSUFFICIENT,
                ERC1066_REPLAY,
                erc1066_to_action,
            )

            if "expired" in validation_error:
                erc_code = ERC1066_EXPIRED
            elif (
                "replay" in validation_error or "nonce already used" in validation_error
            ):
                erc_code = ERC1066_REPLAY
            elif "amount" in validation_error and "below" in validation_error:
                erc_code = ERC1066_INSUFFICIENT
            else:
                from x402_verifier import ERC1066_DISALLOWED

                erc_code = ERC1066_DISALLOWED

            _log_x402_event(
                "proof_rejected",
                path,
                extra={"reason": validation_error, "erc1066_code": erc_code},
            )
            return Response(
                content=json.dumps(
                    {
                        "error": "payment_rejected",
                        "message": validation_error,
                        "erc1066_code": erc_code,
                        "action": erc1066_to_action(erc_code),
                    }
                ),
                status_code=402,
                media_type="application/json",
            )

        # Cryptographic verification: ECDSA/EIP-191 signature check.
        # Validates that `payer` actually signed the canonical receipt string.
        sig_ok, erc1066_code = x402_verifier.verify_signature(proof)
        if not sig_ok:
            _log_x402_event(
                "signature_rejected",
                path,
                user_id=proof.get("payer"),
                extra={"erc1066_code": erc1066_code, "nonce": proof.get("nonce")},
            )
            return Response(
                content=json.dumps(
                    {
                        "error": "payment_rejected",
                        "message": "Invalid payment signature",
                        "erc1066_code": erc1066_code,
                        "action": x402_verifier.erc1066_to_action(erc1066_code),
                    }
                ),
                status_code=402,
                media_type="application/json",
            )

        # On-chain settlement via PayAI facilitator.
        # The facilitator submits the ERC-3009 TransferWithAuthorization
        # transaction on SKALE Base (gasless for the payer).
        payment_requirements = billing.x402_challenge_response(path, price).get(
            "paymentRequirements", {}
        )
        settled, tx_ref = _call_facilitator(proof, payment_requirements)
        if not settled:
            _log_x402_event(
                "settlement_failed",
                path,
                user_id=proof.get("payer"),
                extra={"tx_ref": tx_ref, "nonce": proof.get("nonce")},
            )

            return Response(
                content=json.dumps(
                    {
                        "error": "payment_settlement_failed",
                        "message": "Payment proof valid but on-chain settlement failed. Retry or contact support.",
                        "erc1066_code": x402_verifier.ERC1066_FAILURE,
                        "action": "retry",
                    }
                ),
                status_code=402,
                media_type="application/json",
            )

        _log_x402_event(
            "proof_accepted",
            path,
            user_id=proof.get("payer"),
            extra={
                "amount": proof.get("amount"),
                "nonce": proof.get("nonce"),
                "erc1066_code": erc1066_code,
                "tx_ref": tx_ref,
            },
        )

        request.state.x402_proof = proof
        request.state.x402_price = price
        request.state.erc1066_code = erc1066_code
        request.state.x402_tx_ref = tx_ref

        return await call_next(request)
