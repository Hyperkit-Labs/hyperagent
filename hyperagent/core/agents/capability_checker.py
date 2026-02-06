"""
Capability Checker for detecting unsupported requirements and graceful stopping.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from pydantic import ValidationError as PydanticValidationError

from hyperagent.core.models.capability_assessment import CapabilityAssessment
from hyperagent.core.models.requirements_spec import RequirementsSpec
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)

# Define system capabilities (can be expanded)
SUPPORTED_CONTRACT_TYPES = [
    "ERC20", "ERC721", "ERC1155", "Custom", "Subscription", "Escrow", "Vesting", "Paywall"
]

SUPPORTED_FEATURES = [
    "pausable", "upgradeable", "access_control", "reentrancy_guard", "burnable", "mintable",
    "permit", "multisig", "timelock", "vesting", "subscription", "escrow"
]

UNSUPPORTED_FEATURES = [
    "oracle_integration", "cross_chain", "layer2_specific", "complex_dex", "lending_protocol",
    "yield_farming", "governance_token", "dao_framework"
]


class CapabilityChecker:
    """
    Checks if requirements are within system capabilities and provides graceful stopping.
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        """
        Initialize Capability Checker

        Args:
            llm_provider: LLM provider for capability assessment
            multi_model_router: Optional multi-model router for dynamic LLM selection
        """
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router

        self.capability_prompt_template = """
You are a capability assessment agent for a smart contract generation system.
Analyze the given requirements specification and determine if the system can handle it.

System Capabilities:
- Supported Contract Types: {supported_types}
- Supported Features: {supported_features}
- Unsupported Features: {unsupported_features}

Requirements Specification:
{requirements_spec}

Analyze the requirements and provide a JSON assessment with:
1. **is_supported**: Boolean indicating if requirements are within capabilities
2. **unsupported_features**: List of specific features/requirements that are NOT supported
3. **supported_features**: List of features/requirements that ARE supported
4. **complexity_level**: Estimated complexity ('low', 'medium', 'high', 'very_high')
5. **risk_level**: Risk level ('low', 'medium', 'high')
6. **recommendations**: List of recommendations (e.g., simplify requirements, use alternative approaches)
7. **can_proceed**: Boolean indicating if workflow can proceed despite limitations (true if only minor limitations)
8. **reason**: Explanation of why requirements are or are not supported

Provide a JSON object matching the CapabilityAssessment Pydantic model:
{{
    "is_supported": bool,
    "unsupported_features": List[str],
    "supported_features": List[str],
    "complexity_level": str,
    "risk_level": str,
    "recommendations": List[str],
    "can_proceed": bool,
    "reason": str
}}

Ensure the JSON is valid and directly parsable.
"""

    async def assess_capability(
        self,
        requirements_spec: RequirementsSpec,
    ) -> CapabilityAssessment:
        """
        Assess if requirements are within system capabilities.

        Args:
            requirements_spec: Structured requirements specification

        Returns:
            CapabilityAssessment with capability analysis
        """
        logger.info(f"Assessing capabilities for contract type: {requirements_spec.contract_type}")

        # Format requirements spec as JSON string for prompt
        requirements_json = requirements_spec.model_dump_json(indent=2)

        prompt = self.capability_prompt_template.format(
            supported_types=", ".join(SUPPORTED_CONTRACT_TYPES),
            supported_features=", ".join(SUPPORTED_FEATURES),
            unsupported_features=", ".join(UNSUPPORTED_FEATURES),
            requirements_spec=requirements_json,
        )

        try:
            if self.multi_model_router:
                response_str, _ = await self.multi_model_router.route_task(
                    task="capability_assessment", context=prompt, budget=30
                )
            else:
                response_str = await self.llm_provider.generate(prompt)

            response_data = self._parse_llm_response(response_str)

            # Ensure required fields are present
            if "reason" not in response_data:
                response_data["reason"] = "Capability assessment completed."

            capability_assessment = CapabilityAssessment(**response_data)
            logger.info(
                f"Capability assessment: is_supported={capability_assessment.is_supported}, "
                f"can_proceed={capability_assessment.can_proceed}, "
                f"unsupported_features={len(capability_assessment.unsupported_features)}"
            )
            return capability_assessment

        except PydanticValidationError as e:
            logger.error(
                f"Pydantic validation error in capability assessment: {e}. LLM Response: {response_str}"
            )
            raise ValueError(f"Failed to validate capability assessment: {e}") from e
        except Exception as e:
            logger.error(f"Failed to assess capabilities with LLM: {e}", exc_info=True)
            raise ValueError(f"Capability assessment failed: {e}") from e

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

