"""Contract database models"""

import uuid
from typing import Any, Dict

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from hyperagent.models import Base


class GeneratedContract(Base):
    """
    Generated Contract Model

    Concept: Stores generated smart contract code and metadata
    Logic: Links to workflow, stores source code, ABI, bytecode
    """

    __tablename__ = "generated_contracts"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("hyperagent.workflows.id"), nullable=False)

    # Contract details
    contract_name = Column(String(255), nullable=False)
    contract_type = Column(String(50))
    solidity_version = Column(String(20), default="0.8.27")

    # Source code
    source_code = Column(Text, nullable=False)
    source_code_hash = Column(String(66))  # SHA256 hash

    # Compilation artifacts
    abi = Column(JSONB)
    bytecode = Column(Text)
    deployed_bytecode = Column(Text)

    # Metadata
    line_count = Column(Integer)
    function_count = Column(Integer)
    security_flags = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Metadata storage - using 'meta_data' as both Python attribute and DB column name to avoid SQLAlchemy reserved 'metadata' conflict
    meta_data = Column("meta_data", JSONB, default={})

    # Relationships
    workflow = relationship("Workflow", back_populates="contracts")
    audits = relationship("SecurityAudit", back_populates="contract")
    deployments = relationship("Deployment", back_populates="contract")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "workflow_id": str(self.workflow_id),
            "contract_name": self.contract_name,
            "contract_type": self.contract_type,
            "solidity_version": self.solidity_version,
            "line_count": self.line_count,
            "function_count": self.function_count,
        }
