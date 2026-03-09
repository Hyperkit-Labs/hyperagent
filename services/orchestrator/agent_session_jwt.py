"""
Short-lived agent session JWT (Option B): api_keys encrypted inside token with shared secret.
Orchestrator creates; agent-runtime verifies and decrypts. Keys never in body or logs.
"""

from __future__ import annotations

import base64
import json
import os
import time

import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

JWT_ISSUER = "hyperagent-orchestrator"
JWT_ALG = "HS256"
AGENT_SESSION_EXP_MINUTES = 15


def _get_payload_key() -> bytes:
    raw = os.environ.get("AGENT_SESSION_PAYLOAD_KEY")
    if not raw or len(raw) < 32:
        raise ValueError(
            "AGENT_SESSION_PAYLOAD_KEY must be set and at least 32 bytes (e.g. base64)"
        )
    if len(raw) == 32 and raw.isascii():
        return raw.encode("utf-8")
    try:
        return base64.b64decode(raw)
    except Exception:
        return raw.encode("utf-8")[:32].ljust(32, b"\0")


def _encrypt_api_keys(api_keys: dict[str, str], key: bytes) -> str:
    aes = AESGCM(key)
    plain = json.dumps(api_keys, sort_keys=True).encode("utf-8")
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, plain, None)
    return base64.b64encode(nonce + ct).decode("ascii")


def _decrypt_api_keys(enc_b64: str, key: bytes) -> dict[str, str]:
    aes = AESGCM(key)
    raw = base64.b64decode(enc_b64)
    if len(raw) < 13:
        return {}
    nonce, ct = raw[:12], raw[12:]
    plain = aes.decrypt(nonce, ct, None).decode("utf-8")
    return json.loads(plain)


def create_agent_session_jwt(
    sub: str,
    run_id: str,
    api_keys: dict[str, str],
    exp_minutes: int = AGENT_SESSION_EXP_MINUTES,
) -> str:
    """Build JWT with encrypted api_keys. Sign with JWT_SECRET_KEY."""
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        raise ValueError("JWT_SECRET_KEY must be set to create agent session JWT")
    payload_key = _get_payload_key()
    api_keys_enc = _encrypt_api_keys(api_keys or {}, payload_key)
    now = int(time.time())
    payload = {
        "sub": sub,
        "run_id": run_id,
        "api_keys_enc": api_keys_enc,
        "exp": now + exp_minutes * 60,
        "iat": now,
        "iss": JWT_ISSUER,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALG)


def verify_and_decrypt_agent_session(token: str) -> tuple[str, str, dict[str, str]]:
    """Verify JWT and decrypt api_keys. Returns (sub, run_id, api_keys). Raises on invalid token."""
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        raise ValueError("JWT_SECRET_KEY not set")
    payload_key = _get_payload_key()
    payload = jwt.decode(
        token,
        secret,
        algorithms=[JWT_ALG],
        issuer=JWT_ISSUER,
    )
    sub = payload.get("sub") or ""
    run_id = payload.get("run_id") or ""
    api_keys_enc = payload.get("api_keys_enc")
    if not api_keys_enc:
        return sub, run_id, {}
    api_keys = _decrypt_api_keys(api_keys_enc, payload_key)
    return sub, run_id, api_keys
