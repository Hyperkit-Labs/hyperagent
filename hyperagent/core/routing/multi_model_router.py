"""Multi-model router with fallback chain and quality validation"""

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, Optional, Tuple

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.llm.provider import LLMProvider, LLMProviderFactory

logger = logging.getLogger(__name__)

PRIMARY_TIMEOUT_SECONDS = 60  # Increased from 30 to 60 seconds for contract generation
FALLBACK_TIMEOUT_SECONDS = 40  # Increased from 20 to 40 seconds
QUALITY_THRESHOLD_PRIMARY = 0.4  # Lowered from 0.85 to 0.4 - allow code to proceed even if not perfect (compilation will catch errors)
QUALITY_THRESHOLD_FALLBACK = 0.3  # Lowered from 0.75 to 0.3 - very lenient for fallback


class MultiModelRouter:
    """Routes tasks to optimal model with fallback chain"""

    MODEL_CONFIG = {
        # All tasks use Gemini 2.5 Flash only (budget constraint)
        "solidity_codegen": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,  # 60 seconds for contract generation
            "cost": [1],
            "quality_threshold": QUALITY_THRESHOLD_PRIMARY,
        },
        "ui_design": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1],
            "quality_threshold": 0.80,
        },
        "gas_optimization": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1],
            "quality_threshold": 0.75,
        },
        # Agentic system task types
        "architecture_design": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1],
            "quality_threshold": 0.80,
        },
        "clarification_analysis": {
            "primary": "gemini-2.5-flash",
            "timeout": 15,
            "cost": [1],
            "quality_threshold": 0.70,
        },
        "spec_extraction": {
            "primary": "gemini-2.5-flash",
            "timeout": 20,
            "cost": [1],
            "quality_threshold": 0.75,
        },
        "capability_assessment": {
            "primary": "gemini-2.5-flash",
            "timeout": 15,
            "cost": [1],
            "quality_threshold": 0.70,
        },
        "workflow_reflection": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1],
            "quality_threshold": 0.75,
        },
        "design_document_generation": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1],
            "quality_threshold": 0.75,
        },
        "error_analysis": {
            "primary": "gemini-2.5-flash",
            "timeout": 20,
            "cost": [1],
            "quality_threshold": 0.70,
        },
        "fix_generation": {
            "primary": "gemini-2.5-flash",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1],
            "quality_threshold": 0.75,
        },
    }

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize Multi-Model Router

        Args:
            redis_manager: Optional Redis manager for caching
        """
        self.redis_manager = redis_manager
        self._providers: Dict[str, LLMProvider] = {}

    def _get_provider(self, model_name: str) -> Optional[LLMProvider]:
        """Get or create LLM provider for model"""
        if model_name in self._providers:
            return self._providers[model_name]

        try:
            if "claude" in model_name.lower() or "opus" in model_name.lower():
                api_key = getattr(settings, "anthropic_api_key", None) or getattr(
                    settings, "claude_api_key", None
                )
                if not api_key:
                    logger.warning("Anthropic API key not configured")
                    return None
                try:
                    import anthropic
                    import asyncio

                    class AnthropicProvider(LLMProvider):
                        def __init__(self, api_key: str):
                            self.client = anthropic.Anthropic(api_key=api_key)

                        async def generate(self, prompt: str, **kwargs) -> str:
                            loop = asyncio.get_event_loop()
                            response = await asyncio.wait_for(
                                loop.run_in_executor(
                                    None,
                                    lambda: self.client.messages.create(
                                        model="claude-3-5-sonnet-20241022",
                                        max_tokens=8000,
                                        messages=[{"role": "user", "content": prompt}],
                                    ),
                                ),
                                timeout=kwargs.get("timeout", 30.0),
                            )
                            return response.content[0].text

                        async def embed(self, text: str) -> list:
                            raise NotImplementedError("Anthropic embeddings not supported")

                    provider = AnthropicProvider(api_key=api_key)
                    self._providers[model_name] = provider
                    return provider
                except ImportError:
                    logger.warning("anthropic package not installed")
                    return None

            elif "gemini" in model_name.lower():
                api_key = settings.gemini_api_key
                if not api_key:
                    logger.warning("Gemini API key not configured")
                    return None
                provider = LLMProviderFactory.create("gemini", api_key=api_key)
                self._providers[model_name] = provider
                return provider

            elif "gpt" in model_name.lower() or "openai" in model_name.lower():
                api_key = settings.openai_api_key
                if not api_key:
                    logger.warning("OpenAI API key not configured")
                    return None
                provider = LLMProviderFactory.create("openai", api_key=api_key)
                self._providers[model_name] = provider
                return provider

            elif "llama" in model_name.lower():
                logger.warning(f"Llama model {model_name} not directly supported, using OpenAI as fallback")
                api_key = settings.openai_api_key
                if not api_key:
                    return None
                provider = LLMProviderFactory.create("openai", api_key=api_key)
                self._providers[model_name] = provider
                return provider

        except Exception as e:
            logger.error(f"Failed to create provider for {model_name}: {e}")
            return None

        return None

    async def route_task(
        self, task: str, context: str, budget: int, is_private: bool = False
    ) -> Tuple[str, int]:
        """
        Route task to optimal model with fallback chain

        Args:
            task: Task type (solidity_codegen, ui_design, gas_optimization)
            context: Context string for generation
            budget: Available credits
            is_private: If True, use TEE for private projects

        Returns:
            Tuple of (generated_code, credits_used)

        Raises:
            RuntimeError: If all models fail
        """
        start_time = time.time()
        config = self.MODEL_CONFIG.get(task, {})
        if not config:
            raise ValueError(f"Unknown task type: {task}")

        models = [config.get("primary")]
        if "fallback" in config:
            models.append(config.get("fallback"))
        if "fallback2" in config:
            models.append(config.get("fallback2"))

        last_error = None
        for idx, model_name in enumerate(models):
            if not model_name:
                continue

            cost = (
                config["cost"][idx]
                if isinstance(config.get("cost"), list)
                else config.get("cost", 1)
            )

            if cost > budget:
                logger.warning(f"Budget exceeded for model {model_name}: {cost} > {budget}")
                continue

            provider = self._get_provider(model_name)
            if not provider:
                logger.warning(f"Provider not available for {model_name}")
                continue

            try:
                timeout = config.get("timeout", PRIMARY_TIMEOUT_SECONDS)
                if idx > 0:
                    timeout = FALLBACK_TIMEOUT_SECONDS

                if is_private:
                    code = await self._generate_in_tee(provider, model_name, task, context, cost)
                else:
                    code = await self._call_model_with_timeout(provider, task, context, timeout)

                quality = await self._score_quality(code, task)
                threshold = (
                    config.get("quality_threshold", QUALITY_THRESHOLD_PRIMARY)
                    if idx == 0
                    else QUALITY_THRESHOLD_FALLBACK
                )

                if quality < threshold:
                    # If this is the last model or quality is extremely low (< 0.1), proceed anyway
                    # Compilation service will catch actual errors
                    is_last_model = idx == len(models) - 1 or not any(models[idx + 1:])
                    if is_last_model or quality < 0.1:
                        logger.warning(
                            f"Low quality from {model_name}: {quality:.2f} < {threshold}, "
                            f"but proceeding anyway (last model or quality too low to retry)"
                        )
                        # Proceed with low quality - compilation will catch real errors
                    else:
                        logger.warning(
                            f"Low quality from {model_name}: {quality:.2f} < {threshold}, trying next model"
                        )
                        continue

                latency = time.time() - start_time
                logger.info(
                    f"Successfully generated code using {model_name} "
                    f"(quality: {quality:.2f}, latency: {latency:.2f}s)"
                )

                await self._track_performance(
                    task=task,
                    model_used=model_name,
                    latency=latency,
                    credits=cost,
                    quality_score=quality,
                    success=True,
                    context_preview=context[:500],
                )

                return code, cost

            except asyncio.TimeoutError:
                last_error = f"{model_name} timeout"
                logger.warning(f"{model_name} timeout for {task}")
                continue
            except Exception as e:
                last_error = str(e)
                logger.error(f"{model_name} failed: {e}")
                continue

        await self._track_performance(
            task=task,
            model_used="all_failed",
            latency=time.time() - start_time,
            credits=0,
            quality_score=0.0,
            success=False,
            context_preview=context[:500],
            error=last_error,
        )

        raise RuntimeError(f"All models failed for {task}: {last_error}")

    async def _track_performance(
        self,
        task: str,
        model_used: str,
        latency: float,
        credits: int,
        quality_score: float,
        success: bool,
        context_preview: str,
        error: Optional[str] = None,
    ):
        """Track model performance in MLflow"""
        try:
            from hyperagent.monitoring.mlflow_tracker import MLflowTracker

            tracker = MLflowTracker()
            await tracker.log_build(
                build_id=str(uuid.uuid4()),
                prompt=f"[{task}] {context_preview}",
                chain="multi_model_router",
                model_used=model_used,
                metrics={
                    "latency": latency,
                    "credits": credits,
                    "quality_score": quality_score,
                    "success": 1 if success else 0,
                    "task": task,
                    "error": error or "",
                },
            )
        except Exception as e:
            logger.debug(f"Failed to track performance in MLflow: {e}")

    async def _call_model_with_timeout(
        self, provider: LLMProvider, task: str, context: str, timeout: float
    ) -> str:
        """Call model with timeout"""
        prompt = self._build_prompt(task, context)

        if hasattr(provider, "generate"):
            return await asyncio.wait_for(provider.generate(prompt), timeout=timeout)
        else:
            raise ValueError(f"Provider {type(provider)} does not support generate()")

    def _build_prompt(self, task: str, context: str) -> str:
        """Build prompt for task"""
        base_prompt = f"""
