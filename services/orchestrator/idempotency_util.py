"""
Idempotency key helpers for HTTP handlers, webhooks, queue consumers, and billing.

Pattern:
- Clients send ``Idempotency-Key`` (or ``X-Idempotency-Key``) on mutating requests.
- Keys are scoped per user/workspace; composite storage keys avoid cross-tenant collisions.
- For distributed deduplication, prefer ``SET key NX EX ttl`` on Redis before side effects
  (same REDIS_URL TCP pool as the pipeline queue when available).

See docs/workflow-state-management.md.
"""

from __future__ import annotations

import hashlib
import re

# Stripe-style keys are typically 1–255 chars; we hash oversized inputs.
_MAX_LEN = 255

_SAFE_KEY = re.compile(r"^[A-Za-z0-9._-]{1,255}$")


def normalize_idempotency_key(raw: str | None) -> str | None:
    """Return a stable key suitable for storage, or None if empty."""
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    if len(s) > _MAX_LEN or not _SAFE_KEY.match(s):
        return hashlib.sha256(s.encode("utf-8")).hexdigest()
    return s


def composite_idempotency_key(principal_id: str, key: str | None) -> str | None:
    """Namespace key under a user/run principal for dedupe lookups."""
    n = normalize_idempotency_key(key)
    if not n:
        return None
    pid = (principal_id or "").strip()
    if not pid:
        return n
    return f"{pid}:{n}"


def redis_dedupe_key(namespace: str, composite: str) -> str:
    """Key for SET NX idempotency locks (prefix keeps queues separate)."""
    ns = (namespace or "default").strip() or "default"
    return f"idempotency:{ns}:{composite}"
