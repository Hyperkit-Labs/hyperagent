"""Optional second Supabase (waitlist project) for beta metrics on /platform/track-record."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def _waitlist_credentials() -> tuple[str, str]:
    url = os.environ.get("WAITLIST_SUPABASE_URL", "").strip()
    key = os.environ.get("WAITLIST_SUPABASE_SERVICE_KEY", "").strip()
    return url, key


def is_waitlist_configured() -> bool:
    u, k = _waitlist_credentials()
    return bool(u and k)


def count_confirmed_beta_testers() -> int | None:
    """Count waitlist rows with status=confirmed and email_confirmed=true.

    Returns None when waitlist env is not set or on failure (endpoint omits field).
    """
    if not is_waitlist_configured():
        return None
    url, key = _waitlist_credentials()
    try:
        from supabase import create_client

        client = create_client(url, key)
        r = (
            client.table("waitlist_entries")
            .select("id", count="exact")
            .eq("status", "confirmed")
            .eq("email_confirmed", True)
            .execute()
        )
        return int(getattr(r, "count", 0) or 0)
    except Exception as e:
        logger.warning("[waitlist] confirmed beta count failed: %s", e)
        return None
