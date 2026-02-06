"""Deployment database model"""

import uuid
from typing import Any, Dict

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from hyperagent.models import Base


class Deployment(Base):
    """
    Deployment Model

    Concept: Tracks on-chain contract deployments
    Logic: Stores deployment transaction, address, gas costs
    """

    __tablename__ = "deployments"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(
        UUID(as_uuid=True), ForeignKey("hyperagent.generated_contracts.id"), nullable=False
    )

    # Deployment details
    deployment_network = Column(String(50), nullable=False)
    is_testnet = Column(Boolean, nullable=False)

    # On-chain information
    contract_address = Column(String(42), unique=True, nullable=False)
    deployer_address = Column(String(42), nullable=False)
    transaction_hash = Column(String(66), unique=True, nullable=False)

    # Gas & Cost
    gas_used = Column(BigInteger)
    gas_price = Column(BigInteger)  # Wei
    total_cost_wei = Column(BigInteger)  # Total in Wei

    # Deployment status
    deployment_status = Column(String(50), default="pending")
    block_number = Column(BigInteger)
    confirmation_blocks = Column(Integer, default=0)

    # Timestamps
    deployed_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True))

    # EigenDA integration (Mantle only)
    eigenda_commitment = Column(String(256))  # KZG commitment hash
    eigenda_batch_header = Column(JSONB)

    # Metadata storage - using 'meta_data' as both Python attribute and DB column name to avoid SQLAlchemy reserved 'metadata' conflict
    meta_data = Column("meta_data", JSONB, default={})

    # Relationships
    contract = relationship("GeneratedContract", back_populates="deployments")

    # Note: Workflow relationship through contract
    @property
    def workflow(self):
        """Get workflow through contract relationship"""
        return self.contract.workflow if self.contract else None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "contract_id": str(self.contract_id),
            "contract_address": self.contract_address,
            "transaction_hash": self.transaction_hash,
            "deployment_network": self.deployment_network,
            "block_number": self.block_number,
            "gas_used": self.gas_used,
            "deployment_status": self.deployment_status,
        }
