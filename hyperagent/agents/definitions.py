"""Agent definitions and specifications"""

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class AgentDefinition:
    """Complete agent specification"""

    name: str
    role: str
    description: str
    inputs: List[Dict[str, Any]]
    outputs: List[Dict[str, Any]]
    dependencies: List[str]
    max_retry_count: int
    timeout_seconds: int
    parallelizable: bool
    requires_human_approval: bool
    performance_sla: Dict[str, int]  # {p99: ms, p95: ms}
