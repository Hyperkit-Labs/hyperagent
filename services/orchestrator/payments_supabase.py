"""
x402 payment history and spending controls persistence.
Uses wallet_users.id (X-User-Id from gateway). Reads/writes payment_history and spending_controls.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import db

logger = logging.getLogger(__name__)


def _client():
    return db._client()


def is_configured() -> bool:
    return db.is_configured()


def get_payment_history(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Return (items, total) for user_id. Paginated."""
    if not user_id or not is_configured():
        return [], 0
    client = _client()
    if not client:
        return [], 0
    try:
        r = (
            client.table("payment_history")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = list(r.data) if r.data else []
        total = int(getattr(r, "count", None) or 0)
        for row in items:
            if "amount" in row and row["amount"] is not None and not isinstance(row["amount"], (int, float)):
                try:
                    row["amount"] = float(Decimal(str(row["amount"])))
                except Exception:
                    row["amount"] = 0.0
        return items, total
    except Exception as e:
        logger.warning("[payments] get_payment_history user_id=%s error=%s", user_id, e)
        return [], 0


def get_payment_summary(user_id: str) -> dict[str, Any]:
    """Aggregate total spent for user_id (all time and current period)."""
    if not user_id or not is_configured():
        return {"total": "0", "currency": "USD", "total_count": 0}
    client = _client()
    if not client:
        return {"total": "0", "currency": "USD", "total_count": 0}
    try:
        r = (
            client.table("payment_history")
            .select("amount, currency")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
        )
        rows = list(r.data) if r.data else []
        total = sum(float(Decimal(str(row.get("amount") or 0))) for row in rows)
        currency = (rows[0].get("currency") or "USD") if rows else "USD"
        return {"total": str(round(total, 2)), "currency": currency, "total_count": len(rows)}
    except Exception as e:
        logger.warning("[payments] get_payment_summary user_id=%s error=%s", user_id, e)
        return {"total": "0", "currency": "USD", "total_count": 0}


def get_spending_control(user_id: str) -> dict[str, Any] | None:
    """Return spending_controls row for user_id or None."""
    if not user_id or not is_configured():
        return None
    client = _client()
    if not client:
        return None
    try:
        r = client.table("spending_controls").select("*").eq("user_id", user_id).execute()
        row = (r.data or [None])[0] if r.data else None
        if row and "budget_amount" in row and row["budget_amount"] is not None:
            if not isinstance(row["budget_amount"], (int, float)):
                try:
                    row["budget_amount"] = float(Decimal(str(row["budget_amount"])))
                except Exception:
                    row["budget_amount"] = 0.0
        return row
    except Exception as e:
        logger.warning("[payments] get_spending_control user_id=%s error=%s", user_id, e)
        return None


def upsert_spending_control(
    user_id: str,
    budget_amount: float,
    budget_currency: str = "USD",
    period: str = "monthly",
    alert_threshold_percent: int = 80,
) -> dict[str, Any] | None:
    """Insert or update spending_controls for user_id. Returns row or None."""
    if not user_id or not is_configured():
        return None
    client = _client()
    if not client:
        return None
    if period not in ("daily", "weekly", "monthly"):
        period = "monthly"
    alert_threshold_percent = max(0, min(100, int(alert_threshold_percent)))
    try:
        payload = {
            "user_id": user_id,
            "budget_amount": str(budget_amount),
            "budget_currency": budget_currency or "USD",
            "period": period,
            "alert_threshold_percent": alert_threshold_percent,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        r = client.table("spending_controls").upsert(payload, on_conflict="user_id").execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[payments] upsert_spending_control user_id=%s error=%s", user_id, e)
        return None


def insert_payment(
    user_id: str,
    amount: float,
    currency: str = "USD",
    resource_id: str | None = None,
    endpoint: str | None = None,
    network: str | None = None,
    transaction_hash: str | None = None,
    status: str = "completed",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Append a payment record. Used when a paid action completes."""
    if not user_id or not is_configured():
        return None
    client = _client()
    if not client:
        return None
    if status not in ("pending", "completed", "failed", "refunded"):
        status = "completed"
    try:
        row = {
            "user_id": user_id,
            "amount": str(amount),
            "currency": currency or "USD",
            "resource_id": resource_id,
            "endpoint": endpoint,
            "network": network,
            "transaction_hash": transaction_hash,
            "status": status,
            "metadata": metadata or {},
        }
        r = client.table("payment_history").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[payments] insert_payment user_id=%s error=%s", user_id, e)
        return None
