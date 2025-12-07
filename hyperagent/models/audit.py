"""Security audit database model"""

import uuid
from typing import Any, Dict

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from hyperagent.models import Base


class SecurityAudit(Base):
    """
    Security Audit Model

    Concept: Stores security audit results for contracts
    Logic: Aggregates findings from multiple tools (Slither, Mythril, Echidna)
    """

    __tablename__ = "security_audits"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(
        UUID(as_uuid=True), ForeignKey("hyperagent.generated_contracts.id"), nullable=False
    )

    # Audit tools
    tool_used = Column(String(50), nullable=False)  # slither, mythril, echidna

    # Findings
    vulnerabilities = Column(JSONB, nullable=False, default=[])
    total_issues = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)

    # Risk assessment
    overall_risk_score = Column(Float)
    audit_status = Column(String(50), default="passed")

    # Audit metadata
    audit_duration_ms = Column(Integer)
    audit_timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Full report
    full_report = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    meta_data = Column("metadata", JSONB, default={})

    # Relationships
    contract = relationship("GeneratedContract", back_populates="audits")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        return {
            "id": str(self.id),
            "contract_id": str(self.contract_id),
            "tool_used": self.tool_used,
            "total_issues": self.total_issues,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "overall_risk_score": self.overall_risk_score,
            "audit_status": self.audit_status,
        }
