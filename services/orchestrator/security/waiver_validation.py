"""Validate waiver metadata. WAIVED must always carry human evidence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def get_waiver_requirements() -> list[str]:
    try:
        from .policy_loader import get_waiver_requirements as _get
        return _get()
    except Exception:
        return [
            "approver_id",
            "approver_role",
            "reason",
            "expiry_at",
            "evidence_refs",
            "linked_run_id",
        ]


def has_valid_waiver(finding: dict[str, Any]) -> bool:
    """True if finding has valid waiver metadata (approver, reason, expiry, evidence)."""
    waiver = finding.get("waiver") or finding.get("waiver_metadata")
    if not waiver or not isinstance(waiver, dict):
        return False
    req = get_waiver_requirements()
    for key in req:
        map_key = key.replace("_", "")
        val = waiver.get(key) or waiver.get(map_key)
        if val is None or (isinstance(val, str) and not val.strip()):
            return False
    expiry = waiver.get("expiry_at") or waiver.get("expiryAt")
    if expiry:
        try:
            if isinstance(expiry, (int, float)):
                exp_dt = datetime.fromtimestamp(expiry, tz=timezone.utc)
            else:
                exp_dt = datetime.fromisoformat(str(expiry).replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                return False
        except Exception:
            return False
    return True
