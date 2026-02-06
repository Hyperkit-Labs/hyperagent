"""
Long-term memory system for storing successful workflows and failure patterns.

The LongTermMemory system enables the agent to learn from past experiences
by storing and retrieving patterns, successful strategies, and failure modes.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum

from hyperagent.core.models.reflection_result import ReflectionResult

logger = logging.getLogger(__name__)


class MemoryType(str, Enum):
    """Types of memories stored in long-term memory"""
    SUCCESS_PATTERN = "success_pattern"
    FAILURE_PATTERN = "failure_pattern"
    FIX_STRATEGY = "fix_strategy"
    ERROR_PATTERN = "error_pattern"
    REQUIREMENTS_PATTERN = "requirements_pattern"
    ARCHITECTURE_PATTERN = "architecture_pattern"


class LongTermMemory:
    """
    Long-term memory system for storing and retrieving workflow patterns.
    
    This system stores:
    - Successful workflow patterns
    - Failure patterns and root causes
    - Effective fix strategies
    - Common error patterns
    - Requirements patterns
    - Architecture patterns
    """

    def __init__(self, db_session=None):
        """
        Initialize Long-Term Memory

        Args:
            db_session: Database session for storing memories (optional, can use in-memory for now)
        """
        self.db_session = db_session
        # In-memory storage for now (will be migrated to DB later)
        self.memories: Dict[str, List[Dict[str, Any]]] = {
            MemoryType.SUCCESS_PATTERN.value: [],
            MemoryType.FAILURE_PATTERN.value: [],
            MemoryType.FIX_STRATEGY.value: [],
            MemoryType.ERROR_PATTERN.value: [],
            MemoryType.REQUIREMENTS_PATTERN.value: [],
            MemoryType.ARCHITECTURE_PATTERN.value: [],
        }

    async def store_reflection(self, reflection: ReflectionResult) -> None:
        """
        Store a reflection result in long-term memory.

        Args:
            reflection: ReflectionResult to store
        """
        logger.info(f"Storing reflection for workflow {reflection.workflow_id}")

        # Store failure patterns
        if reflection.outcome == "failure":
            failure_pattern = {
                "workflow_id": reflection.workflow_id,
                "root_causes": reflection.root_causes,
                "error_categories": reflection.error_categories,
                "patterns": reflection.patterns_identified,
                "lessons": reflection.lessons_learned,
                "stored_at": datetime.now().isoformat(),
            }
            self.memories[MemoryType.FAILURE_PATTERN.value].append(failure_pattern)

        # Store success patterns
        elif reflection.outcome == "success":
            success_pattern = {
                "workflow_id": reflection.workflow_id,
                "patterns": reflection.patterns_identified,
                "lessons": reflection.lessons_learned,
                "stored_at": datetime.now().isoformat(),
            }
            self.memories[MemoryType.SUCCESS_PATTERN.value].append(success_pattern)

        # Store fix strategies if applicable
        if reflection.fix_effectiveness is not None and reflection.fix_effectiveness > 0.5:
            fix_strategy = {
                "workflow_id": reflection.workflow_id,
                "error_categories": reflection.error_categories,
                "improvement_suggestions": reflection.improvement_suggestions,
                "effectiveness": reflection.fix_effectiveness,
                "stored_at": datetime.now().isoformat(),
            }
            self.memories[MemoryType.FIX_STRATEGY.value].append(fix_strategy)

        # Store error patterns
        if reflection.error_categories:
            error_pattern = {
                "workflow_id": reflection.workflow_id,
                "error_categories": reflection.error_categories,
                "root_causes": reflection.root_causes,
                "stored_at": datetime.now().isoformat(),
            }
            self.memories[MemoryType.ERROR_PATTERN.value].append(error_pattern)

        logger.info(f"Stored reflection in long-term memory for workflow {reflection.workflow_id}")

    async def retrieve_similar_failures(
        self, error_categories: List[str], limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve similar failure patterns based on error categories.

        Args:
            error_categories: List of error categories to match
            limit: Maximum number of patterns to retrieve

        Returns:
            List of similar failure patterns
        """
        if not error_categories:
            return []

        similar_failures = []
        for failure in self.memories[MemoryType.FAILURE_PATTERN.value]:
            failure_categories = failure.get("error_categories", [])
            # Check if there's any overlap in error categories
            if any(cat in failure_categories for cat in error_categories):
                similar_failures.append(failure)

        # Sort by recency (most recent first)
        similar_failures.sort(
            key=lambda x: x.get("stored_at", ""), reverse=True
        )

        return similar_failures[:limit]

    async def retrieve_effective_fixes(
        self, error_category: str, limit: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieve effective fix strategies for a given error category.

        Args:
            error_category: Error category to find fixes for
            limit: Maximum number of fixes to retrieve

        Returns:
            List of effective fix strategies
        """
        effective_fixes = []
        for fix in self.memories[MemoryType.FIX_STRATEGY.value]:
            fix_categories = fix.get("error_categories", [])
            if error_category in fix_categories:
                # Only include fixes with high effectiveness
                if fix.get("effectiveness", 0) >= 0.6:
                    effective_fixes.append(fix)

        # Sort by effectiveness (highest first)
        effective_fixes.sort(
            key=lambda x: x.get("effectiveness", 0), reverse=True
        )

        return effective_fixes[:limit]

    async def retrieve_success_patterns(
        self, contract_type: Optional[str] = None, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve successful workflow patterns.

        Args:
            contract_type: Optional contract type to filter by
            limit: Maximum number of patterns to retrieve

        Returns:
            List of success patterns
        """
        success_patterns = self.memories[MemoryType.SUCCESS_PATTERN.value]

        # Filter by contract type if provided
        if contract_type:
            # Note: This would require storing contract_type in the pattern
            # For now, return all patterns
            pass

        # Sort by recency (most recent first)
        success_patterns.sort(
            key=lambda x: x.get("stored_at", ""), reverse=True
        )

        return success_patterns[:limit]

    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about stored memories.

        Returns:
            Dictionary with memory statistics
        """
        return {
            "success_patterns": len(self.memories[MemoryType.SUCCESS_PATTERN.value]),
            "failure_patterns": len(self.memories[MemoryType.FAILURE_PATTERN.value]),
            "fix_strategies": len(self.memories[MemoryType.FIX_STRATEGY.value]),
            "error_patterns": len(self.memories[MemoryType.ERROR_PATTERN.value]),
            "total_memories": sum(len(memories) for memories in self.memories.values()),
        }

