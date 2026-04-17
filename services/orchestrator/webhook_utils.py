"""Shared helpers for signed inbound webhooks (HMAC-SHA256 body verification)."""

from __future__ import annotations

import hashlib
import hmac


def verify_hmac_sha256(body: bytes, signature_header: str | None, secret: str) -> bool:
    """Return True when signature_header matches HMAC-SHA256(secret, body).

    Accepts a raw hex digest or a ``sha256=<hex>`` prefix (case-insensitive).
    """
    if not secret or not signature_header:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    sig = signature_header.strip()
    if sig.lower().startswith("sha256="):
        sig = sig.split("=", 1)[1].strip()
    return hmac.compare_digest(digest, sig)
