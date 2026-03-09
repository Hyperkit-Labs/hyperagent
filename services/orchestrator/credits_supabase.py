"""
Credit-based system for workflow and agent usage.
Users top up credits off-chain (fiat / USDC / USDT); each workflow step or agent action consumes credits.
x402 is used separately for fine-grained pay-per-call from external agents or third-party integrations.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import db

logger = logging.getLogger(__name__)

DEFAULT_CREDITS_PER_STEP = 1.0


def _client():
    return db._client()


def is_configured() -> bool:
    if os.environ.get("CREDITS_ENABLED", "").lower() not in ("1", "true", "yes"):
        return False
    return db.is_configured()


def get_balance(user_id: str) -> dict[str, Any]:
    """Return current credit balance for user_id (wallet_users.id)."""
    if not user_id or not is_configured():
        return {"balance": 0.0, "currency": "USD", "user_id": user_id}
    client = _client()
    if not client:
        return {"balance": 0.0, "currency": "USD", "user_id": user_id}
    try:
        r = client.table("user_credits").select("balance, currency").eq("user_id", user_id).execute()
        row = (r.data or [None])[0] if r.data else None
        if row:
            bal = row.get("balance")
            if bal is not None and not isinstance(bal, (int, float)):
                try:
                    bal = float(Decimal(str(bal)))
                except Exception as e:
                    logger.warning("[credits] balance parse failed user_id=%s raw=%r: %s", user_id, bal, e)
                    bal = 0.0
            return {
                "balance": float(bal) if bal is not None else 0.0,
                "currency": row.get("currency") or "USD",
                "user_id": user_id,
            }
        return {"balance": 0.0, "currency": "USD", "user_id": user_id}
    except Exception as e:
        logger.warning("[credits] get_balance user_id=%s error=%s", user_id, e)
        return {"balance": 0.0, "currency": "USD", "user_id": user_id}


def ensure_user_credits_row(user_id: str) -> bool:
    """Ensure user_credits row exists; create with 0 balance if missing."""
    if not user_id or not is_configured():
        return False
    client = _client()
    if not client:
        return False
    try:
        r = client.table("user_credits").select("user_id").eq("user_id", user_id).execute()
        if r.data and len(r.data) > 0:
            return True
        client.table("user_credits").insert({"user_id": user_id, "balance": 0, "currency": "USD"}).execute()
        return True
    except Exception as e:
        logger.warning("[credits] ensure_user_credits_row user_id=%s error=%s", user_id, e)
        return False


def top_up(
    user_id: str,
    amount: float,
    currency: str = "USD",
    reference_id: str | None = None,
    reference_type: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Add credits (e.g. after fiat/USDC/USDT top-up). Returns updated balance info or None.
    Uses atomic RPC when available to avoid race conditions under concurrent load.
    Retries up to 2 times on transient failures."""
    if not user_id or not is_configured() or amount <= 0:
        return None
    client = _client()
    if not client:
        return None
    for attempt in range(3):
        try:
            r = client.rpc(
                "top_up_credits",
                {
                    "p_user_id": user_id,
                    "p_amount": str(amount),
                    "p_currency": currency or "USD",
                    "p_reference_id": reference_id,
                    "p_reference_type": reference_type or "manual",
                    "p_metadata": metadata or {},
                },
            ).execute()
            data = r.data
            if data is None:
                return None
            row = data[0] if isinstance(data, list) and data else data
            if not isinstance(row, dict):
                return None
            return {
                "balance": float(row.get("balance", 0)),
                "currency": str(row.get("currency", "USD")),
                "user_id": user_id,
            }
        except Exception as e:
            logger.warning("[credits] top_up RPC attempt=%s user_id=%s error=%s", attempt + 1, user_id, e)
            if attempt < 2:
                time.sleep(0.1 * (attempt + 1))
            else:
                return _top_up_fallback(
                    user_id, amount, currency, reference_id, reference_type, metadata
                )
    return _top_up_fallback(
        user_id, amount, currency, reference_id, reference_type, metadata
    )


def _top_up_fallback(
    user_id: str,
    amount: float,
    currency: str,
    reference_id: str | None,
    reference_type: str | None,
    metadata: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Fallback when RPC not available (e.g. migration not run). Non-atomic."""
    client = _client()
    if not client:
        return None
    ensure_user_credits_row(user_id)
    try:
        r = client.table("user_credits").select("balance, currency").eq("user_id", user_id).execute()
        row = (r.data or [None])[0] if r.data else None
        if not row:
            return None
        current = float(Decimal(str(row.get("balance") or 0)))
        new_balance = current + amount
        client.table("user_credits").update({
            "balance": str(new_balance),
            "currency": currency or "USD",
            "updated_at": datetime.now(UTC).isoformat(),
        }).eq("user_id", user_id).execute()
        client.table("credit_transactions").insert({
            "user_id": user_id,
            "amount_delta": str(amount),
            "balance_after": str(new_balance),
            "type": "top_up",
            "reference_id": reference_id,
            "reference_type": reference_type or "manual",
            "metadata": metadata or {},
        }).execute()
        return {"balance": new_balance, "currency": currency or "USD", "user_id": user_id}
    except Exception as e:
        logger.warning("[credits] top_up fallback user_id=%s error=%s", user_id, e)
        return None


def consume(
    user_id: str,
    amount: float,
    reference_id: str | None = None,
    reference_type: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[bool, float]:
    """Deduct credits for a workflow step or agent action. Returns (success, balance_after)."""
    if not user_id or not is_configured() or amount <= 0:
        return False, 0.0
    client = _client()
    if not client:
        return False, 0.0
    try:
        r = client.table("user_credits").select("balance, currency").eq("user_id", user_id).execute()
        row = (r.data or [None])[0] if r.data else None
        if not row:
            ensure_user_credits_row(user_id)
            return False, 0.0
        current = float(Decimal(str(row.get("balance") or 0)))
        if current < amount:
            return False, current
        new_balance = current - amount
        client.table("user_credits").update({
            "balance": str(new_balance),
            "updated_at": datetime.now(UTC).isoformat(),
        }).eq("user_id", user_id).execute()
        client.table("credit_transactions").insert({
            "user_id": user_id,
            "amount_delta": str(-amount),
            "balance_after": str(new_balance),
            "type": "consume",
            "reference_id": reference_id,
            "reference_type": reference_type or "workflow_step",
            "metadata": metadata or {},
        }).execute()
        return True, new_balance
    except Exception as e:
        logger.warning("[credits] consume user_id=%s error=%s", user_id, e)
        return False, 0.0


def has_sufficient_credits(user_id: str, amount: float = DEFAULT_CREDITS_PER_STEP) -> bool:
    """Return True if user has at least amount credits (for pre-check before running a step)."""
    info = get_balance(user_id)
    return (info.get("balance") or 0) >= amount
