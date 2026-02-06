"""Event types and event structure"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional


class EventType(Enum):
    """Complete event catalog for A2A communication"""

    # Workflow lifecycle
    WORKFLOW_CREATED = "workflow.created"
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_PROGRESSED = "workflow.progressed"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_FAILED = "workflow.failed"
    WORKFLOW_CANCELLED = "workflow.cancelled"
    WORKFLOW_CLARIFICATION_NEEDED = "workflow.clarification_needed"
    WORKFLOW_CAPABILITY_EXCEEDED = "workflow.capability_exceeded"

    # Agent events
    GENERATION_STARTED = "generation.started"
    GENERATION_COMPLETED = "generation.completed"
    GENERATION_FAILED = "generation.failed"
    AUDIT_STARTED = "audit.started"
    AUDIT_COMPLETED = "audit.completed"
    AUDIT_FAILED = "audit.failed"
    TESTING_STARTED = "testing.started"
    TESTING_COMPLETED = "testing.completed"
    TESTING_FAILED = "testing.failed"
    DEPLOYMENT_STARTED = "deployment.started"
    DEPLOYMENT_CONFIRMED = "deployment.confirmed"
    DEPLOYMENT_FAILED = "deployment.failed"

    # A2A Communication
    A2A_REQUEST = "a2a.request"
    A2A_RESPONSE = "a2a.response"


@dataclass
class Event:
    """
    Event Structure

    Concept: Immutable event with type, data, and metadata
    Logic: Events flow through event bus to subscribers
    Usage: Agents publish events, other agents subscribe
    """

    id: str
    type: EventType
    workflow_id: str
    timestamp: datetime
    data: Dict[str, Any]
    source_agent: str
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize event for Redis storage"""
        return {
            "id": self.id,
            "type": self.type.value,
            "workflow_id": self.workflow_id,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "source_agent": self.source_agent,
            "metadata": self.metadata or {},
        }
