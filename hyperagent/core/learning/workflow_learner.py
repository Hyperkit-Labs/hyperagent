"""
Workflow Learning System - AI-native learning from past workflows

This module implements a learning system that:
1. Stores successful workflow patterns
2. Learns from failures to avoid repeating mistakes
3. Caches common patterns for faster generation
4. Uses past workflows to inform future ones
"""

import logging
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from hyperagent.models.workflow import Workflow, WorkflowStatus
from hyperagent.models.contract import GeneratedContract

logger = logging.getLogger(__name__)


class WorkflowLearner:
    """
    AI-native learning system that learns from past workflows
    
    Features:
    - Pattern recognition: Identifies successful patterns
    - Failure analysis: Learns from mistakes
    - Speed optimization: Caches common patterns
    - Context enhancement: Uses past workflows to improve generation
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._pattern_cache: Dict[str, Any] = {}
        self._failure_patterns: Dict[str, List[str]] = {}
    
    async def learn_from_workflow(
        self,
        workflow_id: str,
        success: bool,
        execution_time: float,
        stages_completed: List[str],
        error_message: Optional[str] = None,
        contract_type: Optional[str] = None,
        network: Optional[str] = None,
    ) -> None:
        """
        Learn from a completed workflow
        
        Args:
            workflow_id: Workflow ID
            success: Whether workflow succeeded
            execution_time: Total execution time in seconds
            stages_completed: List of completed stages
            error_message: Error message if failed
            contract_type: Type of contract generated
            network: Target network
        """
        try:
            if success:
                await self._learn_from_success(
                    workflow_id, execution_time, stages_completed, contract_type, network
                )
            else:
                await self._learn_from_failure(
                    workflow_id, error_message, contract_type, network
                )
        except Exception as e:
            logger.warning(f"Failed to learn from workflow {workflow_id}: {e}")
    
    async def _learn_from_success(
        self,
        workflow_id: str,
        execution_time: float,
        stages_completed: List[str],
        contract_type: Optional[str],
        network: Optional[str],
    ) -> None:
        """Learn from successful workflows"""
        # Store successful pattern
        pattern_key = f"{contract_type}_{network}"
        if pattern_key not in self._pattern_cache:
            self._pattern_cache[pattern_key] = {
                "success_count": 0,
                "avg_execution_time": 0.0,
                "stages": [],
                "last_updated": datetime.now(),
            }
        
        pattern = self._pattern_cache[pattern_key]
        pattern["success_count"] += 1
        pattern["avg_execution_time"] = (
            (pattern["avg_execution_time"] * (pattern["success_count"] - 1) + execution_time)
            / pattern["success_count"]
        )
        pattern["stages"] = stages_completed
        pattern["last_updated"] = datetime.now()
        
        logger.info(
            f"Learned from successful workflow {workflow_id}: "
            f"{contract_type} on {network} took {execution_time:.2f}s"
        )
    
    async def _learn_from_failure(
        self,
        workflow_id: str,
        error_message: Optional[str],
        contract_type: Optional[str],
        network: Optional[str],
    ) -> None:
        """Learn from failed workflows to avoid repeating mistakes"""
        if not error_message:
            return
        
        # Extract error pattern
        error_key = self._extract_error_pattern(error_message)
        if error_key:
            if error_key not in self._failure_patterns:
                self._failure_patterns[error_key] = []
            
            failure_info = {
                "workflow_id": workflow_id,
                "contract_type": contract_type,
                "network": network,
                "error": error_message,
                "timestamp": datetime.now(),
            }
            self._failure_patterns[error_key].append(failure_info)
            
            # Keep only last 10 failures per pattern
            if len(self._failure_patterns[error_key]) > 10:
                self._failure_patterns[error_key] = self._failure_patterns[error_key][-10:]
            
            logger.info(
                f"Learned from failed workflow {workflow_id}: "
                f"Error pattern '{error_key}' for {contract_type} on {network}"
            )
    
    def _extract_error_pattern(self, error_message: str) -> Optional[str]:
        """Extract error pattern from error message"""
        error_lower = error_message.lower()
        
        # Common error patterns
        if "timeout" in error_lower:
            return "timeout"
        elif "compilation" in error_lower or "syntax" in error_lower:
            return "compilation_error"
        elif "audit" in error_lower or "vulnerability" in error_lower:
            return "audit_failure"
        elif "deployment" in error_lower or "transaction" in error_lower:
            return "deployment_error"
        elif "network" in error_lower or "connection" in error_lower:
            return "network_error"
        elif "architecture" in error_lower or "design" in error_lower:
            return "architecture_error"
        
        return None
    
    async def get_similar_successful_workflows(
        self,
        contract_type: str,
        network: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Get similar successful workflows for pattern matching
        
        Args:
            contract_type: Type of contract
            network: Target network
            limit: Maximum number of workflows to return
            
        Returns:
            List of successful workflow patterns
        """
        try:
            # Query successful workflows with same contract type and network
            result = await self.db.execute(
                select(Workflow)
                .where(Workflow.status == WorkflowStatus.COMPLETED.value)
                .where(Workflow.network == network)
                .order_by(Workflow.completed_at.desc())
                .limit(limit)
            )
            workflows = result.scalars().all()
            
            similar_workflows = []
            for workflow in workflows:
                # Check if contract type matches
                meta_data = workflow.meta_data or {}
                workflow_contract_type = meta_data.get("contract_type", "Custom")
                
                if workflow_contract_type == contract_type or contract_type == "Custom":
                    # Get contract for this workflow
                    from hyperagent.models.contract import GeneratedContract
                    contract_result = await self.db.execute(
                        select(GeneratedContract)
                        .where(GeneratedContract.workflow_id == workflow.id)
                        .limit(1)
                    )
                    contract = contract_result.scalar_one_or_none()
                    
                    if contract:
                        similar_workflows.append({
                            "workflow_id": str(workflow.id),
                            "contract_type": workflow_contract_type,
                            "network": workflow.network,
                            "nlp_input": workflow.nlp_input[:200],  # Truncate
                            "source_code": contract.source_code[:500] if contract.source_code else None,  # Truncate
                            "execution_time": (
                                (workflow.completed_at - workflow.created_at).total_seconds()
                                if workflow.completed_at and workflow.created_at
                                else None
                            ),
                            "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
                        })
            
            return similar_workflows[:limit]
        except Exception as e:
            logger.warning(f"Failed to get similar workflows: {e}")
            return []
    
    async def get_failure_prevention_hints(
        self,
        contract_type: str,
        network: str,
    ) -> List[str]:
        """
        Get hints to prevent known failure patterns
        
        Args:
            contract_type: Type of contract
            network: Target network
            
        Returns:
            List of prevention hints
        """
        hints = []
        
        # Check failure patterns
        for error_pattern, failures in self._failure_patterns.items():
            # Count failures for this contract type and network
            relevant_failures = [
                f for f in failures
                if (f["contract_type"] == contract_type or contract_type == "Custom")
                and f["network"] == network
            ]
            
            if len(relevant_failures) >= 2:  # If 2+ failures with same pattern
                if error_pattern == "timeout":
                    hints.append(
                        "Previous workflows timed out. Consider skipping architecture design "
                        "or using template-based generation for faster execution."
                    )
                elif error_pattern == "compilation_error":
                    hints.append(
                        "Previous workflows had compilation errors. Ensure generated code "
                        "follows Solidity syntax standards and uses compatible compiler versions."
                    )
                elif error_pattern == "architecture_error":
                    hints.append(
                        "Previous workflows failed at architecture design. Consider using "
                        "template-based generation or skipping architecture design phase."
                    )
        
        return hints
    
    def get_cached_pattern(
        self,
        contract_type: str,
        network: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached pattern for faster generation
        
        Args:
            contract_type: Type of contract
            network: Target network
            
        Returns:
            Cached pattern or None
        """
        pattern_key = f"{contract_type}_{network}"
        pattern = self._pattern_cache.get(pattern_key)
        
        # Return pattern if it's recent (within last 24 hours)
        if pattern:
            age = datetime.now() - pattern["last_updated"]
            if age < timedelta(hours=24):
                return pattern
        
        return None
    
    async def should_skip_architecture_design(
        self,
        contract_type: str,
        network: str,
        nlp_input: str,
    ) -> bool:
        """
        Determine if architecture design should be skipped based on learning
        
        Args:
            contract_type: Type of contract
            network: Target network
            nlp_input: User's natural language input
            
        Returns:
            True if architecture design should be skipped
        """
        # Skip if we have cached pattern indicating fast template-based generation
        pattern = self.get_cached_pattern(contract_type, network)
        if pattern and pattern["success_count"] >= 3:
            # If we have 3+ successful workflows, likely template-based
            return True
        
        # Skip if architecture design has failed multiple times
        architecture_failures = self._failure_patterns.get("architecture_error", [])
        relevant_failures = [
            f for f in architecture_failures
            if (f["contract_type"] == contract_type or contract_type == "Custom")
            and f["network"] == network
        ]
        
        if len(relevant_failures) >= 2:
            logger.info(
                f"Skipping architecture design due to {len(relevant_failures)} previous failures"
            )
            return True
        
        # Check if input suggests template usage
        template_keywords = ["template", "standard", "erc20", "erc721", "erc1155", "nft", "token"]
        if any(keyword in nlp_input.lower() for keyword in template_keywords):
            return True
        
        return False

