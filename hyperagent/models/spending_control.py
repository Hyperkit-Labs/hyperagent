"""Spending control database model"""

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import ARRAY, Boolean, CheckConstraint, Column, DateTime, Float, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from hyperagent.models import Base


class SpendingControl(Base):
    """
    Spending Control Model

    Tracks user-defined spending limits and restrictions for x402 payments
    Enforces daily and monthly limits, merchant whitelists, and tracks spending
    """

    __tablename__ = "spending_controls"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)

    daily_limit = Column(Float, nullable=False, default=10.0)
    monthly_limit = Column(Float, nullable=False, default=100.0)

    daily_spent = Column(Float, nullable=False, default=0.0)
    monthly_spent = Column(Float, nullable=False, default=0.0)

    daily_reset_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.utcnow() + timedelta(days=1))
    monthly_reset_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.utcnow().replace(day=1) + timedelta(days=32))

    whitelist_merchants = Column(ARRAY(String), nullable=True)

    time_restrictions = Column(JSONB, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def needs_reset(self) -> bool:
        """Check if spending counters need to be reset"""
        now = datetime.utcnow()
        return now >= self.daily_reset_at or now >= self.monthly_reset_at

    def reset_if_needed(self) -> None:
        """Reset spending counters if needed"""
        now = datetime.utcnow()
        
        if now >= self.daily_reset_at:
            self.daily_spent = 0.0
            self.daily_reset_at = now + timedelta(days=1)
        
        if now >= self.monthly_reset_at:
            self.monthly_spent = 0.0
            next_month = now.replace(day=1) + timedelta(days=32)
            self.monthly_reset_at = next_month.replace(day=1)

    def can_spend(self, amount: float) -> tuple[bool, Optional[str]]:
        """
        Check if user can spend the requested amount
        
        Returns:
            (allowed: bool, error_message: Optional[str])
        """
        if not self.is_active:
            return False, "Spending controls are disabled"
        
        self.reset_if_needed()
        
        if self.daily_spent + amount > self.daily_limit:
            remaining = self.daily_limit - self.daily_spent
            return False, f"Daily limit exceeded. Remaining: ${remaining:.2f}"
        
        if self.monthly_spent + amount > self.monthly_limit:
            remaining = self.monthly_limit - self.monthly_spent
            return False, f"Monthly limit exceeded. Remaining: ${remaining:.2f}"
        
        return True, None

    def record_spending(self, amount: float) -> None:
        """Record spending after successful payment"""
        self.daily_spent += amount
        self.monthly_spent += amount

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "wallet_address": self.wallet_address,
            "daily_limit": self.daily_limit,
            "monthly_limit": self.monthly_limit,
            "daily_spent": self.daily_spent,
            "monthly_spent": self.monthly_spent,
            "daily_remaining": max(0, self.daily_limit - self.daily_spent),
            "monthly_remaining": max(0, self.monthly_limit - self.monthly_spent),
            "daily_reset_at": self.daily_reset_at.isoformat() if self.daily_reset_at else None,
            "monthly_reset_at": self.monthly_reset_at.isoformat() if self.monthly_reset_at else None,
            "whitelist_merchants": self.whitelist_merchants or [],
            "time_restrictions": self.time_restrictions or {},
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
