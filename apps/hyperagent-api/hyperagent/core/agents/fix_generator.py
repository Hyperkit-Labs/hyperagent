"""Fix generator agent for generating code fixes based on error analysis"""

import logging
from typing import Any, Dict, Optional

from hyperagent.core.agents.error_analyzer import ErrorAnalyzer
from hyperagent.core.models.error_analysis import ErrorAnalysis
from hyperagent.core.models.fix_suggestion import FixSuggestion, FixStrategy
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.core.services.generation_service import GenerationService
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class FixGenerator:
    """Generates code fixes based on error analysis and fix suggestions"""

    def __init__(
        self,
        error_analyzer: ErrorAnalyzer,
        generation_service: Optional[GenerationService] = None,
        llm_provider: Optional[LLMProvider] = None,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        """
        Initialize Fix Generator

        Args:
            error_analyzer: Error analyzer for analyzing errors
            generation_service: Generation service for regenerating code
            llm_provider: LLM provider for fix generation
            multi_model_router: Multi-model router for LLM calls
        """
        self.error_analyzer = error_analyzer
        self.generation_service = generation_service
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router

    async def generate_fix(
        self,
        contract_code: str,
        error_analysis: ErrorAnalysis,
        fix_suggestion: FixSuggestion,
        original_prompt: Optional[str] = None,
    ) -> str:
        """
        Generate fixed contract code based on error analysis and fix suggestion

        Args:
            contract_code: Current contract code with error
            error_analysis: Error analysis result
            fix_suggestion: Fix suggestion with strategy
            original_prompt: Original user prompt (for regeneration)

        Returns:
            Fixed contract code
        """
        logger.info(
            f"Generating fix using strategy: {fix_suggestion.strategy.value} "
            f"(confidence: {fix_suggestion.confidence})"
        )

        # Route to appropriate fix strategy
        if fix_suggestion.strategy == FixStrategy.REGENERATE_CODE:
            return await self._regenerate_code(contract_code, error_analysis, original_prompt)
        elif fix_suggestion.strategy == FixStrategy.ADD_IMPORT:
            return await self._add_missing_import(contract_code, error_analysis)
        elif fix_suggestion.strategy == FixStrategy.FIX_SYNTAX:
            return await self._fix_syntax_error(contract_code, error_analysis)
        elif fix_suggestion.strategy == FixStrategy.CORRECT_TYPE:
            return await self._correct_type_mismatch(contract_code, error_analysis)
        elif fix_suggestion.strategy == FixStrategy.ADD_SECURITY_CHECK:
            return await self._add_security_check(contract_code, error_analysis)
        elif fix_suggestion.strategy == FixStrategy.OPTIMIZE_GAS:
            return await self._optimize_gas(contract_code, error_analysis)
        elif fix_suggestion.strategy == FixStrategy.REFACTOR_LOGIC:
            return await self._refactor_logic(contract_code, error_analysis)
        else:
            # For manual review or unknown strategies, try regeneration
            logger.warning(
                f"Unknown strategy {fix_suggestion.strategy}, attempting regeneration"
            )
            return await self._regenerate_code(contract_code, error_analysis, original_prompt)

    async def _regenerate_code(
        self, contract_code: str, error_analysis: ErrorAnalysis, original_prompt: Optional[str]
    ) -> str:
        """Regenerate contract code with error corrections"""
        if not (self.generation_service or self.multi_model_router or self.llm_provider):
            logger.error("No generation service or LLM available for regeneration")
            return contract_code

        # Build prompt for regeneration
        prompt = f"""Fix the following Solidity contract that has compilation errors.

Original error:
{error_analysis.message}

Error category: {error_analysis.category.value}
Error severity: {error_analysis.severity.value}

Current contract code:
```solidity
{contract_code}
```

Please fix all errors and regenerate the complete, compilable contract code. Ensure:
1. All imports are correct
2. Syntax is valid
3. Types are correct
4. Logic is sound

Return ONLY the fixed Solidity code, no explanations."""

        try:
            if self.generation_service and original_prompt:
                # Use generation service with enhanced prompt
                result = await self.generation_service.process(
                    {
                        "nlp_description": f"{original_prompt}\n\nFix errors: {error_analysis.message}",
                        "contract_code": contract_code,
                        "error_context": error_analysis.message,
                    }
                )
                return result.get("contract_code", contract_code)
            elif self.multi_model_router:
                response, _ = await self.multi_model_router.route_task(
                    task="solidity_codegen",
                    context=prompt,
                    budget=50,
                )
                return self._extract_code_from_response(response)
            elif self.llm_provider:
                response = await self.llm_provider.generate(prompt)
                return self._extract_code_from_response(response)
            else:
                return contract_code
        except Exception as e:
            logger.error(f"Failed to regenerate code: {e}", exc_info=True)
            return contract_code

    async def _add_missing_import(
        self, contract_code: str, error_analysis: ErrorAnalysis
    ) -> str:
        """Add missing import statement"""
        # Extract missing import from error message
        error_msg = error_analysis.message.lower()
        import_patterns = [
            r"@openzeppelin/contracts/([^\s]+)",
            r"import\s+['\"]([^'\"]+)['\"]",
            r"cannot find.*['\"]([^'\"]+)['\"]",
        ]

        missing_import = None
        for pattern in import_patterns:
            import re

            match = re.search(pattern, error_analysis.message, re.IGNORECASE)
            if match:
                missing_import = match.group(1) if match.groups() else match.group(0)
                break

        if not missing_import:
            # Try LLM-based extraction
            return await self._regenerate_code(contract_code, error_analysis, None)

        # Add import at the top of the file
        import_line = f'import "{missing_import}";\n'
        if import_line not in contract_code:
            # Find the last import statement
            lines = contract_code.split("\n")
            last_import_idx = -1
            for i, line in enumerate(lines):
                if line.strip().startswith("import "):
                    last_import_idx = i

            if last_import_idx >= 0:
                lines.insert(last_import_idx + 1, import_line)
            else:
                # No imports found, add after pragma
                pragma_idx = next(
                    (i for i, line in enumerate(lines) if "pragma solidity" in line), -1
                )
                if pragma_idx >= 0:
                    lines.insert(pragma_idx + 1, import_line)
                else:
                    lines.insert(0, import_line)

            return "\n".join(lines)

        return contract_code

    async def _fix_syntax_error(
        self, contract_code: str, error_analysis: ErrorAnalysis
    ) -> str:
        """Fix syntax error in contract code"""
        # Extract location if available
        location = error_analysis.location
        if location and "line" in location:
            # Try to fix specific line
            return await self._regenerate_code(contract_code, error_analysis, None)
        else:
            # General syntax fix via regeneration
            return await self._regenerate_code(contract_code, error_analysis, None)

    async def _correct_type_mismatch(
        self, contract_code: str, error_analysis: ErrorAnalysis
    ) -> str:
        """Correct type mismatch error"""
        return await self._regenerate_code(contract_code, error_analysis, None)

    async def _add_security_check(
        self, contract_code: str, error_analysis: ErrorAnalysis
    ) -> str:
        """Add security check to fix vulnerability"""
        # Use LLM to add appropriate security checks
        prompt = f"""Add security checks to fix this vulnerability in the Solidity contract.

Vulnerability: {error_analysis.message}
Category: {error_analysis.category.value}

Current contract:
```solidity
{contract_code}
```

Add appropriate security checks (e.g., ReentrancyGuard, AccessControl, input validation).
Return the complete fixed contract code."""

        try:
            if self.multi_model_router:
                response, _ = await self.multi_model_router.route_task(
                    task="solidity_codegen",
                    context=prompt,
                    budget=30,
                )
                return self._extract_code_from_response(response)
            elif self.llm_provider:
                response = await self.llm_provider.generate(prompt)
                return self._extract_code_from_response(response)
            else:
                return await self._regenerate_code(contract_code, error_analysis, None)
        except Exception as e:
            logger.error(f"Failed to add security check: {e}")
            return await self._regenerate_code(contract_code, error_analysis, None)

    async def _optimize_gas(self, contract_code: str, error_analysis: ErrorAnalysis) -> str:
        """Optimize gas usage"""
        return await self._regenerate_code(contract_code, error_analysis, None)

    async def _refactor_logic(
        self, contract_code: str, error_analysis: ErrorAnalysis
    ) -> str:
        """Refactor logic to fix error"""
        return await self._regenerate_code(contract_code, error_analysis, None)

    def _extract_code_from_response(self, response: str) -> str:
        """Extract Solidity code from LLM response"""
        # Look for code blocks
        import re

        code_block_match = re.search(r"```solidity\n(.*?)\n```", response, re.DOTALL)
        if code_block_match:
            return code_block_match.group(1)

        code_block_match = re.search(r"```\n(.*?)\n```", response, re.DOTALL)
        if code_block_match:
            return code_block_match.group(1)

        # If no code block, return response as-is (might be pure code)
        return response.strip()

