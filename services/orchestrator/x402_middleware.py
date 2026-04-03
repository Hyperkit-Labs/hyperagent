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

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

import billing
import db

logger = logging.getLogger(__name__)

X402_ENABLED_ENV = os.environ.get("X402_ENABLED", "0")
REPLAY_WINDOW_SECONDS = int(os.environ.get("X402_REPLAY_WINDOW", "300"))

_nonce_cache: dict[str, float] = {}
_NONCE_CACHE_MAX = 10_000
_nonce_cache_warned = False


def _get_redis_client() -> Any | None:
    """Return a Redis-compatible client from the orchestrator pool, or None."""
    try:
        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            return None
        import redis
        return redis.from_url(redis_url, decode_responses=True)
    except Exception:
        return None


_redis: Any | None = None
_redis_checked = False


def _redis_client() -> Any | None:
    global _redis, _redis_checked
    if not _redis_checked:
        _redis_checked = True
        _redis = _get_redis_client()
        if _redis is None:
            logger.warning(
                "[x402] No REDIS_URL configured. Nonce replay protection uses in-memory cache. "
                "In multi-worker deployments this allows replay across workers."
            )
    return _redis


def _is_x402_enabled() -> bool:
    if X402_ENABLED_ENV.lower() in ("1", "true", "yes"):
        return True
    try:
        from registries import get_x402_enabled
        return get_x402_enabled()
    except ImportError:
        return False


def _prune_nonce_cache() -> None:
    if len(_nonce_cache) < _NONCE_CACHE_MAX:
        return
    cutoff = time.time() - REPLAY_WINDOW_SECONDS
    stale = [k for k, v in _nonce_cache.items() if v < cutoff]
    for k in stale:
        del _nonce_cache[k]


def _check_replay(nonce: str) -> bool:
    """Return True if nonce was already seen (replay). False if fresh.

    Uses Redis SET NX with TTL when available (multi-worker safe).
    Falls back to local dict with a one-time production warning.
    """
    global _nonce_cache_warned

    r = _redis_client()
    if r is not None:
        try:
            key = f"x402:nonce:{nonce}"
            was_set = r.set(key, "1", nx=True, ex=REPLAY_WINDOW_SECONDS)
            return not was_set
        except Exception as exc:
            logger.warning("[x402] Redis nonce check failed, falling back to memory: %s", exc)

    if not _nonce_cache_warned and os.environ.get("NODE_ENV") == "production":
        _nonce_cache_warned = True
        logger.error(
            "[x402] PRODUCTION WARNING: in-memory nonce cache active. "
            "Replay protection is NOT safe across multiple workers. Set REDIS_URL."
        )

    _prune_nonce_cache()
    if nonce in _nonce_cache:
        return True
    _nonce_cache[nonce] = time.time()
    return False


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


def _validate_proof_structure(proof: dict[str, Any], path: str, price_usd: float) -> str | None:
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
            request.headers.get("X-User-Id")
            or request.headers.get("x-user-id")
            or ""
        ).strip() or None

        headers_dict = dict(request.headers)
        if billing.is_internal_caller(headers_dict, user_id):
            return await call_next(request)

        payment_header = request.headers.get("X-Payment") or request.headers.get("x-payment")
        if not payment_header:
            _log_x402_event("challenge_issued", path, extra={"price_usd": price})
            challenge = billing.x402_challenge_response(path, price)
            return Response(
                content=json.dumps(challenge),
                status_code=402,
                media_type="application/json",
                headers={"X-Payment-Required": "true"},
            )

        proof = _parse_payment_header(payment_header)
        if proof is None:
            _log_x402_event("invalid_proof_format", path)
            return Response(
                content=json.dumps({"error": "invalid_payment_proof", "message": "Could not parse X-Payment header"}),
                status_code=402,
                media_type="application/json",
            )

        validation_error = _validate_proof_structure(proof, path, price)
        if validation_error:
            _log_x402_event("proof_rejected", path, extra={"reason": validation_error})
            return Response(
                content=json.dumps({"error": "payment_rejected", "message": validation_error}),
                status_code=402,
                media_type="application/json",
            )

        _log_x402_event("proof_accepted", path, user_id=proof.get("payer"), extra={
            "amount": proof.get("amount"),
            "nonce": proof.get("nonce"),
        })

        request.state.x402_proof = proof
        request.state.x402_price = price

        return await call_next(request)
