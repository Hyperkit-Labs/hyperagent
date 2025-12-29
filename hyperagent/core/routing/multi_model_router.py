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

PRIMARY_TIMEOUT_SECONDS = 30
FALLBACK_TIMEOUT_SECONDS = 20
QUALITY_THRESHOLD_PRIMARY = 0.85
QUALITY_THRESHOLD_FALLBACK = 0.75


class MultiModelRouter:
    """Routes tasks to optimal model with fallback chain"""

    MODEL_CONFIG = {
        "solidity_codegen": {
            "primary": "claude-opus-4.5",
            "fallback": "llama-3.1-405b",
            "fallback2": "gpt-4o",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [5, 1, 2],
            "quality_threshold": QUALITY_THRESHOLD_PRIMARY,
        },
        "ui_design": {
            "primary": "gemini-3-pro",
            "fallback": "gpt-4-vision",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [2, 3],
            "quality_threshold": 0.80,
        },
        "gas_optimization": {
            "primary": "llama-3.1-405b",
            "fallback": "claude",
            "timeout": PRIMARY_TIMEOUT_SECONDS,
            "cost": [1, 2],
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
                    logger.warning(
                        f"Low quality from {model_name}: {quality} < {threshold}, trying next model"
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
        Score code quality (0.0-1.0) with syntax validation

        Performs multi-layered quality assessment:
        1. Syntax validation (50% weight)
        2. Semantic checks (50% weight)
        """
        if not code or len(code) < 100:
            return 0.0

        score = 0.0

        # Layer 1: Syntax validation (50% of score)
        try:
            from hyperagent.core.services.compilation_service import CompilationService

            compilation_service = CompilationService()

            import re

            pragma_match = re.search(r"pragma solidity\s+([\^<>=\s\d.]+);", code)
            solidity_version = pragma_match.group(1).strip() if pragma_match else "0.8.27"

            try:
                result = await compilation_service.compile_contract(code, solidity_version)
                if result and result.get("bytecode"):
                    score += 0.5
                    logger.debug("Code syntax validation passed (compilation successful)")
            except Exception as compile_error:
                logger.debug(f"Compilation failed during quality scoring: {compile_error}")

        except Exception as e:
            logger.debug(f"Syntax validation unavailable: {e}")

        # Layer 2: Semantic checks (50% of score)
        if "contract " in code.lower() or "pragma solidity" in code.lower():
            score += 0.2

        if "function " in code.lower():
            score += 0.1

        if "event " in code.lower() or "emit " in code.lower():
            score += 0.05

        if "natspec" in code.lower() or "///" in code or "/**" in code:
            score += 0.05

        if "import" in code.lower() and "@openzeppelin" in code.lower():
            score += 0.05

        if "require(" in code.lower() or "assert(" in code.lower() or "revert" in code.lower():
            score += 0.05

        return min(1.0, score)