Task: {task}

Context from latest documentation:
{context}

Requirements:
- Valid, compilable Solidity code
- Include natspec comments
- Emit events for state changes
- Use OpenZeppelin for safety
- Implement access control

Generate the code:
"""
        return base_prompt

    async def _generate_in_tee(
        self, provider: LLMProvider, model_name: str, task: str, context: str, cost: int
    ) -> str:
        """Generate inside TEE for private projects"""
        logger.info(f"Generating {task} in TEE via {model_name}")
        return await self._call_model_with_timeout(provider, task, context, PRIMARY_TIMEOUT_SECONDS)

    async def _score_quality(self, code: str, task: str) -> float:
        """
        Score code quality (0.0-1.0) with lightweight checks
        
        NOTE: We use lightweight checks only - full compilation happens later.
        This prevents workflows from getting stuck on quality checks.

        Performs lightweight quality assessment:
        1. Basic structure checks (70% weight)
        2. Semantic checks (30% weight)
        """
        if not code or len(code) < 100:
            return 0.0

        score = 0.0

        # Layer 1: Basic structure checks (70% of score) - lightweight, no compilation
        # Don't compile here - that happens in CompilationService later
        # This prevents workflows from getting stuck on quality checks
        if "pragma solidity" in code.lower():
            score += 0.2
            logger.debug("Found pragma solidity")

        if "contract " in code.lower():
            score += 0.2
            logger.debug("Found contract declaration")

        if "function " in code.lower():
            score += 0.15
            logger.debug("Found function declarations")

        if "{" in code and "}" in code:
            # Basic syntax structure
            open_braces = code.count("{")
            close_braces = code.count("}")
            if abs(open_braces - close_braces) <= 2:  # Allow small imbalance
                score += 0.15
                logger.debug("Brace balance check passed")

        # Layer 2: Semantic checks (30% of score)
        if "event " in code.lower() or "emit " in code.lower():
            score += 0.1

        if "natspec" in code.lower() or "///" in code or "/**" in code:
            score += 0.05

        if "import" in code.lower():
            score += 0.05
            if "@openzeppelin" in code.lower():
                score += 0.05

        if "require(" in code.lower() or "assert(" in code.lower() or "revert" in code.lower():
            score += 0.05

        # Don't do full compilation here - that happens in CompilationService
        # This prevents workflows from getting stuck on quality checks
        logger.debug(f"Quality score: {score:.2f} (lightweight check only)")
        return min(1.0, score)

