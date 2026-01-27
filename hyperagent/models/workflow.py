"""Workflow database model"""

import uuid
from enum import Enum as PyEnum
from typing import Any, Dict

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from hyperagent.models import Base


class WorkflowStatus(PyEnum):
    """Workflow status enumeration"""

    CREATED = "created"
    NLP_PARSING = "nlp_parsing"
    GENERATING = "generating"
    AUDITING = "auditing"
    TESTING = "testing"
    DEPLOYING = "deploying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Workflow(Base):
    """
    Workflow Model

    Concept: Represents a complete contract generation workflow
    Logic: Tracks state through pipeline stages
    Relationships: One-to-many with GeneratedContract, Deployment
    """

    __tablename__ = "workflows"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("hyperagent.users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default=WorkflowStatus.CREATED.value)
    progress_percentage = Column(Integer, default=0)

    # NLP Input
    nlp_input = Column(Text, nullable=False)
    nlp_tokens = Column(Integer)

    # Network
    network = Column(String(50), nullable=False)
    is_testnet = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))

    # Error tracking
    error_message = Column(Text)
    error_stacktrace = Column(Text)
    retry_count = Column(Integer, default=0)

    # Metadata (flexible JSON storage) - using 'meta_data' as both Python attribute and DB column name to avoid SQLAlchemy reserved 'metadata' conflict
    meta_data = Column("meta_data", JSONB, default={})

    # Relationships
    user = relationship("User", back_populates="workflows")
    contracts = relationship("GeneratedContract", back_populates="workflow")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize model to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "status": (
                self.status.value if isinstance(self.status, WorkflowStatus) else str(self.status)
            ),
            "progress_percentage": self.progress_percentage,
            "network": self.network,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
