"""Optional second Supabase (waitlist project) for public waitlist metrics on /platform/track-record.

Aggregate counts must match the waitlist Next.js app public API:
  waitlist/src/app/api/stats/route.ts
so the Studio login track record shows the same numbers as waitlist.hyperkitlabs.com.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _waitlist_credentials() -> tuple[str, str]:
    url = os.environ.get("WAITLIST_SUPABASE_URL", "").strip()
    key = os.environ.get("WAITLIST_SUPABASE_SERVICE_KEY", "").strip()
    return url, key


def is_waitlist_configured() -> bool:
    u, k = _waitlist_credentials()
    return bool(u and k)


def _execute_count(builder: Any) -> int:
    """Run a head+exact count query; return 0 if count missing."""
    r = builder.execute()
    return int(getattr(r, "count", 0) or 0)


def get_waitlist_public_stats() -> dict[str, int] | None:
    """Return {total, confirmed, pending} aligned with waitlist /api/stats.

    - total: all waitlist_entries rows
    - confirmed: email_confirmed OR status=confirmed (same OR filter as waitlist)
    - pending: email_confirmed false AND status pending

    Returns None when waitlist env is not set or on failure (endpoint omits waitlist fields).
    """
    if not is_waitlist_configured():
        return None
    url, key = _waitlist_credentials()
    try:
        from supabase import create_client

        client = create_client(url, key)

        total = _execute_count(
            client.table("waitlist_entries").select("*", count="exact", head=True)
        )

        confirmed = _execute_count(
            client.table("waitlist_entries")
            .select("*", count="exact", head=True)
            .or_("email_confirmed.eq.true,status.eq.confirmed")
        )

        pending = _execute_count(
            client.table("waitlist_entries")
            .select("*", count="exact", head=True)
            .eq("email_confirmed", False)
            .eq("status", "pending")
        )

        return {
            "total": total,
            "confirmed": confirmed,
            "pending": pending,
        }
    except Exception as e:
        logger.warning("[waitlist] public stats failed: %s", e)
        return None


def count_confirmed_beta_testers() -> int | None:
    """Confirmed waitlist count (OR semantics). None if waitlist not configured or on error."""
    stats = get_waitlist_public_stats()
    return None if stats is None else stats["confirmed"]
