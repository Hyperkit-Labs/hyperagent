"""
Billing API: credits, payments, pricing routes.
"""

import logging
import os
import time
from typing import Any

import credits_supabase
import db
import payments_supabase
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field
from registries import (
    get_default_chain_id,
    get_erc8004_agent_identity,
    get_monitoring_enabled,
    get_resource_price,
    get_x402_enabled,
    get_x402_plan,
    get_x402_plans,
    get_x402_resources,
)
from store import count_workflows

logger = logging.getLogger(__name__)

CREDITS_PER_RUN = float(os.environ.get("CREDITS_PER_RUN", "7"))
CREDITS_PER_USD = float(os.environ.get("CREDITS_PER_USD", "10"))


def _spending_control_default() -> dict[str, Any]:
    return {
        "budget": "0",
        "currency": "USD",
        "period": "monthly",
        "alert_threshold_percent": 80,
        "spent": "0",
    }


class SpendingControlBody(BaseModel):
    budget_amount: float = Field(ge=0, description="Budget amount per period")
    budget_currency: str = "USD"
    period: str = "monthly"
    alert_threshold_percent: int = Field(ge=0, le=100, default=80)


class CreditsTopUpBody(BaseModel):
    amount: float = Field(
        gt=0, description="Credit amount to add (e.g. fiat/USDC/USDT conversion)"
    )
    currency: str = "USD"
    reference_id: str | None = None
    reference_type: str | None = "manual"


# Credits router
credits_router = APIRouter(prefix="/api/v1/credits", tags=["billing", "credits"])


@credits_router.get("/balance")
def credits_balance_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return current credit balance for the authenticated user."""
    if not x_user_id:
        return {"balance": 0.0, "currency": "USD", "message": "X-User-Id required"}
    return credits_supabase.get_balance(x_user_id)


@credits_router.post("/top-up")
def credits_top_up_api(
    body: CreditsTopUpBody,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Record a credit top-up. When amount is in USD, multiplied by CREDITS_PER_USD."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id required")
    if not credits_supabase.is_configured():
        raise HTTPException(status_code=503, detail="Credits not configured")
    is_usd_input = (body.reference_type or "").lower() in (
        "usdc_transfer",
        "usdt_transfer",
        "fiat",
    ) or (body.currency or "").upper() == "USD"
    credits_to_add = body.amount * CREDITS_PER_USD if is_usd_input else body.amount
    result = credits_supabase.top_up(
        x_user_id,
        amount=credits_to_add,
        currency=body.currency or "USD",
        reference_id=body.reference_id,
        reference_type=body.reference_type or "manual",
        metadata=(
            {"usd_amount": body.amount, "credits_per_usd": CREDITS_PER_USD}
            if is_usd_input
            else None
        ),
    )
    if not result:
        raise HTTPException(status_code=500, detail="Top-up failed")
    return {
        "balance": result["balance"],
        "currency": result["currency"],
        "user_id": result["user_id"],
    }


# Payments router
payments_router = APIRouter(prefix="/api/v1/payments", tags=["billing", "payments"])


@payments_router.get("/history")
def payments_history_api(
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Return payment history for the authenticated user."""
    if not x_user_id:
        return {"items": [], "total": 0, "message": "X-User-Id required"}
    if not payments_supabase.is_configured():
        return {"items": [], "total": 0}
    items, total = payments_supabase.get_payment_history(
        x_user_id, limit=min(100, max(1, limit)), offset=max(0, offset)
    )
    return {"items": items, "total": total}


@payments_router.get("/summary")
def payments_summary_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return payment summary (total spent, count) for the authenticated user."""
    if not x_user_id:
        return {"total": "0", "currency": "USD", "total_count": 0}
    if not payments_supabase.is_configured():
        return {"total": "0", "currency": "USD", "total_count": 0}
    return payments_supabase.get_payment_summary(x_user_id)


@payments_router.get("/spending-control")
def payments_spending_control_get_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return spending control (budget, period, alert) for the authenticated user."""
    try:
        if not x_user_id:
            return _spending_control_default()
        if not payments_supabase.is_configured():
            return _spending_control_default()
        row = payments_supabase.get_spending_control(x_user_id)
        if not row:
            return _spending_control_default()
        spent = "0"
        try:
            summary = payments_supabase.get_payment_summary(x_user_id)
            spent = str(summary.get("total", "0") or "0")
        except Exception:
            pass
        return {
            "budget": str(row.get("budget_amount", 0) or 0),
            "currency": row.get("budget_currency") or "USD",
            "period": row.get("period") or "monthly",
            "alert_threshold_percent": int(
                row.get("alert_threshold_percent", 80) or 80
            ),
            "spent": spent,
        }
    except Exception as e:
        logger.warning("[payments] spending-control GET error: %s", e, exc_info=True)
        return _spending_control_default()


