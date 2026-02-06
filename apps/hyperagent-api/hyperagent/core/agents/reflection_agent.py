"""
Reflection Agent for analyzing workflow outcomes and learning from mistakes.

The ReflectionAgent analyzes completed workflows (both successes and failures)
to identify patterns, root causes, and opportunities for improvement.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from pydantic import ValidationError as PydanticValidationError

from hyperagent.core.models.reflection_result import ReflectionResult
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class ReflectionAgent:
    """
    Analyzes workflow outcomes to identify patterns, root causes, and improvement opportunities.
    
    The ReflectionAgent performs post-mortem analysis on workflows to:
    - Identify root causes of failures
    - Extract lessons learned
    - Suggest system improvements
    - Build knowledge for future workflows
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        """
        Initialize Reflection Agent

        Args:
            llm_provider: LLM provider for reflection analysis
            multi_model_router: Optional multi-model router for dynamic LLM selection
        """
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router

        self.reflection_prompt_template = """
You are an expert system analyst and learning engineer. Your task is to perform a deep reflection on a smart contract workflow outcome to identify patterns, root causes, and improvement opportunities.

Workflow Information:
{workflow_info}

Workflow Outcome: {outcome}

Based on the above information, perform a comprehensive reflection analysis:

1. **Root Causes**: Identify the fundamental reasons for the outcome (success or failure). Look beyond surface-level symptoms.

2. **Patterns Identified**: Identify recurring patterns, common issues, or successful strategies observed in this workflow.

3. **Lessons Learned**: Extract actionable lessons that can improve future workflows.

4. **Improvement Suggestions**: Provide specific, actionable suggestions for improving the system based on this workflow.

5. **Error Categories**: Categorize any errors encountered (e.g., compilation, audit, deployment, capability).

6. **Fix Effectiveness**: If fixes were applied, assess their effectiveness (0.0-1.0).

Provide a JSON object matching the ReflectionResult Pydantic model:
{{
    "workflow_id": str,
    "outcome": str,
    "root_causes": List[str],
    "patterns_identified": List[str],
    "lessons_learned": List[str],
    "improvement_suggestions": List[str],
    "error_categories": List[str],
    "fix_effectiveness": Optional[float],
    "confidence_score": float,
    "metadata": Dict[str, Any]
}}

Ensure the JSON is valid and directly parsable. Be specific, actionable, and focused on learning.
"""

    async def reflect_on_workflow(
        self,
        workflow_id: str,
        workflow_data: Dict[str, Any],
        outcome: str,
    ) -> ReflectionResult:
        """
        Perform reflection analysis on a completed workflow.

        Args:
            workflow_id: ID of the workflow to reflect upon
            workflow_data: Complete workflow data including status, errors, metadata, etc.
            outcome: Workflow outcome ('success', 'failure', 'capability_exceeded')

        Returns:
            ReflectionResult with analysis findings
        """
        logger.info(f"Reflecting on workflow {workflow_id} with outcome: {outcome}")

        # Format workflow information for prompt
        workflow_info = self._format_workflow_info(workflow_data)

        prompt = self.reflection_prompt_template.format(
            workflow_info=workflow_info,
            outcome=outcome,
        )

        try:
            if self.multi_model_router:
                response_str, _ = await self.multi_model_router.route_task(
                    task="reflection_analysis", context=prompt, budget=75
                )
            else:
                response_str = await self.llm_provider.generate(prompt)

            reflection_data = self._parse_llm_response(response_str)

            # Ensure workflow_id matches
            reflection_data["workflow_id"] = workflow_id
            reflection_data["outcome"] = outcome

            # Add metadata
            reflection_data["metadata"] = reflection_data.get("metadata", {})
            reflection_data["metadata"]["reflected_at"] = datetime.now().isoformat()
            reflection_data["metadata"]["workflow_status"] = workflow_data.get("status")
            reflection_data["metadata"]["progress_percentage"] = workflow_data.get("progress_percentage")

            reflection_result = ReflectionResult(**reflection_data)
            logger.info(f"Successfully generated reflection for workflow {workflow_id}")
            return reflection_result

        except PydanticValidationError as e:
            logger.error(
                f"Pydantic validation error in reflection: {e}. LLM Response: {response_str[:500]}"
            )
            raise ValueError(f"Failed to validate reflection result: {e}") from e
        except Exception as e:
            logger.error(f"Failed to generate reflection with LLM: {e}", exc_info=True)
            raise ValueError(f"Reflection analysis failed: {e}") from e

    def _format_workflow_info(self, workflow_data: Dict[str, Any]) -> str:
        """
        Format workflow data into a readable string for the LLM prompt.

        Args:
            workflow_data: Workflow data dictionary

        Returns:
            Formatted string with workflow information
        """
        info_parts = []

        # Basic information
        info_parts.append(f"Workflow ID: {workflow_data.get('id', 'N/A')}")
        info_parts.append(f"Status: {workflow_data.get('status', 'N/A')}")
        info_parts.append(f"Progress: {workflow_data.get('progress_percentage', 0)}%")
        info_parts.append(f"Network: {workflow_data.get('network', 'N/A')}")
        info_parts.append(f"Contract Type: {workflow_data.get('contract_type', 'N/A')}")

        # NLP Input
        if workflow_data.get("nlp_input"):
            info_parts.append(f"\nUser Request:\n{workflow_data['nlp_input']}")

        # Error information
        if workflow_data.get("error_message"):
            info_parts.append(f"\nError Message:\n{workflow_data['error_message']}")
        if workflow_data.get("error_stacktrace"):
            info_parts.append(f"\nError Stacktrace:\n{workflow_data['error_stacktrace']}")

        # Metadata
        meta_data = workflow_data.get("meta_data") or workflow_data.get("metadata") or {}
        if meta_data:
            info_parts.append(f"\nMetadata:")
            
            # Requirements spec
            if meta_data.get("requirements_spec"):
                info_parts.append(f"  Requirements: {json.dumps(meta_data['requirements_spec'], indent=2)}")
            
            # Architecture design
            if meta_data.get("architecture_design"):
                info_parts.append(f"  Architecture: {json.dumps(meta_data['architecture_design'], indent=2)}")
            
            # Capability assessment
            if meta_data.get("capability_assessment"):
                info_parts.append(f"  Capability Assessment: {json.dumps(meta_data['capability_assessment'], indent=2)}")
            
            # Audit results
            if meta_data.get("audit_result"):
                audit_result = meta_data["audit_result"]
                info_parts.append(f"  Audit Status: {audit_result.get('audit_status', 'N/A')}")
                info_parts.append(f"  Vulnerabilities: {len(audit_result.get('vulnerabilities', []))}")
            
            # Test results
            if meta_data.get("test_result"):
                test_result = meta_data["test_result"]
                info_parts.append(f"  Test Status: {test_result.get('status', 'N/A')}")
                info_parts.append(f"  Tests Passed: {test_result.get('tests_passed', 0)}")
                info_parts.append(f"  Tests Failed: {test_result.get('tests_failed', 0)}")
            
            # Retry information
            if workflow_data.get("retry_count", 0) > 0:
                info_parts.append(f"  Retry Count: {workflow_data['retry_count']}")

        # Stages information
        if workflow_data.get("stages"):
            info_parts.append(f"\nWorkflow Stages:")
            for stage in workflow_data["stages"]:
                stage_name = stage.get("name") or stage.get("stage", "unknown")
                stage_status = stage.get("status", "unknown")
                info_parts.append(f"  - {stage_name}: {stage_status}")

        return "\n".join(info_parts)

    def _parse_llm_response(self, response_str: str) -> Dict[str, Any]:
        """Parses LLM JSON response, handling markdown code blocks."""
        # Remove markdown code block if present
        if response_str.strip().startswith("```json"):
            response_str = response_str.strip()[len("```json"):]
            if response_str.endswith("```"):
                response_str = response_str[:-len("```")]
        elif response_str.strip().startswith("```"):
            response_str = response_str.strip()[3:]
            if response_str.endswith("```"):
                response_str = response_str[:-len("```")]

        try:
            return json.loads(response_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON from LLM response: {e}. Response: {response_str[:500]}")
            raise ValueError(f"Invalid JSON response from LLM: {response_str[:200]}...") from e

