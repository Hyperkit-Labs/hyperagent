"""Requirements agent for clarifying vague prompts and extracting structured specs"""

import logging
from typing import List, Optional, Tuple

from hyperagent.core.models.requirements_spec import (
    ContractType,
    EconomicModel,
    RequirementsSpec,
    RiskTolerance,
)
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class RequirementsAgent:
    """Agent for analyzing prompts, clarifying requirements, and extracting structured specs"""

    def __init__(
        self,
        llm_provider: Optional[LLMProvider] = None,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        """
        Initialize Requirements Agent

        Args:
            llm_provider: LLM provider for prompt analysis
            multi_model_router: Multi-model router for LLM calls
        """
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router

    async def needs_clarification(self, prompt: str) -> Tuple[bool, List[str]]:
        """
        Determine if prompt needs clarification

        Args:
            prompt: User prompt

        Returns:
            Tuple of (needs_clarification: bool, questions: List[str])
        """
        # Simple heuristics for vague prompts
        prompt_lower = prompt.lower()
        vague_indicators = [
            "something",
            "anything",
            "maybe",
            "perhaps",
            "not sure",
            "don't know",
            "help me",
            "what should",
        ]

        is_vague = any(indicator in prompt_lower for indicator in vague_indicators)
        is_short = len(prompt.split()) < 10

        if is_vague or is_short:
            # Generate clarifying questions using LLM if available
            questions = await self._generate_clarifying_questions(prompt)
            return True, questions[:2]  # Limit to 2 questions

        return False, []

    async def extract_spec(self, prompt: str) -> RequirementsSpec:
        """
        Extract structured requirements specification from prompt

        Args:
            prompt: User prompt (may be clarified)

        Returns:
            RequirementsSpec with extracted information
        """
        # Use LLM to extract structured spec if available
        if self.multi_model_router or self.llm_provider:
            try:
                spec_dict = await self._extract_spec_with_llm(prompt)
                return RequirementsSpec(**spec_dict)
            except Exception as e:
                logger.warning(f"Failed to extract spec with LLM: {e}, using heuristics")
                return self._extract_spec_heuristic(prompt)

        # Fallback to heuristic extraction
        return self._extract_spec_heuristic(prompt)

    async def clarify_requirements(self, prompt: str) -> RequirementsSpec:
        """
        Clarify requirements and extract spec (combines needs_clarification and extract_spec)

        Args:
            prompt: User prompt

        Returns:
            RequirementsSpec (may need clarification questions first)
        """
        needs_clarification, questions = await self.needs_clarification(prompt)

        if needs_clarification:
            # Return spec with clarification needed flag
            # In practice, this would be handled by the API to return questions to user
            spec = self._extract_spec_heuristic(prompt)
            spec.metadata["clarification_needed"] = True
            spec.metadata["clarification_questions"] = questions
            return spec

        return await self.extract_spec(prompt)

    async def _generate_clarifying_questions(self, prompt: str) -> List[str]:
        """Generate clarifying questions for vague prompts"""
        if not (self.multi_model_router or self.llm_provider):
            # Default questions
            return [
                "What type of contract do you want to create? (e.g., ERC20 token, NFT, subscription)",
                "What is the main purpose or functionality you need?",
            ]

        question_prompt = f"""The user provided this prompt for a smart contract:
"{prompt}"

Generate 2 specific, concise questions to clarify what they want. Focus on:
1. Contract type (token, NFT, subscription, etc.)
2. Key functionality or features needed

Return only the questions, one per line."""

        try:
            if self.multi_model_router:
                response, _ = await self.multi_model_router.route_task(
                    task="gas_optimization",  # Use existing task config
                    context=question_prompt,
                    budget=5,
                )
            else:
                response = await self.llm_provider.generate(question_prompt)

            questions = [q.strip() for q in response.split("\n") if q.strip()][:2]
            return questions if questions else [
                "What type of contract do you want to create?",
                "What is the main functionality needed?",
            ]
        except Exception as e:
            logger.warning(f"Failed to generate clarifying questions: {e}")
            return [
                "What type of contract do you want to create?",
                "What is the main functionality needed?",
            ]

    async def _extract_spec_with_llm(self, prompt: str) -> dict:
        """Extract structured spec using LLM"""
        extraction_prompt = f"""Extract structured requirements from this smart contract prompt:

"{prompt}"

Return a JSON object with these fields:
- contract_type: One of ERC20, ERC721, ERC1155, Custom, Subscription, Escrow, Paywall, Vesting, AMM, Lending, Vault
- economic_model: One of token, subscription, pay_per_use, escrow, vesting, staking, governance, none
- roles: List of roles needed (e.g., ["owner", "admin", "user"])
- risk_tolerance: One of low, medium, high
- networks: List of target networks (e.g., ["ethereum", "polygon"])
- features: List of specific features
- constraints: List of constraints
- description: The original prompt

Return ONLY valid JSON, no markdown, no explanations."""

        try:
            if self.multi_model_router:
                response, _ = await self.multi_model_router.route_task(
                    task="gas_optimization",
                    context=extraction_prompt,
                    budget=10,
                )
            else:
                response = await self.llm_provider.generate(extraction_prompt)

            # Parse JSON from response
            import json
            import re

            # Extract JSON from response (may be wrapped in markdown)
            json_match = re.search(r"\{.*\}", response, re.DOTALL)
            if json_match:
                spec_dict = json.loads(json_match.group(0))
            else:
                raise ValueError("No JSON found in LLM response")

            # Ensure required fields
            spec_dict.setdefault("contract_type", "Custom")
            spec_dict.setdefault("economic_model", "none")
            spec_dict.setdefault("description", prompt)

            return spec_dict
        except Exception as e:
            logger.error(f"Failed to extract spec with LLM: {e}", exc_info=True)
            raise

    def _extract_spec_heuristic(self, prompt: str) -> RequirementsSpec:
        """Extract spec using heuristics (fallback)"""
        prompt_lower = prompt.lower()

        # Determine contract type
        contract_type = ContractType.CUSTOM
        if "erc20" in prompt_lower or "token" in prompt_lower:
            contract_type = ContractType.ERC20
        elif "erc721" in prompt_lower or "nft" in prompt_lower or "non-fungible" in prompt_lower:
            contract_type = ContractType.ERC721
        elif "erc1155" in prompt_lower or "multi-token" in prompt_lower:
            contract_type = ContractType.ERC1155
        elif "subscription" in prompt_lower:
            contract_type = ContractType.SUBSCRIPTION
        elif "escrow" in prompt_lower:
            contract_type = ContractType.ESCROW
        elif "vesting" in prompt_lower:
            contract_type = ContractType.VESTING

        # Determine economic model
        economic_model = EconomicModel.NONE
        if contract_type == ContractType.ERC20 or contract_type == ContractType.ERC721:
            economic_model = EconomicModel.TOKEN
        elif contract_type == ContractType.SUBSCRIPTION:
            economic_model = EconomicModel.SUBSCRIPTION
        elif contract_type == ContractType.ESCROW:
            economic_model = EconomicModel.ESCROW
        elif contract_type == ContractType.VESTING:
            economic_model = EconomicModel.VESTING

        # Extract roles (simple heuristic)
        roles = []
        if "owner" in prompt_lower or "admin" in prompt_lower:
            roles.append("owner")
        if "user" in prompt_lower or "member" in prompt_lower:
            roles.append("user")

        # Default risk tolerance
        risk_tolerance = RiskTolerance.MEDIUM

        return RequirementsSpec(
            contract_type=contract_type,
            economic_model=economic_model,
            roles=roles,
            risk_tolerance=risk_tolerance,
            networks=[],  # Will be set by workflow
            features=[],
            constraints=[],
            description=prompt,
        )

