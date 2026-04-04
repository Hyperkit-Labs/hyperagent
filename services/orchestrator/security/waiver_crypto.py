"""Canonical hashing and HMAC verification for waiver evidence API."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any


def canonical_json_bytes(obj: dict[str, Any]) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def payload_sha256(obj: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json_bytes(obj)).hexdigest()


def verify_hmac_sha256(secret: str, payload: dict[str, Any], sig_hex: str) -> bool:
    if not secret or not sig_hex:
        return False
    expected = hmac.new(
        secret.encode("utf-8"), canonical_json_bytes(payload), hashlib.sha256
    ).hexdigest()
    try:
        return hmac.compare_digest(expected, sig_hex.strip().lower())
    except Exception:
        return False
