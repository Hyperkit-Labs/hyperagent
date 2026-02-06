"""Fix suggestion models for error resolution"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FixStrategy(str, Enum):
    """Strategies for fixing errors"""

    ADD_IMPORT = "add_import"
    FIX_SYNTAX = "fix_syntax"
    CORRECT_TYPE = "correct_type"
    ADD_MISSING_CODE = "add_missing_code"
    REMOVE_INVALID_CODE = "remove_invalid_code"
    REFACTOR_LOGIC = "refactor_logic"
    ADD_SECURITY_CHECK = "add_security_check"
    OPTIMIZE_GAS = "optimize_gas"
    REGENERATE_CODE = "regenerate_code"
    MANUAL_REVIEW = "manual_review"


class FixSuggestion(BaseModel):
    """Structured fix suggestion"""

    strategy: FixStrategy = Field(..., description="Fix strategy to apply")
    description: str = Field(..., description="Human-readable description of the fix")
    code_changes: Optional[Dict[str, Any]] = Field(
        None, description="Specific code changes to make (line numbers, replacements)"
    )
    confidence: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Confidence that this fix will work"
    )
    estimated_impact: str = Field(
        default="low", description="Estimated impact (low, medium, high)"
    )
    prerequisites: List[str] = Field(
        default_factory=list, description="Prerequisites or dependencies for this fix"
    )
    alternative_strategies: List[FixStrategy] = Field(
        default_factory=list, description="Alternative fix strategies if this fails"
    )

    class Config:
        use_enum_values = True

