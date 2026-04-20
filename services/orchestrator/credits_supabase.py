"""
Credit-based system for workflow and agent usage.
Users top up credits off-chain (fiat / USDC / USDT); each workflow step or agent action consumes credits.
x402 is used separately for fine-grained pay-per-call from external agents or third-party integrations.
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import db

logger = logging.getLogger(__name__)

DEFAULT_CREDITS_PER_STEP = 1.0


def _is_production_blocking() -> bool:
    """Align with orchestrator main.py: block unsafe credit fallbacks in prod-shaped envs."""
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


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
        r = (
            client.table("user_credits")
            .select("balance, currency")
            .eq("user_id", user_id)
            .execute()
        )
        row = (r.data or [None])[0] if r.data else None
        if row:
            bal = row.get("balance")
            if bal is not None and not isinstance(bal, (int, float)):
                try:
                    bal = float(Decimal(str(bal)))
                except Exception as e:
                    logger.warning(
                        "[credits] balance parse failed user_id=%s raw=%r: %s",
                        user_id,
                        bal,
                        e,
                    )
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
        r = (
            client.table("user_credits")
            .select("user_id")
            .eq("user_id", user_id)
            .execute()
        )
        if r.data and len(r.data) > 0:
            return True
        client.table("user_credits").insert(
            {"user_id": user_id, "balance": 0, "currency": "USD"}
        ).execute()
        return True
    except Exception as e:
        logger.warning(
            "[credits] ensure_user_credits_row user_id=%s error=%s", user_id, e
        )
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
            logger.warning(
                "[credits] top_up RPC attempt=%s user_id=%s error=%s",
                attempt + 1,
                user_id,
                e,
            )
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
    """Fallback when RPC not available (e.g. migration not run). Non-atomic.
    Blocked in production to prevent race conditions and double-spend."""
    if _is_production_blocking():
        logger.error(
            "[credits] top_up fallback blocked in production user_id=%s amount=%s",
            user_id,
            amount,
        )
        return None
    client = _client()
    if not client:
        return None
    ensure_user_credits_row(user_id)
    try:
        r = (
            client.table("user_credits")
            .select("balance, currency")
            .eq("user_id", user_id)
            .execute()
        )
        row = (r.data or [None])[0] if r.data else None
        if not row:
            return None
        current = float(Decimal(str(row.get("balance") or 0)))
        new_balance = current + amount
        client.table("user_credits").update(
            {
                "balance": str(new_balance),
                "currency": currency or "USD",
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        client.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "amount": str(amount),
                "balance_after": str(new_balance),
                "tx_type": "top_up",
                "reference_id": reference_id,
            }
        ).execute()
        return {
            "balance": new_balance,
            "currency": currency or "USD",
            "user_id": user_id,
        }
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
    """Deduct credits for a workflow step or agent action. Returns (success, balance_after).
    Uses atomic consume_credits RPC when available to prevent double-spend under concurrency.
    """
    if not user_id or not is_configured() or amount <= 0:
        return False, 0.0
    client = _client()
    if not client:
        return False, 0.0
    for attempt in range(3):
        try:
            r = client.rpc(
                "consume_credits",
                {
                    "p_user_id": user_id,
                    "p_amount": str(amount),
                    "p_reference_id": reference_id,
                    "p_reference_type": reference_type or "workflow_step",
                    "p_metadata": metadata or {},
                },
            ).execute()
            data = r.data
            if data is None:
                break
            row = data[0] if isinstance(data, list) and data else data
            if not isinstance(row, dict):
                break
            success = row.get("success") is True
            bal = row.get("balance_after")
            balance_after = float(Decimal(str(bal))) if bal is not None else 0.0
            return success, balance_after
        except Exception as e:
            logger.warning(
                "[credits] consume RPC attempt=%s user_id=%s error=%s",
                attempt + 1,
                user_id,
                e,
            )
            if attempt < 2:
                time.sleep(0.1 * (attempt + 1))
            else:
                return _consume_fallback(
                    user_id, amount, reference_id, reference_type, metadata
                )
    return _consume_fallback(user_id, amount, reference_id, reference_type, metadata)


def _consume_fallback(
    user_id: str,
    amount: float,
    reference_id: str | None,
    reference_type: str | None,
    metadata: dict[str, Any] | None,
) -> tuple[bool, float]:
    """Fallback when consume_credits RPC not available. Non-atomic, race-prone.
    Blocked in production to prevent double-spend and balance drift."""
    if _is_production_blocking():
        logger.error(
            "[credits] consume fallback blocked in production user_id=%s amount=%s",
            user_id,
            amount,
        )
        return False, 0.0
    client = _client()
    if not client:
        return False, 0.0
    ensure_user_credits_row(user_id)
    try:
        r = (
            client.table("user_credits")
            .select("balance, currency")
            .eq("user_id", user_id)
            .execute()
        )
        row = (r.data or [None])[0] if r.data else None
        if not row:
            return False, 0.0
        current = float(Decimal(str(row.get("balance") or 0)))
        if current < amount:
            return False, current
        new_balance = current - amount
        client.table("user_credits").update(
            {
                "balance": str(new_balance),
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        client.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "amount": str(-amount),
                "balance_after": str(new_balance),
                "tx_type": "consume",
                "reference_id": reference_id,
            }
        ).execute()
        return True, new_balance
    except Exception as e:
        logger.warning("[credits] consume fallback user_id=%s error=%s", user_id, e)
        return False, 0.0


def has_sufficient_credits(
    user_id: str, amount: float = DEFAULT_CREDITS_PER_STEP
) -> bool:
    """Return True if user has at least amount credits (for pre-check before running a step)."""
    info = get_balance(user_id)
    return (info.get("balance") or 0) >= amount


def refund(
    user_id: str,
    amount: float,
    original_reference_id: str | None = None,
    reason: str = "refund",
    metadata: dict[str, Any] | None = None,
) -> tuple[bool, float]:
    """Refund credits back to a user. Returns (success, balance_after).

    Uses the same atomic RPC path as top_up but records the transaction
    as a refund with a link to the original charge reference.
    """
    if not user_id or not is_configured() or amount <= 0:
        return False, 0.0
    client = _client()
    if not client:
        return False, 0.0

    refund_metadata = {"reason": reason}
    if original_reference_id:
        refund_metadata["original_reference_id"] = original_reference_id
    if metadata:
        refund_metadata.update(metadata)

    for attempt in range(3):
        try:
            r = client.rpc(
                "top_up_credits",
                {
                    "p_user_id": user_id,
                    "p_amount": str(amount),
                    "p_currency": "USD",
                    "p_reference_id": f"refund_{original_reference_id or 'manual'}_{uuid.uuid4().hex[:12]}",
                    "p_reference_type": "refund",
                    "p_metadata": refund_metadata,
                },
            ).execute()
            data = r.data
            if data is None:
                break
            row = data[0] if isinstance(data, list) and data else data
            if not isinstance(row, dict):
                break
            balance = float(row.get("balance", 0))
            logger.info(
                "[credits] refund success user_id=%s amount=%s balance=%s ref=%s",
                user_id,
                amount,
                balance,
                original_reference_id,
            )
            return True, balance
        except Exception as e:
            logger.warning(
                "[credits] refund RPC attempt=%s user_id=%s error=%s",
                attempt + 1,
                user_id,
                e,
            )
            if attempt < 2:
                time.sleep(0.1 * (attempt + 1))

    return _refund_fallback(
        user_id, amount, original_reference_id, reason, refund_metadata
    )


def _refund_fallback(
    user_id: str,
    amount: float,
    original_reference_id: str | None,
    reason: str,
    metadata: dict[str, Any],
) -> tuple[bool, float]:
    """Fallback refund when RPC is unavailable. Only allowed in non-production."""
    if _is_production_blocking():
        logger.error(
            "[credits] refund fallback blocked in production user_id=%s amount=%s",
            user_id,
            amount,
        )
        return False, 0.0

    client = _client()
    if not client:
        return False, 0.0
    ensure_user_credits_row(user_id)
    try:
        r = (
            client.table("user_credits")
            .select("balance")
            .eq("user_id", user_id)
            .execute()
        )
        row = (r.data or [None])[0] if r.data else None
        if not row:
            return False, 0.0
        current = float(Decimal(str(row.get("balance") or 0)))
        new_balance = current + amount
        client.table("user_credits").update(
            {
                "balance": str(new_balance),
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        client.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "amount": str(amount),
                "balance_after": str(new_balance),
                "tx_type": "refund",
                "reference_id": f"refund_{original_reference_id or 'manual'}_{uuid.uuid4().hex[:12]}",
            }
        ).execute()
        return True, new_balance
    except Exception as e:
        logger.warning("[credits] refund fallback user_id=%s error=%s", user_id, e)
        return False, 0.0
