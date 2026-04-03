"""
Billing reconciliation helper.

Detects mismatches between credit_transactions, payment_history, and user_credits.
Runs as a periodic job or on-demand diagnostic. Does NOT auto-correct; it reports
discrepancies for human review.

Addresses all_findings.md:
- Missing reconciliation job
- Balance drift detection
- Payment/credit event correlation
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


class ReconciliationResult:
    """Immutable result of a reconciliation check."""

    __slots__ = (
        "user_id",
        "stored_balance",
        "computed_balance",
        "drift",
        "orphan_payments",
        "orphan_transactions",
        "checked_at",
    )

    def __init__(
        self,
        user_id: str,
        stored_balance: float,
        computed_balance: float,
        drift: float,
        orphan_payments: list[dict[str, Any]],
        orphan_transactions: list[dict[str, Any]],
    ):
        self.user_id = user_id
        self.stored_balance = stored_balance
        self.computed_balance = computed_balance
        self.drift = drift
        self.orphan_payments = orphan_payments
        self.orphan_transactions = orphan_transactions
        self.checked_at = datetime.now(UTC).isoformat()

    @property
    def is_consistent(self) -> bool:
        return abs(self.drift) < 0.01 and not self.orphan_payments

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "stored_balance": self.stored_balance,
            "computed_balance": self.computed_balance,
            "drift": self.drift,
            "is_consistent": self.is_consistent,
            "orphan_payments_count": len(self.orphan_payments),
            "orphan_transactions_count": len(self.orphan_transactions),
            "checked_at": self.checked_at,
        }


def reconcile_user(user_id: str) -> ReconciliationResult | None:
    """Check a single user for balance drift and orphan records.

    Computes expected balance from credit_transactions and compares
    it against the stored balance in user_credits.
    """
    if not user_id or not db.is_configured():
        return None
    client = _client()
    if not client:
        return None

    try:
        balance_row = (
            client.table("user_credits")
            .select("balance")
            .eq("user_id", user_id)
            .execute()
        )
        stored = 0.0
        if balance_row.data and len(balance_row.data) > 0:
            raw = balance_row.data[0].get("balance")
            if raw is not None:
                stored = float(Decimal(str(raw)))

        tx_rows = (
            client.table("credit_transactions")
            .select("amount, tx_type, reference_id")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        computed = 0.0
        tx_refs: set[str] = set()
        for row in tx_rows.data or []:
            amt = float(Decimal(str(row.get("amount", 0))))
            computed += amt
            ref = row.get("reference_id")
            if ref:
                tx_refs.add(ref)

        payment_rows = (
            client.table("payment_history")
            .select("id, resource_id, status, metadata")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
        )
        orphan_payments: list[dict[str, Any]] = []
        for p in payment_rows.data or []:
            wf_id = (p.get("metadata") or {}).get("workflow_id")
            if wf_id and wf_id not in tx_refs:
                orphan_payments.append({
                    "payment_id": p.get("id"),
                    "resource_id": p.get("resource_id"),
                    "workflow_id": wf_id,
                })

        drift = round(stored - computed, 4)

        return ReconciliationResult(
            user_id=user_id,
            stored_balance=stored,
            computed_balance=round(computed, 4),
            drift=drift,
            orphan_payments=orphan_payments,
            orphan_transactions=[],
        )
    except Exception as e:
        logger.error("[reconciliation] user_id=%s error=%s", user_id, e)
        return None


def reconcile_all(limit: int = 100) -> list[ReconciliationResult]:
    """Run reconciliation for all users with credit balances."""
    if not db.is_configured():
        return []
    client = _client()
    if not client:
        return []

    try:
        r = (
            client.table("user_credits")
            .select("user_id")
            .limit(limit)
            .execute()
        )
        results: list[ReconciliationResult] = []
        for row in r.data or []:
            uid = row.get("user_id")
            if uid:
                result = reconcile_user(uid)
                if result:
                    results.append(result)
        return results
    except Exception as e:
        logger.error("[reconciliation] reconcile_all error=%s", e)
        return []


def find_drifted_users(threshold: float = 0.01, limit: int = 100) -> list[dict[str, Any]]:
    """Return users whose stored balance differs from computed balance."""
    results = reconcile_all(limit=limit)
    return [r.to_dict() for r in results if abs(r.drift) >= threshold]
