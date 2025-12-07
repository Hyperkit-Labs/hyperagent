"""Generation Agent implementation"""

import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType
from hyperagent.llm.provider import LLMProvider
from hyperagent.rag.template_retriever import TemplateRetriever

logger = logging.getLogger(__name__)


class GenerationAgent(ServiceInterface):
    """
    Generation Agent

    Concept: Converts NLP to Solidity code
    Logic: RAG → LLM → Code Extraction → Validation
    SLA: p99 < 45s, p95 < 30s
    """

    def __init__(
        self, llm_provider: LLMProvider, template_retriever: TemplateRetriever, event_bus: EventBus
    ):
        self.llm_provider = llm_provider
        self.template_retriever = template_retriever
        self.event_bus = event_bus

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate contract from NLP

        Input:
            {
                "nlp_description": "Create ERC20 token",
                "contract_type": "ERC20",
                "network": "hyperion_testnet",
                "workflow_id": "workflow-123"
            }

        Output:
            {
                "status": "success",
                "contract_code": "pragma solidity...",
                "contract_type": "ERC20",
                "abi": {...},
                "constructor_args": [...]
            }
        """
        workflow_id = input_data.get("workflow_id", str(uuid.uuid4()))

        # Publish start event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.GENERATION_STARTED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data=input_data,
                source_agent="generation",
            )
        )

        try:
            # Retrieve templates and generate
            contract_code = await self.template_retriever.retrieve_and_generate(
                input_data["nlp_description"], input_data.get("contract_type", "Custom")
            )

            # Validate contract
            validation = self._validate_contract(contract_code)
            if not validation["valid"]:
                raise ValueError(f"Contract validation failed: {', '.join(validation['errors'])}")

            # Extract ABI using compiler (includes constructor info)
            abi = self._extract_abi(contract_code)

            # Extract constructor arguments from ABI (more reliable than regex)
            constructor_params = self._extract_constructor_args_from_abi(abi)
            logger.debug(
                f"Extracted {len(constructor_params)} constructor parameters: {[p.get('name', 'unnamed') for p in constructor_params]}"
            )

            # Generate constructor argument values from NLP description
            constructor_values = []
            if constructor_params:
                logger.debug(
                    f"Generating constructor values for {len(constructor_params)} parameters"
                )
                wallet_address = input_data.get(
                    "wallet_address"
                )  # Get wallet address for constructor defaults
                constructor_values = await self._generate_constructor_values(
                    constructor_params,
                    input_data["nlp_description"],
                    contract_code,
                    wallet_address=wallet_address,
                )
                logger.debug(
                    f"Generated {len(constructor_values)} constructor values: {constructor_values}"
                )

            result = {
                "status": "success",
                "contract_code": contract_code,
                "contract_type": input_data.get("contract_type"),
                "abi": abi,
                "constructor_args": constructor_values,  # Use actual values, not parameter definitions
                "constructor_params": constructor_params,  # Keep parameter definitions for reference
                "validation": validation,
            }

            # Publish completion event
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.GENERATION_COMPLETED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data=result,
                    source_agent="generation",
                )
            )

            return result

        except Exception as e:
            await self.on_error(e)
            raise

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate NLP input"""
        return bool(data.get("nlp_description") and len(data["nlp_description"]) > 10)

    async def on_error(self, error: Exception) -> None:
        """Handle generation errors"""
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.GENERATION_FAILED,
                workflow_id="",
                timestamp=datetime.now(),
                data={"error": str(error)},
                source_agent="generation",
            )
        )

    def _extract_abi(self, contract_code: str) -> Dict[str, Any]:
        """
        Extract ABI from contract code using Solidity compiler

        Concept: Compile contract to get ABI (Application Binary Interface)
        Logic:
            1. Compile contract using solc
            2. Extract ABI from compilation artifacts
            3. Format as JSON structure
        """
        try:
            from py_solc_x import compile_source

            # Strip markdown code blocks if present (safety net)
            contract_code = self._strip_markdown_code_blocks(contract_code)

            # Compile contract
            compiled = compile_source(contract_code)

            if not compiled:
                logger.warning("Contract compilation returned empty result")
                return {"functions": [], "events": [], "errors": [], "constructor": None}

            # Get first contract (assuming single contract)
            contract_name = list(compiled.keys())[0]
            contract_data = compiled[contract_name]

            # Extract ABI
            abi = contract_data.get("abi", [])

            # Structure ABI by type
            structured_abi = {
                "functions": [item for item in abi if item.get("type") == "function"],
                "events": [item for item in abi if item.get("type") == "event"],
                "errors": [item for item in abi if item.get("type") == "error"],
                "constructor": next(
                    (item for item in abi if item.get("type") == "constructor"), None
                ),
            }

            return structured_abi
        except ImportError:
            logger.warning("py-solc-x not available, falling back to regex parsing")
            return self._extract_abi_regex(contract_code)
        except Exception as e:
            logger.error(f"ABI extraction failed: {e}", exc_info=True)
            # Fallback: return empty structure
            return {"functions": [], "events": [], "errors": [], "constructor": None}

    def _strip_markdown_code_blocks(self, text: str) -> str:
        """
        Strip markdown code blocks from contract code (safety net)

        This is a fallback in case markdown wasn't stripped earlier in the pipeline.

        Args:
            text: Contract code that may contain markdown formatting

        Returns:
            Clean Solidity code without markdown
        """
        from hyperagent.utils.markdown import strip_markdown_code_blocks

        return strip_markdown_code_blocks(text)

    def _extract_abi_regex(self, contract_code: str) -> Dict[str, Any]:
        """Fallback ABI extraction using regex (basic)"""
        functions = []
        events = []

        # Extract function signatures
        function_pattern = r"function\s+(\w+)\s*\([^)]*\)\s*(?:public|external|internal|private)?"
        for match in re.finditer(function_pattern, contract_code):
            functions.append(
                {"name": match.group(1), "type": "function", "stateMutability": "nonpayable"}
            )

        # Extract event signatures
        event_pattern = r"event\s+(\w+)\s*\([^)]*\)"
        for match in re.finditer(event_pattern, contract_code):
            events.append({"name": match.group(1), "type": "event"})

        return {"functions": functions, "events": events, "errors": [], "constructor": None}

    def _extract_constructor_args_from_abi(self, abi: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract constructor arguments from ABI (more reliable than regex parsing)

        Uses the compiler-generated ABI which has complete type information.
        """
        constructor = abi.get("constructor")
        if not constructor:
            return []  # No constructor

        inputs = constructor.get("inputs", [])
        params = []

        for i, input_item in enumerate(inputs):
            param = {
                "name": input_item.get("name", f"param_{i}"),
                "type": input_item.get("type", "unknown"),
                "storage_location": None,  # ABI doesn't include storage location for constructors
                "indexed": False,
            }

            # Handle complex types from ABI
            if "components" in input_item:
                # Struct type
                param["components"] = input_item["components"]
                param["type"] = "tuple"

            params.append(param)

        return params

    async def _generate_constructor_values(
        self,
        constructor_params: List[Dict[str, Any]],
        nlp_description: str,
        contract_code: str,
        wallet_address: Optional[str] = None,
    ) -> List[Any]:
        """
        Generate constructor argument values from NLP description

        Uses LLM to extract values from NLP description based on constructor parameters.
        Falls back to sensible defaults if values cannot be extracted.
        Includes timeout handling to prevent indefinite hanging.

        Args:
            constructor_params: List of constructor parameter definitions
            nlp_description: Original NLP description
            contract_code: Generated contract code

        Returns:
            List of actual values to pass to constructor (guaranteed to match constructor_params length)
        """
        if not constructor_params:
            return []

        try:
            # Build prompt for LLM to extract constructor values
            param_descriptions = []
            for i, param in enumerate(constructor_params):
                param_name = param.get("name", f"param_{i}")
                param_type = param.get("type", "unknown")
                param_descriptions.append(f"{i+1}. {param_name} ({param_type})")

            prompt = f"""Extract constructor argument values from the following contract description.

Contract Description:
{nlp_description}

Constructor Parameters:
{chr(10).join(param_descriptions)}

Contract Code (for reference):
```solidity
{contract_code[:1000]}  # First 1000 chars for context
```

Return ONLY a JSON array of values in the exact order of the parameters.
- For string types: Use quoted strings
- For uint256/int256: Use numbers without quotes
- For address: Use hex strings starting with 0x
- For bool: Use true or false
- For arrays: Use JSON array syntax
- If a value is not specified in the description, use a sensible default:
  - string: "Default" or extract from description
  - uint256: 1000000 or extract number from description
  - address: Use deployer wallet address {wallet_address if wallet_address else "user wallet address (required)"} (must provide actual deployer address)
  - bool: false

Example response format:
["MyToken", "MTK", 1000000]

Return ONLY the JSON array, no other text."""

            # Use LLM to extract values with timeout
            import asyncio

            from hyperagent.core.config import settings

            try:
                llm_response = await asyncio.wait_for(
                    self.llm_provider.generate(prompt, temperature=0.1, max_output_tokens=500),
                    timeout=settings.llm_constructor_timeout_seconds,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    f"LLM call for constructor values timed out after {settings.llm_constructor_timeout_seconds}s, using default values"
                )
                return self._get_default_values(constructor_params, wallet_address)

            # Parse JSON response
            import json
            import re

            # Extract JSON array from response (handle markdown code blocks)
            json_match = re.search(r"\[.*?\]", llm_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                # Try to find JSON in code blocks
                json_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", llm_response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_str = llm_response.strip()

            # Parse JSON
            try:
                values = json.loads(json_str)
                if not isinstance(values, list):
                    values = [values]

                # Ensure we have the right number of values
                if len(values) != len(constructor_params):
                    logger.warning(
                        f"LLM returned {len(values)} values but expected {len(constructor_params)}"
                    )
                    # Pad with defaults or truncate
                    if len(values) < len(constructor_params):
                        values.extend(
                            self._get_default_values(
                                constructor_params[len(values) :], wallet_address
                            )
                        )
                    else:
                        values = values[: len(constructor_params)]

                # Convert values to appropriate types
                converted_values = []
                for i, (value, param) in enumerate(zip(values, constructor_params)):
                    converted = self._convert_constructor_value(
                        value, param, wallet_address=wallet_address
                    )
                    converted_values.append(converted)

                logger.info(f"Generated constructor values: {converted_values}")

                # Final validation: ensure we have correct number of values
                if len(converted_values) != len(constructor_params):
                    logger.warning(
                        f"Constructor values count mismatch: got {len(converted_values)}, expected {len(constructor_params)}. Using defaults."
                    )
                    return self._get_default_values(constructor_params, wallet_address)

                return converted_values

            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse LLM response as JSON: {e}")
                logger.warning(f"LLM response: {llm_response[:200]}")
                logger.warning("Falling back to default constructor values")
                # Fall back to defaults
                return self._get_default_values(constructor_params)

        except Exception as e:
            logger.error(f"Failed to generate constructor values: {e}")
            logger.warning("Falling back to default constructor values")
            # Fall back to defaults
            return self._get_default_values(constructor_params, wallet_address)

    def _get_default_values(
        self, constructor_params: List[Dict[str, Any]], wallet_address: Optional[str] = None
    ) -> List[Any]:
        """Get sensible default values for constructor parameters"""
        defaults = []
        for param in constructor_params:
            param_type = param.get("type", "").lower()
            if "string" in param_type:
                defaults.append("Default")
            elif "uint" in param_type or "int" in param_type:
                defaults.append(1000000)  # Default to 1 million
            elif "address" in param_type:
                # Use actual wallet address if available, otherwise zero address
                defaults.append(
                    wallet_address
                    if wallet_address
                    else "0x0000000000000000000000000000000000000000"
                )
            elif "bool" in param_type:
                defaults.append(False)
            elif "[]" in param_type or "array" in param_type:
                defaults.append([])
            else:
                defaults.append(None)
        return defaults

    def _convert_constructor_value(
        self, value: Any, param: Dict[str, Any], wallet_address: Optional[str] = None
    ) -> Any:
        """Convert value to appropriate type for constructor parameter"""
        param_type = param.get("type", "").lower()

        # Handle string types
        if "string" in param_type:
            return str(value) if value is not None else "Default"

        # Handle numeric types
        if "uint" in param_type or "int" in param_type:
            try:
                return int(value)
            except (ValueError, TypeError):
                return 0

        # Handle address types
        if "address" in param_type:
            if isinstance(value, str) and value.startswith("0x"):
                return value
            # Use wallet_address if available, otherwise raise error (should not happen if _get_default_values is used)
            if wallet_address:
                return wallet_address
            # This should not happen in normal flow, but provide a clear error
            raise ValueError(
                "Address type constructor parameter requires a wallet address. "
                "Please ensure wallet_address is provided to the generation process."
            )

        # Handle bool types
        if "bool" in param_type:
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ("true", "1", "yes")
            return bool(value)

        # Handle arrays
        if "[]" in param_type or "array" in param_type:
            if isinstance(value, list):
                return value
            return []

        # Default: return as-is
        return value

    def _validate_contract(self, contract_code: str) -> Dict[str, Any]:
        """
        Validate contract structure and syntax

        Concept: Ensure contract is valid Solidity code
        Logic:
            1. Check for pragma directive
            2. Verify contract keyword exists
            3. Basic syntax validation
            4. Check for common security patterns
        """
        validation_result = {"valid": True, "errors": [], "warnings": []}

        # Check pragma
        if "pragma solidity" not in contract_code:
            validation_result["warnings"].append("No pragma directive found")

        # Check contract keyword
        if "contract" not in contract_code and "interface" not in contract_code:
            validation_result["valid"] = False
            validation_result["errors"].append("No contract or interface found")

        # Check for basic structure
        open_braces = contract_code.count("{")
        close_braces = contract_code.count("}")
        if open_braces != close_braces:
            validation_result["valid"] = False
            validation_result["errors"].append(
                f"Unbalanced braces: {open_braces} open, {close_braces} close"
            )

        # Check for balanced parentheses
        open_parens = contract_code.count("(")
        close_parens = contract_code.count(")")
        if open_parens != close_parens:
            validation_result["warnings"].append(
                f"Unbalanced parentheses: {open_parens} open, {close_parens} close"
            )

        # Security checks
        if "selfdestruct" in contract_code and "onlyOwner" not in contract_code:
            validation_result["warnings"].append("selfdestruct without access control detected")

        if "delegatecall" in contract_code:
            validation_result["warnings"].append(
                "delegatecall usage detected - ensure proper validation"
            )

        return validation_result
