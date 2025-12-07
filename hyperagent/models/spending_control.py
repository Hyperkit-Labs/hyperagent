"""Spending control database model"""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import ARRAY, CheckConstraint, Column, DateTime, Numeric, String, Time
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from hyperagent.models import Base


class SpendingControl(Base):
    """
    Spending Control Model

    Tracks user-defined spending limits and restrictions for x402 payments
    """

    __tablename__ = "spending_controls"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)

    daily_limit = Column(Numeric(18, 8), nullable=True)
    monthly_limit = Column(Numeric(18, 8), nullable=True)

    whitelist_merchants = Column(ARRAY(String), nullable=True)

    time_restrictions = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "wallet_address": self.wallet_address,
            "daily_limit": float(self.daily_limit) if self.daily_limit else None,
            "monthly_limit": float(self.monthly_limit) if self.monthly_limit else None,
            "whitelist_merchants": self.whitelist_merchants or [],
            "time_restrictions": self.time_restrictions or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
