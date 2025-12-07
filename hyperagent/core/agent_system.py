"""Core agent system with ServiceInterface and workflow stages"""

from enum import Enum
from typing import Any, Dict, Protocol


class AgentRole(Enum):
    """Agent role definitions"""

    GENERATOR = "generator"  # Contract generation from NLP
    AUDITOR = "auditor"  # Security analysis
    TESTER = "tester"  # Unit testing & coverage
    DEPLOYER = "deployer"  # On-chain deployment
    COORDINATOR = "coordinator"  # Orchestration & state management


class WorkflowStage(Enum):
    """Pipeline stages"""

    PARSING = "nlp_parsing"
    GENERATION = "generating"
    AUDITING = "auditing"
    TESTING = "testing"
    DEPLOYMENT = "deploying"
    COMPLETION = "completed"
    FAILED = "failed"


class ServiceInterface(Protocol):
    """Service contract - all services must implement these methods"""

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process input and return output

        Logic Flow:
        1. Validate input_data
        2. Execute business logic
        3. Return structured output
        4. Handle errors gracefully
        """
        ...

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input data before processing"""
        ...

    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        ...
