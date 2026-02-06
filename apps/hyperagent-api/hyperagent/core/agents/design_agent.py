"""
Design Agent for generating architecture specifications before code generation.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from pydantic import ValidationError as PydanticValidationError

from hyperagent.core.models.architecture_design import ArchitectureDesign
from hyperagent.core.models.requirements_spec import RequirementsSpec
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class DesignAgent:
    """
    Generates architecture specifications from requirements before code synthesis.
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        """
        Initialize Design Agent

        Args:
            llm_provider: LLM provider for generating architecture designs
            multi_model_router: Optional multi-model router for dynamic LLM selection
        """
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router

        self.design_prompt_template = """
You are a senior Solidity architect and Web3 product engineer. Your task is to design a smart contract architecture based on the given requirements specification.

Requirements Specification:
{requirements_spec}

Target Network: {network}

Based on the requirements above, generate a comprehensive architecture design that includes:

1. **Contract Type**: The high-level contract type (e.g., ERC20, ERC721, Custom, Subscription, Escrow).

2. **Design Patterns**: List of design patterns to apply (e.g., 'Factory', 'Proxy', 'Registry', 'Multisig', 'Vesting').

3. **OpenZeppelin Modules**: List of OpenZeppelin modules to import and use (e.g., 'ReentrancyGuard', 'Ownable', 'Pausable', 'AccessControl', 'ERC20', 'ERC721').

4. **Contract Structure**: High-level structure including:
   - State variables (with types and purposes)
   - Functions (public, internal, private with brief descriptions)
   - Events (with parameters)
   - Modifiers (with purposes)

5. **Dependencies**: External dependencies required (e.g., '@openzeppelin/contracts', '@chainlink/contracts').

6. **Security Considerations**: Security considerations and mitigations (e.g., 'reentrancy protection', 'access control', 'overflow checks', 'input validation').

7. **Gas Optimization Strategies**: Gas optimization strategies to apply (e.g., 'packed storage', 'custom errors', 'immutable variables', 'batch operations').

8. **Limitations**: Known limitations or constraints of this architecture (e.g., 'single network support', 'no upgradeability', 'fixed supply').

9. **Rationale**: Explanation of why this architecture was chosen for the given requirements.

10. **Estimated Complexity**: Complexity level: 'low', 'medium', or 'high'.

11. **Compatibility Notes**: Compatibility notes for target networks or Solidity versions (if any).

Provide a JSON object matching the ArchitectureDesign Pydantic model structure:
{{
    "contract_type": str,
    "design_patterns": List[str],
    "openzeppelin_modules": List[str],
    "contract_structure": {{
        "state_variables": List[Dict[str, Any]],
        "functions": List[Dict[str, Any]],
        "events": List[Dict[str, Any]],
        "modifiers": List[Dict[str, Any]]
    }},
    "dependencies": List[str],
    "security_considerations": List[str],
    "gas_optimization_strategies": List[str],
    "limitations": List[str],
    "rationale": str,
    "estimated_complexity": str,
    "compatibility_notes": Optional[str]
}}

Ensure the JSON is valid and directly parsable.
"""

    async def design_architecture(
        self,
        requirements_spec: RequirementsSpec,
        network: str,
        rag_context: Optional[Dict[str, Any]] = None,
    ) -> ArchitectureDesign:
        """
        Generate architecture design from requirements specification.

        Args:
            requirements_spec: Structured requirements specification
            network: Target blockchain network
            rag_context: Optional RAG context from template/document retrieval

        Returns:
            ArchitectureDesign object with architecture specification
        """
        logger.info(
            f"Generating architecture design for contract type: {requirements_spec.contract_type}"
        )

        # Format requirements spec as JSON string for prompt
        requirements_json = requirements_spec.model_dump_json(indent=2)

        # Add RAG context if available
        rag_hint = ""
        if rag_context:
            templates = rag_context.get("templates", [])
            docs = rag_context.get("docs", [])
            if templates:
                rag_hint += f"\n\nRetrieved Templates: {len(templates)} templates found.\n"
            if docs:
                rag_hint += f"\n\nRetrieved Documentation: {len(docs)} documentation snippets found.\n"

        prompt = self.design_prompt_template.format(
            requirements_spec=requirements_json,
            network=network,
        ) + rag_hint

        try:
            if self.multi_model_router:
                response_str, _ = await self.multi_model_router.route_task(
                    task="architecture_design", context=prompt, budget=50
                )
            else:
                response_str = await self.llm_provider.generate(prompt)

            response_data = self._parse_llm_response(response_str)

            # Ensure required fields are present
            if "rationale" not in response_data:
                response_data["rationale"] = f"Architecture designed for {requirements_spec.contract_type} contract."

            architecture_design = ArchitectureDesign(**response_data)
            logger.info(
                f"Successfully generated architecture design: {architecture_design.contract_type} "
                f"with {len(architecture_design.openzeppelin_modules)} OpenZeppelin modules"
            )
            return architecture_design

        except PydanticValidationError as e:
            logger.error(
                f"Pydantic validation error in architecture design: {e}. LLM Response: {response_str}"
            )
            raise ValueError(f"Failed to validate architecture design: {e}") from e
        except Exception as e:
            logger.error(f"Failed to generate architecture design with LLM: {e}", exc_info=True)
            raise ValueError(f"Architecture design generation failed: {e}") from e

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

