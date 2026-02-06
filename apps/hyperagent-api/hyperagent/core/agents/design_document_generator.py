"""
Design Document Generator for capability-exceeded workflows.

Generates comprehensive design documents when workflow requirements exceed
system capabilities, providing users with detailed explanations and alternatives.
"""

import json
import logging
from typing import Any, Dict, Optional

from pydantic import ValidationError as PydanticValidationError

from hyperagent.core.models.capability_assessment import CapabilityAssessment
from hyperagent.core.models.requirements_spec import RequirementsSpec
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class DesignDocumentGenerator:
    """
    Generates comprehensive design documents for workflows that exceed system capabilities.
    
    When a workflow cannot proceed due to unsupported requirements, this agent creates
    a detailed design document explaining:
    - What was requested
    - Why it cannot be fulfilled
    - What alternatives exist
    - How to modify requirements to proceed
    - Future roadmap for supporting these features
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        """
        Initialize Design Document Generator

        Args:
            llm_provider: LLM provider for generating design documents
            multi_model_router: Optional multi-model router for dynamic LLM selection
        """
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router

        self.design_document_prompt_template = """
You are a senior blockchain architect and technical documentation specialist. Your task is to create a comprehensive design document for a smart contract workflow that cannot be completed due to system capability limitations.

User Requirements:
{requirements_spec_json}

Capability Assessment:
{capability_assessment_json}

Based on the above information, generate a detailed design document that includes:

1. **Executive Summary**: Brief overview of what was requested and why it cannot be fulfilled.

2. **Requirements Analysis**: Detailed breakdown of the user's requirements, highlighting:
   - Contract type and purpose
   - Key features requested
   - Economic model
   - Target networks
   - Risk tolerance

3. **Capability Gap Analysis**: Clear explanation of:
   - Which specific features are unsupported
   - Why these features are currently beyond system capabilities
   - Technical limitations preventing fulfillment

4. **Alternative Solutions**: Practical alternatives the user can consider:
   - Simplified versions of the requested contract
   - Feature substitutions that achieve similar goals
   - Step-by-step approach (build MVP first, then add features)
   - Manual development recommendations

5. **Modification Recommendations**: Specific guidance on how to modify requirements to make them feasible:
   - Which features to remove or simplify
   - Which features to replace with supported alternatives
   - How to break down complex requirements into manageable parts

6. **Future Roadmap**: Suggestions for future system enhancements that would enable this workflow:
   - Priority features to add
   - Technical considerations
   - Estimated complexity

7. **Next Steps**: Clear action items for the user:
   - Immediate actions they can take
   - How to re-submit with modified requirements
   - Resources for manual development if needed

Provide a JSON object with the following structure:
{{
    "executive_summary": str,
    "requirements_analysis": {{
        "contract_type": str,
        "purpose": str,
        "key_features": List[str],
        "economic_model": str,
        "target_networks": List[str],
        "risk_tolerance": str
    }},
    "capability_gap_analysis": {{
        "unsupported_features": List[str],
        "missing_information": List[str],
        "technical_limitations": List[str],
        "reasoning": str
    }},
    "alternative_solutions": List[{{
        "title": str,
        "description": str,
        "pros": List[str],
        "cons": List[str],
        "feasibility": str
    }}],
    "modification_recommendations": {{
        "features_to_remove": List[str],
        "features_to_simplify": List[str],
        "features_to_replace": List[{{
            "original": str,
            "replacement": str,
            "rationale": str
        }}],
        "step_by_step_approach": List[str]
    }},
    "future_roadmap": List[{{
        "feature": str,
        "priority": str,
        "complexity": str,
        "description": str
    }}],
    "next_steps": List[str],
    "estimated_effort": str
}}

Ensure the JSON is valid and directly parsable. Be specific, actionable, and helpful.
"""

    async def generate_design_document(
        self,
        requirements_spec: RequirementsSpec,
        capability_assessment: CapabilityAssessment,
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive design document for a capability-exceeded workflow.

        Args:
            requirements_spec: The user's requirements specification
            capability_assessment: The capability assessment showing what cannot be fulfilled

        Returns:
            Dictionary containing the complete design document
        """
        logger.info(
            f"Generating design document for capability-exceeded workflow: "
            f"{requirements_spec.contract_type}"
        )

        requirements_spec_json = requirements_spec.model_dump_json(indent=2)
        capability_assessment_json = capability_assessment.model_dump_json(indent=2)

        prompt = self.design_document_prompt_template.format(
            requirements_spec_json=requirements_spec_json,
            capability_assessment_json=capability_assessment_json,
        )

        try:
            if self.multi_model_router:
                response_str, _ = await self.multi_model_router.route_task(
                    task="design_document_generation", context=prompt, budget=75
                )
            else:
                response_str = await self.llm_provider.generate(prompt)

            design_document = self._parse_llm_response(response_str)

            # Validate structure and add metadata
            design_document["generated_at"] = json.dumps(
                {"timestamp": self._get_timestamp()}
            )
            design_document["workflow_id"] = None  # Will be set by caller
            design_document["requirements_spec"] = requirements_spec.model_dump()
            design_document["capability_assessment"] = capability_assessment.model_dump()

            logger.info("Successfully generated design document for capability-exceeded workflow")
            return design_document

        except PydanticValidationError as e:
            logger.error(
                f"Pydantic validation error in design document generation: {e}. "
                f"LLM Response: {response_str[:500]}"
            )
            raise ValueError(f"Failed to validate design document: {e}") from e
        except Exception as e:
            logger.error(f"Failed to generate design document with LLM: {e}", exc_info=True)
            raise ValueError(f"Design document generation failed: {e}") from e

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

    def _get_timestamp(self) -> str:
        """Get current timestamp as ISO format string."""
        from datetime import datetime
        return datetime.now().isoformat()

