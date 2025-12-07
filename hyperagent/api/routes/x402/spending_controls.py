"""Spending controls API routes"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.db.session import get_db
from hyperagent.models.payment_history import PaymentHistory
from hyperagent.models.spending_control import SpendingControl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/x402/spending-controls", tags=["x402-spending-controls"])


class SpendingControlRequest(BaseModel):
    wallet_address: str = Field(..., description="Wallet address")
    daily_limit: Optional[float] = Field(None, description="Daily spending limit in USDC")
    monthly_limit: Optional[float] = Field(None, description="Monthly spending limit in USDC")
    whitelist_merchants: Optional[List[str]] = Field(
        None, description="List of allowed merchant identifiers"
    )
    time_restrictions: Optional[Dict[str, Any]] = Field(
        None, description="Time-based restrictions (e.g., allowed_hours)"
    )


class SpendingControlResponse(BaseModel):
    id: str
    wallet_address: str
    daily_limit: Optional[float]
    monthly_limit: Optional[float]
    whitelist_merchants: List[str]
    time_restrictions: Dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]


class SpendingControlWithBudgetResponse(BaseModel):
    """Spending control with remaining budget calculations"""

    id: str
    wallet_address: str
    daily_limit: Optional[float]
    monthly_limit: Optional[float]
    whitelist_merchants: List[str]
    time_restrictions: Dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]
    # Budget calculations
    daily_spent: float
    daily_remaining: Optional[float]
    monthly_spent: float
    monthly_remaining: Optional[float]


@router.post("", response_model=SpendingControlResponse)
async def create_or_update_spending_control(
    request: SpendingControlRequest, db: AsyncSession = Depends(get_db)
):
    """Create or update spending controls for a wallet"""
    try:
        stmt = select(SpendingControl).where(
            SpendingControl.wallet_address == request.wallet_address
        )
        result = await db.execute(stmt)
        control = result.scalar_one_or_none()

        if control:
            if request.daily_limit is not None:
                control.daily_limit = request.daily_limit
            if request.monthly_limit is not None:
                control.monthly_limit = request.monthly_limit
            if request.whitelist_merchants is not None:
                control.whitelist_merchants = request.whitelist_merchants
            if request.time_restrictions is not None:
                control.time_restrictions = request.time_restrictions
        else:
            control = SpendingControl(
                wallet_address=request.wallet_address,
                daily_limit=request.daily_limit,
                monthly_limit=request.monthly_limit,
                whitelist_merchants=request.whitelist_merchants,
                time_restrictions=request.time_restrictions,
            )
            db.add(control)

        await db.commit()
        await db.refresh(control)

        return SpendingControlResponse(**control.to_dict())
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating/updating spending control: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{wallet_address}", response_model=SpendingControlResponse)
async def get_spending_control(wallet_address: str, db: AsyncSession = Depends(get_db)):
    """Get spending controls for a wallet"""
    try:
        stmt = select(SpendingControl).where(SpendingControl.wallet_address == wallet_address)
        result = await db.execute(stmt)
        control = result.scalar_one_or_none()

        if not control:
            raise HTTPException(status_code=404, detail="Spending controls not found")

        return SpendingControlResponse(**control.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting spending control: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{wallet_address}/budget", response_model=SpendingControlWithBudgetResponse)
async def get_spending_control_with_budget(
    wallet_address: str,
    include_session: bool = Query(False, description="Include session-based spending"),
    db: AsyncSession = Depends(get_db),
):
    """Get spending controls with remaining budget calculations"""
    try:
        # Get spending control
        stmt = select(SpendingControl).where(SpendingControl.wallet_address == wallet_address)
        result = await db.execute(stmt)
        control = result.scalar_one_or_none()

        if not control:
            # Return default response with no limits
            return SpendingControlWithBudgetResponse(
                id="",
                wallet_address=wallet_address,
                daily_limit=None,
                monthly_limit=None,
                whitelist_merchants=[],
                time_restrictions={},
                created_at=None,
                updated_at=None,
                daily_spent=0.0,
                daily_remaining=None,
                monthly_spent=0.0,
                monthly_remaining=None,
            )

        # Calculate daily spending
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        daily_stmt = select(func.sum(PaymentHistory.amount)).where(
            PaymentHistory.wallet_address == wallet_address,
            PaymentHistory.timestamp >= today_start,
            PaymentHistory.status == "completed",
        )
        daily_result = await db.execute(daily_stmt)
        daily_spent = float(daily_result.scalar() or 0)

        # Calculate monthly spending
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_stmt = select(func.sum(PaymentHistory.amount)).where(
            PaymentHistory.wallet_address == wallet_address,
            PaymentHistory.timestamp >= month_start,
            PaymentHistory.status == "completed",
        )
        monthly_result = await db.execute(monthly_stmt)
        monthly_spent = float(monthly_result.scalar() or 0)

        # Calculate remaining budget
        daily_remaining = None
        if control.daily_limit:
            daily_remaining = float(control.daily_limit) - daily_spent

        monthly_remaining = None
        if control.monthly_limit:
            monthly_remaining = float(control.monthly_limit) - monthly_spent

        control_dict = control.to_dict()
        return SpendingControlWithBudgetResponse(
            **control_dict,
            daily_spent=daily_spent,
            daily_remaining=daily_remaining,
            monthly_spent=monthly_spent,
            monthly_remaining=monthly_remaining,
        )
    except Exception as e:
        logger.error(f"Error getting spending control with budget: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{wallet_address}")
async def delete_spending_control(wallet_address: str, db: AsyncSession = Depends(get_db)):
    """Delete spending controls for a wallet"""
    try:
        stmt = select(SpendingControl).where(SpendingControl.wallet_address == wallet_address)
        result = await db.execute(stmt)
        control = result.scalar_one_or_none()

        if not control:
            raise HTTPException(status_code=404, detail="Spending controls not found")

        await db.delete(control)
        await db.commit()

        return {"message": "Spending controls deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting spending control: {e}")
        raise HTTPException(status_code=500, detail=str(e))