@payments_router.patch("/spending-control")
def payments_spending_control_patch_api(
    body: SpendingControlBody,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Update spending control for the authenticated user."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id required")
    if not payments_supabase.is_configured():
        raise HTTPException(status_code=503, detail="Spending controls not configured")
    period = body.period if body.period in ("daily", "weekly", "monthly") else "monthly"
    row = None
    for api_attempt in range(3):
        row = payments_supabase.upsert_spending_control(
            x_user_id,
            budget_amount=body.budget_amount,
            budget_currency=body.budget_currency or "USD",
            period=period,
            alert_threshold_percent=body.alert_threshold_percent,
        )
        if row:
            break
        if api_attempt < 2:
            time.sleep(0.2 * (api_attempt + 1))
    if not row:
        raise HTTPException(status_code=500, detail="Failed to update spending control")
    return {
        "budget": str(row.get("budget_amount", 0)),
        "currency": row.get("budget_currency") or "USD",
        "period": row.get("period") or "monthly",
        "alert_threshold_percent": row.get("alert_threshold_percent", 80),
    }


# Pricing router
pricing_router = APIRouter(prefix="/api/v1/pricing", tags=["billing", "pricing"])


@pricing_router.get("/plans")
def pricing_plans_api() -> dict[str, Any]:
    """Return available subscription plans from x402-products.yaml."""
    plans = get_x402_plans()
    return {"plans": plans}


@pricing_router.get("/plans/{plan_id}")
def pricing_plan_detail_api(plan_id: str) -> dict[str, Any]:
    """Return a single plan by id."""
    plan = get_x402_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found")
    return plan


@pricing_router.get("/resources")
def pricing_resources_api() -> dict[str, Any]:
    """Return x402 billable resources with unit prices."""
    resources = get_x402_resources()
    for r in resources:
        r["unit_price"] = get_resource_price(r.get("id", ""))
    return {"resources": resources}


@pricing_router.get("/usage")
def pricing_usage_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return current usage vs plan limits for the authenticated user."""
    if not x_user_id:
        return {"plan": "free", "usage": {}, "limits": {}}
    plan_id = "free"
    if db.is_configured():
        try:
            client = db._client()
            if client:
                r = (
                    client.table("wallet_users")
                    .select("plan_id")
                    .eq("id", x_user_id)
                    .maybe_single()
                    .execute()
                )
                if r and r.data:
                    plan_id = r.data.get("plan_id") or "free"
        except Exception:
            pass
    plan = get_x402_plan(plan_id) or get_x402_plan("free") or {}
    limits = plan.get("limits") or {}
    run_count = count_workflows()
    usage = {"pipeline.run": run_count}
    return {
        "plan": plan_id,
        "plan_name": plan.get("name", plan_id),
        "usage": usage,
        "limits": limits,
        "features": plan.get("features", []),
        "enabled_pipelines": plan.get("enabledPipelines", []),
    }


# Reconciliation router
reconciliation_router = APIRouter(
    prefix="/api/v1/billing/reconciliation", tags=["billing", "reconciliation"]
)


@reconciliation_router.get("")
def reconciliation_status_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Run reconciliation for the requesting user and return drift status."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id required")
    try:
        from billing_reconciliation import reconcile_user

        result = reconcile_user(x_user_id)
        if result is None:
            return {
                "status": "not_configured",
                "message": "Billing reconciliation unavailable (DB not configured)",
            }
        return {"status": "ok", **result.to_dict()}
    except Exception as e:
        logger.error("[reconciliation] API error user_id=%s: %s", x_user_id, e)
        raise HTTPException(status_code=500, detail="Reconciliation check failed")


@reconciliation_router.get("/all")
def reconciliation_all_api() -> dict[str, Any]:
    """Run reconciliation for all users. Admin/internal use."""
    try:
        from billing_reconciliation import find_drifted_users

        drifted = find_drifted_users(threshold=0.01, limit=200)
        return {"status": "ok", "drifted_count": len(drifted), "drifted_users": drifted}
    except Exception as e:
        logger.error("[reconciliation] reconcile_all API error: %s", e)
        raise HTTPException(status_code=500, detail="Reconciliation check failed")
