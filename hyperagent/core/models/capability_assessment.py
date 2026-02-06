from typing import List, Optional
from pydantic import BaseModel, Field


class CapabilityAssessment(BaseModel):
    """
    Assessment of whether the system can handle the given requirements.
    """
    is_supported: bool = Field(..., description="Whether the requirements are within system capabilities.")
    unsupported_features: List[str] = Field([], description="List of features or requirements that are not supported.")
    supported_features: List[str] = Field([], description="List of features or requirements that are supported.")
    complexity_level: str = Field("medium", description="Estimated complexity: 'low', 'medium', 'high', 'very_high'.")
    risk_level: str = Field("low", description="Risk level: 'low', 'medium', 'high'.")
    recommendations: List[str] = Field([], description="Recommendations for how to proceed or what to simplify.")
    can_proceed: bool = Field(True, description="Whether the workflow can proceed despite limitations.")
    reason: Optional[str] = Field(None, description="Explanation of why requirements are or are not supported.")

