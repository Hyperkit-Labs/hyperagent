"""Deployment audit log model for tracking all deployments"""

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from hyperagent.db.base import Base


class DeploymentAudit(Base):
    """
    Deployment Audit Log
    
    Tracks all contract deployments for security, compliance, and cost analysis
    """
    
    __tablename__ = "deployment_audits"
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    deployment_id: Mapped[UUID] = mapped_column(index=True)
    user_wallet: Mapped[str] = mapped_column(String(42), index=True)
    server_wallet: Mapped[Optional[str]] = mapped_column(String(42), nullable=True)
    deployment_method: Mapped[str] = mapped_column(String(20))  # 'server-wallet' or 'erc4337'
    network: Mapped[str] = mapped_column(String(50), index=True)
    payment_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    deployment_tx_hash: Mapped[str] = mapped_column(String(66), unique=True, index=True)
    contract_address: Mapped[str] = mapped_column(String(42), index=True)
    gas_used: Mapped[str] = mapped_column(String(50))
    gas_paid_by_server: Mapped[str] = mapped_column(String(50))  # Gas cost in native token
    gas_price_gwei: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self) -> str:
        return (
            f"<DeploymentAudit("
            f"id={self.id}, "
            f"user_wallet={self.user_wallet}, "
            f"method={self.deployment_method}, "
            f"contract={self.contract_address}"
            f")>"
        )

