"""User database model"""

import uuid
from typing import Any, Dict

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from hyperagent.models import Base


class User(Base):
    """
    User Model

    Concept: Represents platform users
    Logic: Links to workflows, tracks user activity
    """

    __tablename__ = "users"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True)
    wallet_address = Column(String(42), unique=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    workflows = relationship("Workflow", back_populates="user")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "email": self.email,
            "username": self.username,
            "wallet_address": self.wallet_address,
            "is_active": self.is_active,
        }
