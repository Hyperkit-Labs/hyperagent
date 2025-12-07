"""Payment analytics API routes"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.db.session import get_db
from hyperagent.models.payment_history import PaymentHistory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/x402/analytics", tags=["x402-analytics"])


class PaymentHistoryItem(BaseModel):
    id: str
    wallet_address: str
    amount: float
    currency: str
    merchant: Optional[str]
    network: str
    endpoint: Optional[str]
    transaction_hash: Optional[str]
    timestamp: str
    status: str


class PaymentHistoryResponse(BaseModel):
    items: List[PaymentHistoryItem]
    total: int
    page: int
    page_size: int


class PaymentSummaryResponse(BaseModel):
    daily_total: float
    monthly_total: float
    transaction_count: int
    average_amount: float
    top_merchants: List[Dict[str, Any]]


@router.get("/history", response_model=PaymentHistoryResponse)
async def get_payment_history(
    wallet_address: str = Query(..., description="Wallet address"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    """Get payment history for a wallet with pagination"""
    try:
        offset = (page - 1) * page_size

        stmt = (
            select(PaymentHistory)
            .where(PaymentHistory.wallet_address == wallet_address)
            .order_by(PaymentHistory.timestamp.desc())
            .offset(offset)
            .limit(page_size)
        )

        count_stmt = select(func.count(PaymentHistory.id)).where(
            PaymentHistory.wallet_address == wallet_address
        )

        result = await db.execute(stmt)
        payments = result.scalars().all()

        count_result = await db.execute(count_stmt)
        total = count_result.scalar()

        items = [PaymentHistoryItem(**p.to_dict()) for p in payments]

        return PaymentHistoryResponse(items=items, total=total, page=page, page_size=page_size)
    except Exception as e:
        logger.error(f"Error getting payment history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary", response_model=PaymentSummaryResponse)
async def get_payment_summary(
    wallet_address: str = Query(..., description="Wallet address"),
    db: AsyncSession = Depends(get_db),
):
    """Get payment summary (daily/monthly totals, averages, top merchants)"""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        base_filter = PaymentHistory.wallet_address == wallet_address

        daily_stmt = select(func.sum(PaymentHistory.amount)).where(
            and_(
                base_filter,
                PaymentHistory.timestamp >= today_start,
                PaymentHistory.status == "completed",
            )
        )
        monthly_stmt = select(func.sum(PaymentHistory.amount)).where(
            and_(
                base_filter,
                PaymentHistory.timestamp >= month_start,
                PaymentHistory.status == "completed",
            )
        )
        count_stmt = select(func.count(PaymentHistory.id)).where(
            and_(base_filter, PaymentHistory.status == "completed")
        )
        avg_stmt = select(func.avg(PaymentHistory.amount)).where(
            and_(base_filter, PaymentHistory.status == "completed")
        )

        daily_result = await db.execute(daily_stmt)
        daily_total = float(daily_result.scalar() or 0)

        monthly_result = await db.execute(monthly_stmt)
        monthly_total = float(monthly_result.scalar() or 0)

        count_result = await db.execute(count_stmt)
        transaction_count = count_result.scalar() or 0

        avg_result = await db.execute(avg_stmt)
        average_amount = float(avg_result.scalar() or 0)

        merchant_stmt = (
            select(
                PaymentHistory.merchant,
                func.sum(PaymentHistory.amount).label("total"),
                func.count(PaymentHistory.id).label("count"),
            )
            .where(
                and_(
                    base_filter,
                    PaymentHistory.status == "completed",
                    PaymentHistory.merchant.isnot(None),
                )
            )
            .group_by(PaymentHistory.merchant)
            .order_by(func.sum(PaymentHistory.amount).desc())
            .limit(10)
        )

        merchant_result = await db.execute(merchant_stmt)
        top_merchants = [
            {"merchant": row.merchant, "total": float(row.total), "count": row.count}
            for row in merchant_result.all()
        ]

        return PaymentSummaryResponse(
            daily_total=daily_total,
            monthly_total=monthly_total,
            transaction_count=transaction_count,
            average_amount=average_amount,
            top_merchants=top_merchants,
        )
    except Exception as e:
        logger.error(f"Error getting payment summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/merchants")
async def get_merchant_breakdown(
    wallet_address: str = Query(..., description="Wallet address"),
    db: AsyncSession = Depends(get_db),
):
    """Get breakdown of payments by merchant"""
    try:
        stmt = (
            select(
                PaymentHistory.merchant,
                func.sum(PaymentHistory.amount).label("total"),
                func.count(PaymentHistory.id).label("count"),
            )
            .where(
                and_(
                    PaymentHistory.wallet_address == wallet_address,
                    PaymentHistory.status == "completed",
                    PaymentHistory.merchant.isnot(None),
                )
            )
            .group_by(PaymentHistory.merchant)
            .order_by(func.sum(PaymentHistory.amount).desc())
        )

        result = await db.execute(stmt)
        merchants = [
            {"merchant": row.merchant, "total": float(row.total), "count": row.count}
            for row in result.all()
        ]

        return {"merchants": merchants}
    except Exception as e:
        logger.error(f"Error getting merchant breakdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))
