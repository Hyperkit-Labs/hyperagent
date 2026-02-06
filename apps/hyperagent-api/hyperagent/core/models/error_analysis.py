"""Error analysis models for feedback loops"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ErrorCategory(str, Enum):
    """Categories of errors that can occur"""

    COMPILATION = "compilation"
    AUDIT = "audit"
    SYNTAX = "syntax"
    TYPE_MISMATCH = "type_mismatch"
    MISSING_IMPORT = "missing_import"
    SECURITY_VULNERABILITY = "security_vulnerability"
    GAS_OPTIMIZATION = "gas_optimization"
    LOGIC_ERROR = "logic_error"
    UNKNOWN = "unknown"


class ErrorSeverity(str, Enum):
    """Severity levels for errors"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ErrorAnalysis(BaseModel):
    """Structured error analysis result"""

    error_type: str = Field(..., description="Type of error (e.g., ParserError, TypeError)")
    category: ErrorCategory = Field(..., description="Error category")
    severity: ErrorSeverity = Field(..., description="Error severity")
    message: str = Field(..., description="Error message")
    location: Optional[Dict[str, Any]] = Field(
        None, description="Error location (line, column, file)"
    )
    fixable: bool = Field(..., description="Whether error can be automatically fixed")
    confidence: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Confidence in fixability assessment"
    )
    context: Optional[str] = Field(None, description="Additional context about the error")
    related_errors: List[str] = Field(
        default_factory=list, description="Related error messages or patterns"
    )
    suggested_actions: List[str] = Field(
        default_factory=list, description="Suggested actions to fix the error"
    )

    class Config:
        use_enum_values = True

