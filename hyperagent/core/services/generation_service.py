"""Generation service implementation"""

import logging
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
        template_retriever: TemplateRetriever,
        multi_model_router: Optional[MultiModelRouter] = None,
    ):
        self.llm_provider = llm_provider
        self.template_retriever = template_retriever
        self.multi_model_router = multi_model_router
        # Initialize Acontext client if enabled
        self.acontext = AcontextClient() if settings.enable_acontext else None

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate smart contract from NLP description with Acontext enhancement"""
        nlp_desc = input_data.get("nlp_description")
        contract_type = input_data.get("contract_type", "Custom")
        network = input_data.get("network", "")
        rag_context = input_data.get("rag_context", "")

        # Enhance prompt with Acontext memory (if enabled)
        enhanced_prompt = nlp_desc
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

        # Use Multi-Model Router if available, otherwise fallback to template retriever
        if self.multi_model_router and rag_context:
            try:
                logger.info("Using Multi-Model Router for code generation")
                contract_code, credits_used = await self.multi_model_router.route_task(
                    task="solidity_codegen",
                    context=rag_context,
                    budget=100,
                    is_private=input_data.get("is_private", False),
                )
                logger.info(f"Generated code using Multi-Model Router (credits: {credits_used})")
            except Exception as e:
                logger.warning(f"Multi-Model Router failed: {e}, falling back to template retriever")
                contract_code = await self.template_retriever.retrieve_and_generate(
                    enhanced_prompt, contract_type
                )
        else:
            # Generate contract using RAG with enhanced prompt
            contract_code = await self.template_retriever.retrieve_and_generate(
                enhanced_prompt, contract_type
            )

        # Optimize for MetisVM if requested (with feature check and fallback)
        metisvm_optimized = False
        optimization_report = None
        optimize_requested = input_data.get("optimize_for_metisvm")

        if optimize_requested:
            from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

            if NetworkFeatureManager.supports_feature(network, NetworkFeature.METISVM):
                # Apply optimization
                from hyperagent.blockchain.metisvm_optimizer import MetisVMOptimizer

                optimizer = MetisVMOptimizer()
                contract_code = optimizer.optimize_for_metisvm(
                    contract_code,
                    enable_fp=input_data.get("enable_floating_point", False),
                    enable_ai=input_data.get("enable_ai_inference", False),
                )
                metisvm_optimized = True
                optimization_report = optimizer.get_optimization_report(
                    contract_code,
                    enable_fp=input_data.get("enable_floating_point", False),
                    enable_ai=input_data.get("enable_ai_inference", False),
                )
            else:
                # Log warning but continue without optimization
                logger.warning(
                    f"MetisVM optimization requested but not available for {network}. "
                    f"Continuing without optimization."
                )
                # Continue with standard contract code

        # Store successful contract in Acontext memory (if enabled)
        if self.acontext and self.acontext.enabled:
            try:
                await self.acontext.store_contract(
                    contract_code=contract_code,
                    contract_type=contract_type,
                    requirements=nlp_desc,
                    audit_issues=None,  # Will be populated after audit stage
                    metadata={"network": network, "metisvm_optimized": metisvm_optimized},
                )
            except Exception as e:
                logger.warning(f"Failed to store contract in Acontext: {e}")

        return {
            "status": "success",
            "contract_code": contract_code,
            "contract_type": contract_type,
            "metisvm_optimized": metisvm_optimized,
            "optimization_report": optimization_report,
        }

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate NLP input"""
        if not data.get("nlp_description"):
            return False
        return len(data["nlp_description"]) > 10

    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        # Log error
        print(f"Generation service error: {error}")
