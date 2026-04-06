"""
x402 payment history and spending controls persistence.
Uses wallet_users.id (X-User-Id from gateway). Reads/writes payment_history and spending_controls.
"""

from __future__ import annotations

import logging
import time
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
            if (
                "amount" in row
                and row["amount"] is not None
                and not isinstance(row["amount"], (int, float))
            ):
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
        return {
            "total": str(round(total, 2)),
            "currency": currency,
            "total_count": len(rows),
        }
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
        r = (
            client.table("spending_controls")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        row = (r.data or [None])[0] if r.data else None
        if row and "budget_amount" in row and row["budget_amount"] is not None:
            if not isinstance(row["budget_amount"], (int, float)):
                try:
                    row["budget_amount"] = float(Decimal(str(row["budget_amount"])))
                except Exception:
                    row["budget_amount"] = 0.0
        return row
    except Exception as e:
        logger.warning(
            "[payments] get_spending_control user_id=%s error=%s", user_id, e
        )
        return None


def upsert_spending_control(
    user_id: str,
    budget_amount: float,
    budget_currency: str = "USD",
    period: str = "monthly",
    alert_threshold_percent: int = 80,
) -> dict[str, Any] | None:
    """Insert or update spending_controls for user_id. Returns row or None.
    Uses atomic RPC when available to avoid race conditions under concurrent load."""
    if not user_id or not is_configured():
        return None
    client = _client()
    if not client:
        return None
    if period not in ("daily", "weekly", "monthly"):
        period = "monthly"
    alert_threshold_percent = max(0, min(100, int(alert_threshold_percent)))
    for attempt in range(5):
        try:
            r = client.rpc(
                "upsert_spending_control",
                {
                    "p_user_id": user_id,
                    "p_budget_amount": str(budget_amount),
                    "p_budget_currency": budget_currency or "USD",
                    "p_period": period,
                    "p_alert_threshold_percent": alert_threshold_percent,
                },
            ).execute()
            data = r.data
            if data is None:
                return _upsert_spending_control_fallback(
                    user_id,
                    budget_amount,
                    budget_currency,
                    period,
                    alert_threshold_percent,
                )
            row = data[0] if isinstance(data, list) and data else data
            if not isinstance(row, dict):
                return _upsert_spending_control_fallback(
                    user_id,
                    budget_amount,
                    budget_currency,
                    period,
                    alert_threshold_percent,
                )
            return {
                "user_id": user_id,
                "budget_amount": float(row.get("budget_amount", budget_amount)),
                "budget_currency": str(row.get("budget_currency", budget_currency)),
                "period": str(row.get("period", period)),
                "alert_threshold_percent": int(
                    row.get("alert_threshold_percent", alert_threshold_percent)
                ),
            }
        except Exception as e:
            logger.warning(
                "[payments] upsert_spending_control RPC attempt=%s user_id=%s error=%s",
                attempt + 1,
                user_id,
                e,
            )
            if attempt < 4:
                time.sleep(0.15 * (attempt + 1))
            else:
                return _upsert_spending_control_fallback(
                    user_id,
                    budget_amount,
                    budget_currency,
                    period,
                    alert_threshold_percent,
                )
    return None


def _upsert_spending_control_fallback(
    user_id: str,
    budget_amount: float,
    budget_currency: str,
    period: str,
    alert_threshold_percent: int,
) -> dict[str, Any] | None:
    """Fallback when RPC not available (e.g. migration not run). Retries on transient failure."""
    client = _client()
    if not client:
        return None
    for attempt in range(4):
        try:
            payload = {
                "user_id": user_id,
                "budget_amount": str(budget_amount),
                "budget_currency": budget_currency or "USD",
                "period": period,
                "alert_threshold_percent": alert_threshold_percent,
                "updated_at": datetime.now(UTC).isoformat(),
            }
            r = (
                client.table("spending_controls")
                .upsert(payload, on_conflict="user_id")
                .execute()
            )
            return r.data[0] if r.data else None
        except Exception as e:
            logger.warning(
                "[payments] upsert_spending_control fallback attempt=%s user_id=%s error=%s",
                attempt + 1,
                user_id,
                e,
            )
            if attempt < 3:
                time.sleep(0.2 * (attempt + 1))
            else:
                return None
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
    idempotency_key: str | None = None,
) -> dict[str, Any] | None:
    """Append a payment record with idempotency protection.

    When idempotency_key is provided, duplicate inserts with the same key
    return the existing row instead of creating a new record. This prevents
    double-charging on retries and duplicate payment entries.
    """
    if not user_id or not is_configured():
        return None
    client = _client()
    if not client:
        return None
    if status not in ("pending", "completed", "failed", "refunded"):
        status = "completed"

    if idempotency_key:
        try:
            existing = (
                client.table("payment_history")
                .select("*")
                .eq("idempotency_key", idempotency_key)
                .execute()
            )
            if existing.data and len(existing.data) > 0:
                logger.info(
                    "[payments] idempotent hit key=%s user_id=%s",
                    idempotency_key,
                    user_id,
                )
                return existing.data[0]
        except Exception as e:
            logger.warning(
                "[payments] idempotency check failed key=%s error=%s",
                idempotency_key,
                e,
            )

    try:
        row: dict[str, Any] = {
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
        if idempotency_key:
            row["idempotency_key"] = idempotency_key
        r = client.table("payment_history").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[payments] insert_payment user_id=%s error=%s", user_id, e)
        return None
