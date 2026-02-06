"""Event log database model for system observability"""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from hyperagent.models import Base


class EventLog(Base):
    """
    Event Log Model
    
    Stores system events, workflow progress, API requests, and errors
    for observability, debugging, and compliance.
    """

    __tablename__ = "event_logs"
    __table_args__ = (
        Index("idx_event_logs_workflow_id", "workflow_id"),
        Index("idx_event_logs_event_type", "event_type"),
        Index("idx_event_logs_timestamp", "timestamp"),
        Index("idx_event_logs_source_agent", "source_agent"),
        {"schema": "hyperagent"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(100), nullable=False, index=True)  # workflow.created, api.request, error, etc.
    workflow_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    source_agent = Column(String(100), nullable=True, index=True)  # api-gateway, payment-processor, etc.
    level = Column(String(20), nullable=False, default="INFO", index=True)  # INFO, ERROR, WARN, DEBUG
    message = Column(Text, nullable=False)
    data = Column(JSONB, nullable=True)  # Additional structured data
    service = Column(String(100), nullable=True, index=True)  # Service name (api-gateway, etc.)
    host = Column(String(255), nullable=True)  # Host/server identifier
    duration_ms = Column(String(20), nullable=True)  # Request duration if applicable
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "event_type": self.event_type,
            "workflow_id": str(self.workflow_id) if self.workflow_id else None,
            "source_agent": self.source_agent,
            "level": self.level,
            "message": self.message,
            "data": self.data,
            "service": self.service or self.source_agent,
            "host": self.host,
            "duration_ms": self.duration_ms,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

