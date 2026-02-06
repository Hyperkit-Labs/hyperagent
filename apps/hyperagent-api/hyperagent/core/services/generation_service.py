"""Generation service implementation"""

import logging
import re
from typing import Any, Dict, Optional

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.core.config import settings
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.llm.acontext_client import AcontextClient
from hyperagent.llm.provider import LLMProvider
from hyperagent.rag.template_retriever import TemplateRetriever

logger = logging.getLogger(__name__)


class GenerationService(ServiceInterface):
    """LLM-based contract generation service with Acontext memory integration"""

    def __init__(
        self,
        llm_provider: LLMProvider,
        template_retriever: Optional[TemplateRetriever] = None,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        self.llm_provider = llm_provider
        self.template_retriever = template_retriever
        self.multi_model_router = multi_model_router
        # Initialize Acontext client if enabled
        self.acontext = AcontextClient() if settings.enable_acontext else None

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate smart contract from NLP description with Acontext enhancement"""
        import time
        start_time = time.time()
        
        nlp_desc = input_data.get("nlp_description")
        contract_type = input_data.get("contract_type", "Custom")
        network = input_data.get("network", "")
        rag_context = input_data.get("rag_context", "")
        architecture_design = input_data.get("architecture_design")  # Phase 3: Architecture design
        similar_workflows = input_data.get("similar_workflows", [])  # Learning: Past successful workflows

        logger.info(f"Starting contract generation for type: {contract_type}, network: {network}")
        
        # Enhance prompt with similar successful workflows (learning system)
        if similar_workflows:
            logger.info(f"Enhancing generation with {len(similar_workflows)} similar successful workflows")
            learning_context = "\n\n=== LEARNING FROM PAST SUCCESSFUL WORKFLOWS ===\n"
            learning_context += "The following similar workflows succeeded. Use their patterns:\n\n"
            for i, similar in enumerate(similar_workflows[:3], 1):  # Use top 3
                learning_context += f"{i}. Contract Type: {similar.get('contract_type', 'Custom')}\n"
                learning_context += f"   Network: {similar.get('network', 'unknown')}\n"
                learning_context += f"   Execution Time: {similar.get('execution_time', 'N/A')}s\n"
                if similar.get('source_code'):
                    learning_context += f"   Pattern: {similar['source_code'][:200]}...\n"
                learning_context += "\n"
            nlp_desc = learning_context + "\n=== YOUR REQUIREMENTS ===\n" + nlp_desc
        
        # Enhance prompt with Acontext memory (if enabled)
        enhanced_prompt = nlp_desc
        logger.debug("Enhancing prompt with Acontext memory (if enabled)")
        if self.acontext and self.acontext.enabled:
            try:
                # Retrieve similar contracts
                similar_contracts = await self.acontext.retrieve_similar_contracts(
                    query=nlp_desc, contract_type=contract_type, limit=5
                )

                # Get common audit issues
                audit_issues = await self.acontext.get_audit_issues(contract_type=contract_type)

                # Enhance prompt with context
                enhanced_prompt = self.acontext.enhance_prompt(
                    base_prompt=nlp_desc,
                    similar_contracts=similar_contracts,
                    audit_issues=audit_issues,
                )

                logger.info(
                    f"Enhanced prompt with {len(similar_contracts)} similar contracts and {len(audit_issues)} audit issues"
                )
            except Exception as e:
                logger.warning(
                    f"Failed to enhance prompt with Acontext: {e}, using original prompt"
                )
                enhanced_prompt = nlp_desc

        # Enhance prompt with architecture design if available (Phase 3)
        architecture_hint = ""
        if architecture_design:
            import json
            try:
                # If architecture_design is a dict, convert to JSON string
                if isinstance(architecture_design, dict):
                    arch_json = json.dumps(architecture_design, indent=2)
                    openzeppelin_modules = architecture_design.get("openzeppelin_modules", [])
                    design_patterns = architecture_design.get("design_patterns", [])
                    security_considerations = architecture_design.get("security_considerations", [])
                    gas_optimization_strategies = architecture_design.get("gas_optimization_strategies", [])
                else:
                    arch_json = architecture_design.model_dump_json(indent=2) if hasattr(architecture_design, "model_dump_json") else str(architecture_design)
                    openzeppelin_modules = architecture_design.openzeppelin_modules if hasattr(architecture_design, "openzeppelin_modules") else []
                    design_patterns = architecture_design.design_patterns if hasattr(architecture_design, "design_patterns") else []
                    security_considerations = architecture_design.security_considerations if hasattr(architecture_design, "security_considerations") else []
                    gas_optimization_strategies = architecture_design.gas_optimization_strategies if hasattr(architecture_design, "gas_optimization_strategies") else []
                
                architecture_hint = f"""

=== ARCHITECTURE DESIGN ===
Use the following architecture specification to guide code generation:

{arch_json}

Ensure the generated contract:
- Uses the specified OpenZeppelin modules: {openzeppelin_modules}
- Follows the design patterns: {design_patterns}
- Implements the contract structure as specified
- Addresses security considerations: {security_considerations}
- Applies gas optimization strategies: {gas_optimization_strategies}
"""
                enhanced_prompt = enhanced_prompt + architecture_hint
                logger.info("Enhanced prompt with architecture design")
            except Exception as e:
                logger.warning(f"Failed to add architecture design to prompt: {e}")

        # Use Multi-Model Router if available, otherwise fallback to template retriever or direct LLM
        logger.info("Starting contract code generation")
        generation_start_time = time.time()
        
        try:
            if self.multi_model_router and rag_context:
                try:
                    logger.info("Using Multi-Model Router for code generation")
                    # Include architecture design in context if available
                    context_with_arch = rag_context + architecture_hint if architecture_hint else rag_context
                    logger.debug(f"Calling Multi-Model Router with timeout: {60}s")
                    contract_code, credits_used = await self.multi_model_router.route_task(
                        task="solidity_codegen",
                        context=context_with_arch,
                        budget=100,
                        is_private=input_data.get("is_private", False),
                    )
                    elapsed = time.time() - generation_start_time
                    logger.info(f"Generated code using Multi-Model Router (credits: {credits_used}, elapsed: {elapsed:.2f}s)")
                except Exception as e:
                    elapsed = time.time() - generation_start_time
                    logger.warning(f"Multi-Model Router failed after {elapsed:.2f}s: {e}, falling back to template retriever")
                    if self.template_retriever:
                        logger.info("Falling back to template retriever")
                        contract_code = await self.template_retriever.retrieve_and_generate(
                            enhanced_prompt, contract_type
                        )
                    else:
                        logger.info("Falling back to direct LLM generation")
                        # Direct LLM generation without template retrieval
                        contract_code = await self._generate_direct(enhanced_prompt, contract_type, network)
            else:
                # Generate contract using RAG with enhanced prompt or direct LLM
                if self.template_retriever:
                    logger.info("Using template retriever for code generation")
                    contract_code = await self.template_retriever.retrieve_and_generate(
                        enhanced_prompt, contract_type
                    )
                else:
                    logger.info("Using direct LLM generation (no template retriever)")
                    # Direct LLM generation without template retrieval
                    contract_code = await self._generate_direct(enhanced_prompt, contract_type, network)
            
            total_elapsed = time.time() - start_time
            logger.info(f"Contract generation completed successfully in {total_elapsed:.2f}s")
        except Exception as e:
            total_elapsed = time.time() - start_time
            logger.error(f"Contract generation failed after {total_elapsed:.2f}s: {e}", exc_info=True)
            raise


        # Store successful contract in Acontext memory (if enabled)
        if self.acontext and self.acontext.enabled:
            try:
                await self.acontext.store_contract(
                    contract_code=contract_code,
                    contract_type=contract_type,
                    requirements=nlp_desc,
                    audit_issues=None,  # Will be populated after audit stage
                    metadata={"network": network},
                )
            except Exception as e:
                logger.warning(f"Failed to store contract in Acontext: {e}")

        return {
            "status": "success",
            "contract_code": contract_code,
            "contract_type": contract_type,
        }

    async def _generate_direct(self, prompt: str, contract_type: str, network: str) -> str:
        """Generate contract code directly using LLM without template retrieval"""
        logger.info("Generating contract using direct LLM (template retriever disabled)")
        
        # Build comprehensive prompt for direct generation
        generation_prompt = f"""You are a Solidity smart contract expert. Generate a secure, well-documented smart contract based on the following requirements:

Contract Type: {contract_type}
Target Network: {network}
Requirements: {prompt}

CRITICAL Instructions - MUST FOLLOW:
1. Generate ONLY Solidity code, no explanations, no markdown code blocks
2. Start with: pragma solidity ^0.8.27; (compatible with 0.8.27+ compilers)
3. Ensure ALL syntax is valid:
   - NO trailing commas in function parameters: function foo(uint256 a) NOT function foo(uint256 a,)
   - ALL brackets/braces properly closed: {{ }}
   - ALL statements end with semicolons
   - NO invalid characters
   - NO template placeholders like {{supply}}, {{name}}, {{symbol}} - use actual values instead
4. Use actual values, NOT placeholders:
   - For token supply: use a number like 1000000 * 10**18, NOT {{supply}}
   - For token name: use a string like "MyToken", NOT {{name}}
   - For token symbol: use a string like "MTK", NOT {{symbol}}
   - For addresses: use address(0) or msg.sender, NOT {{address}}
5. Include comprehensive NatSpec comments (@title, @notice, @dev, @param, @return)
6. Follow security best practices (checks-effects-interactions, access control, etc.)
7. Include error handling and input validation
8. Use modern Solidity features (custom errors, immutable, etc.)
9. Make the contract gas-efficient
10. Ensure the contract compiles without ParserError

Generate the complete, valid Solidity contract code now (NO markdown, NO explanations, ONLY code):"""
        
        contract_code = await self.llm_provider.generate(generation_prompt)
        
        # Clean the generated code immediately
        from hyperagent.utils.markdown import strip_markdown_code_blocks
        contract_code = strip_markdown_code_blocks(contract_code)
        # Note: Template placeholder cleaning is handled by CompilationService
        
        # Basic validation - ensure it starts with pragma
        if not contract_code.strip().startswith('pragma'):
            # Try to find pragma in the code
            pragma_match = re.search(r'pragma\s+solidity[^;]+;', contract_code, re.IGNORECASE)
            if pragma_match:
                # Extract from pragma onwards
                contract_code = contract_code[pragma_match.start():]
            else:
                # Add pragma if missing - use caret range for compatibility
                contract_code = f"pragma solidity ^0.8.27;\n\n{contract_code}"
        
        # Normalize pragma to ensure compatibility
        # Replace exact versions with caret ranges for better compatibility
        # This ensures contracts work with our standardized compiler version (0.8.27)
        contract_code = re.sub(
            r'pragma\s+solidity\s+(\d+\.\d+\.\d+);',
            r'pragma solidity ^\1;',
            contract_code,
            flags=re.IGNORECASE
        )
        
        return contract_code
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate NLP input"""
        if not data.get("nlp_description"):
            return False
        return len(data["nlp_description"]) > 10

    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        # Log error
        print(f"Generation service error: {error}")
