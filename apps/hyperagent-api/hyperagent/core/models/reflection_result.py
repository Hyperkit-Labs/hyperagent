"""
Reflection result models for learning from workflow outcomes.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReflectionResult(BaseModel):
    """
    Structured reflection result from analyzing a workflow outcome.
    """
    workflow_id: str = Field(..., description="ID of the workflow being reflected upon")
    outcome: str = Field(..., description="Workflow outcome: 'success', 'failure', 'capability_exceeded'")
    root_causes: List[str] = Field([], description="Identified root causes of the outcome")
    patterns_identified: List[str] = Field([], description="Patterns identified in the workflow")
    lessons_learned: List[str] = Field([], description="Key lessons learned from this workflow")
    improvement_suggestions: List[str] = Field([], description="Suggestions for improving the system")
    error_categories: List[str] = Field([], description="Categories of errors encountered")
    fix_effectiveness: Optional[float] = Field(None, ge=0.0, le=1.0, description="Effectiveness of fixes applied (0.0-1.0)")
    confidence_score: float = Field(0.5, ge=0.0, le=1.0, description="Confidence in the reflection analysis")
    metadata: Dict[str, Any] = Field({}, description="Additional metadata about the reflection")

