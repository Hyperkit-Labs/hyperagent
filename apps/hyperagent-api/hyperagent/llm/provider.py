"""LLM provider interface and implementations"""

import asyncio
from abc import ABC, abstractmethod
from typing import List, Optional

from hyperagent.core.config import settings


class LLMError(Exception):
    """LLM provider error"""

    pass


class LLMProvider(ABC):
    """Abstract LLM provider interface"""

    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from prompt"""
        ...

    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """Generate embedding vector"""
        ...


class GeminiProvider(LLMProvider):
    """
    Google Gemini Provider

    Concept: Primary LLM for contract generation
    Logic: Async API calls with error handling and retries
    Features: 32K context window, multimodal support
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-2.5-flash",
        thinking_budget: Optional[int] = None,
    ):
        """
        Initialize Gemini provider

        Args:
            api_key: Google Gemini API key
            model_name: Model to use. Options:
                - gemini-2.5-flash (default, fastest, recommended)
                - gemini-2.5-flash-lite (lighter, faster)
                - gemini-2.0-flash (previous generation)
                - gemini-2.0-flash-lite (previous generation, lighter)
            thinking_budget: Optional thinking budget for enhanced reasoning (1-1000)
                            Only applicable to gemini-2.5-flash models
        """
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        self.model_name = model_name
        self.thinking_budget = thinking_budget

    async def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate contract code from prompt

        Logic Flow:
        1. Build prompt with context
        2. Call Gemini API with optional thinking configuration
        3. Extract Solidity code from response
        4. Return code

        Args:
            prompt: Input prompt for contract generation
            **kwargs: Additional parameters:
                - temperature: Override default temperature (0.3)
                - max_output_tokens: Override default max tokens (8000)
                - thinking_budget: Override instance thinking_budget
        """
        try:
            import asyncio

            # Build generation config
            generation_config = {
                "temperature": kwargs.get("temperature", 0.3),
                "max_output_tokens": kwargs.get("max_output_tokens", 8000),
            }

            # Add thinking configuration for Gemini 2.5 Flash models
            thinking_budget = kwargs.get("thinking_budget", self.thinking_budget)
            if thinking_budget and "2.5" in self.model_name:
                # Thinking feature available in Gemini 2.5 Flash
                generation_config["thinking_budget"] = min(max(thinking_budget, 1), 1000)

            # Run synchronous generate_content in executor to avoid blocking
            # Wrap with timeout to prevent indefinite hanging
            loop = asyncio.get_event_loop()
            try:
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: self.model.generate_content(
                            prompt, generation_config=generation_config
                        ),
                    ),
                    timeout=settings.llm_timeout_seconds,
                )
                return response.text
            except asyncio.TimeoutError:
                raise LLMError(
                    f"Gemini generation timed out after {settings.llm_timeout_seconds} seconds"
                )
        except LLMError:
            raise
        except Exception as e:
            raise LLMError(f"Gemini generation failed: {e}")

    async def embed(self, text: str) -> List[float]:
        """
        Generate embedding vector

        Note: Gemini embedding-001 returns 768 dimensions
        For 1536 dimensions, we need to use text-embedding-004 or pad the vector
        """
        import google.generativeai as genai

        # Run synchronous embed_content in executor to avoid blocking
        # Wrap with timeout to prevent indefinite hanging
        loop = asyncio.get_event_loop()
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: genai.embed_content(
                        model="models/embedding-001",  # Gemini embedding-001 (stable, 768 dims)
                        content=text,
                    ),
                ),
                timeout=settings.llm_embed_timeout_seconds,
            )
            embedding = result["embedding"]
        except asyncio.TimeoutError:
            raise LLMError(
                f"Gemini embedding timed out after {settings.llm_embed_timeout_seconds} seconds"
            )

        # Pad to 1536 dimensions if needed (for compatibility with schema)
        if len(embedding) == 768:
            # Duplicate and concatenate to reach 1536 dimensions
            embedding = embedding + embedding

        return embedding


class OpenAIProvider(LLMProvider):
    """OpenAI provider (fallback)"""

    def __init__(self, api_key: str):
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate using OpenAI

        Note: Includes timeout handling to prevent indefinite hanging
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",  # Updated to GPT-4o (latest model)
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8000,
                timeout=settings.llm_timeout_seconds,
            )
            return response.choices[0].message.content
        except Exception as e:
            raise LLMError(f"OpenAI generation failed: {e}")

    async def embed(self, text: str) -> List[float]:
        """Generate embedding using OpenAI"""
        try:
            response = await self.client.embeddings.create(
                model="text-embedding-ada-002",
                input=text,
                timeout=settings.llm_embed_timeout_seconds,
            )
            return response.data[0].embedding
        except Exception as e:
            raise LLMError(f"OpenAI embedding failed: {e}")


class LLMProviderFactory:
    """Factory pattern for LLM provider creation"""

    @staticmethod
    def create(provider_name: str, **kwargs) -> LLMProvider:
        """
        Create LLM provider instance

        Args:
            provider_name: "gemini" or "openai"
            **kwargs: Provider-specific arguments:
                - api_key: Required for both providers
                - model_name: Optional, for Gemini (default: "gemini-2.5-flash")
                - thinking_budget: Optional, for Gemini 2.5 Flash models (1-1000)

        Returns:
            LLMProvider instance
        """
        if provider_name == "gemini":
            api_key = kwargs.get("api_key")
            if not api_key:
                raise ValueError("api_key is required for Gemini provider")
            return GeminiProvider(
                api_key=api_key,
                model_name=kwargs.get("model_name", "gemini-2.5-flash"),
                thinking_budget=kwargs.get("thinking_budget"),
            )
        elif provider_name == "openai":
            api_key = kwargs.get("api_key")
            if not api_key:
                raise ValueError("api_key is required for OpenAI provider")
            return OpenAIProvider(api_key=api_key)
        else:
            raise ValueError(f"Unknown provider: {provider_name}. Supported: 'gemini', 'openai'")
