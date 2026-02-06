"""Payment history database model"""

import uuid
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from hyperagent.models import Base


class PaymentHistory(Base):
    """
    Payment History Model

    Tracks all x402 payment transactions for analytics and auditing
    """

    __tablename__ = "payment_history"
    __table_args__ = (
        Index("idx_payment_history_wallet_address", "wallet_address"),
        Index("idx_payment_history_timestamp", "timestamp"),
        Index("idx_payment_history_merchant", "merchant"),
        {"schema": "hyperagent"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(42), nullable=False, index=True)
    amount = Column(Numeric(18, 8), nullable=False)
    currency = Column(String(10), default="USDC")
    merchant = Column(String(255), nullable=True)
    network = Column(String(50), nullable=False)
    endpoint = Column(String(255), nullable=True)
    transaction_hash = Column(String(66), nullable=True, unique=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    status = Column(String(20), default="completed")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "wallet_address": self.wallet_address,
            "amount": float(self.amount),
            "currency": self.currency,
            "merchant": self.merchant,
            "network": self.network,
            "endpoint": self.endpoint,
            "transaction_hash": self.transaction_hash,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "status": self.status,
        }
