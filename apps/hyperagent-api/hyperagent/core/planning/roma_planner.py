"""ROMA Planner for decomposing user prompts into structured execution plans"""

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)

PLAN_CACHE_TTL_SECONDS = 86400
PLAN_SCHEMA_VERSION = "v2"


class PlanPhase(BaseModel):
    """Structured phase in ROMA execution plan"""

    description: str = Field(..., description="Phase description")
    inputs: List[str] = Field(default_factory=list, description="Required inputs")
    outputs: List[str] = Field(default_factory=list, description="Expected outputs")
    duration_sec: int = Field(..., ge=1, description="Estimated duration in seconds")
    criteria: List[str] = Field(default_factory=list, description="Success criteria")

    @field_validator("duration_sec")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        """Ensure duration is reasonable (1-300 seconds)"""
        if v < 1 or v > 300:
            logger.warning(f"Duration {v}s outside expected range, clamping to 1-300s")
            return max(1, min(300, v))
        return v


class PlanDependency(BaseModel):
    """Dependency between phases"""

    from_phase: str = Field(..., alias="from")
    to_phase: str = Field(..., alias="to")


class ROMAExecutionPlan(BaseModel):
    """Validated ROMA execution plan with 5 phases"""

    design_phase: PlanPhase
    code_phase: PlanPhase
    audit_phase: PlanPhase
    test_phase: PlanPhase
    deploy_phase: PlanPhase
    total_duration_sec: int = Field(..., ge=10, description="Total estimated duration")
    dependencies: List[Union[PlanDependency, Dict[str, str]]] = Field(
        default_factory=list, description="Phase dependencies"
    )

    @field_validator("total_duration_sec")
    @classmethod
    def validate_total_duration(cls, v: int) -> int:
        """Ensure total duration is reasonable (10-600 seconds)"""
        if v < 10 or v > 600:
            logger.warning(f"Total duration {v}s outside expected range, clamping to 10-600s")
            return max(10, min(600, v))
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/transmission"""
        return self.model_dump(by_alias=True)


class ROMAPlanner:
    """Decomposes user prompts into 5-phase execution plans"""

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize ROMA Planner

        Args:
            redis_manager: Optional Redis manager for caching plans
        """
        self.redis_manager = redis_manager
        self._anthropic_client = None

    def _get_anthropic_client(self):
        """Lazy initialization of Anthropic client"""
        if self._anthropic_client is None:
            try:
                import anthropic

                api_key = getattr(settings, "anthropic_api_key", None) or getattr(
                    settings, "claude_api_key", None
                )
                if not api_key:
                    raise ValueError(
                        "Anthropic API key not configured. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY."
                    )
                self._anthropic_client = anthropic.Anthropic(api_key=api_key)
            except ImportError:
                raise ImportError(
                    "anthropic package not installed. Install with: pip install anthropic"
                )
        return self._anthropic_client

    def _generate_cache_key(self, prompt: str, chain: str) -> str:
        """Generate cache key for plan with schema versioning"""
        content = f"{PLAN_SCHEMA_VERSION}:{prompt}:{chain}"
        hash_obj = hashlib.sha256(content.encode())
        return f"roma_plan:{hash_obj.hexdigest()}"

    async def plan(self, prompt: str, chain: str) -> Union[ROMAExecutionPlan, Dict[str, Any]]:
        """
        Decompose user prompt into structured 5-phase execution plan

        Args:
            prompt: User's natural language request
            chain: Target blockchain network

        Returns:
            Validated ROMAExecutionPlan or dictionary with 5 phases
        """
        cache_key = self._generate_cache_key(prompt, chain)

        if self.redis_manager:
            cached_plan = await self.redis_manager.get(cache_key)
            if cached_plan:
                logger.info("ROMA plan cache hit")
                try:
                    return ROMAExecutionPlan(**cached_plan)
                except Exception as e:
                    logger.warning(f"Cached plan validation failed: {e}, regenerating")
                    pass

        decomposition_prompt = f"""
Decompose this dApp request into a structured execution plan:

User Request: {prompt}
Target Chain: {chain}

Return a JSON object with exactly 5 phases:

{{
    "design_phase": {{
        "description": "Architecture and design specification",
        "inputs": ["user_prompt", "chain"],
        "outputs": ["design_spec", "data_structures", "architecture"],
        "duration_sec": 5,
        "criteria": ["Clear architecture defined", "Data structures specified"]
    }},
    "code_phase": {{
        "description": "Solidity code generation",
        "inputs": ["design_spec", "rag_context"],
        "outputs": ["contract_code", "abi"],
        "duration_sec": 20,
        "criteria": ["Valid Solidity syntax", "Compiles without errors", "Includes natspec"]
    }},
    "audit_phase": {{
        "description": "Security analysis and vulnerability detection",
        "inputs": ["contract_code"],
        "outputs": ["audit_report", "vulnerabilities", "risk_score"],
        "duration_sec": 15,
        "criteria": ["No HIGH severity findings", "Risk score < 30"]
    }},
    "test_phase": {{
        "description": "Compilation and testnet simulation",
        "inputs": ["contract_code", "compiled_contract"],
        "outputs": ["test_results", "gas_estimate"],
        "duration_sec": 10,
        "criteria": ["Compiles successfully", "Testnet simulation passes"]
    }},
    "deploy_phase": {{
        "description": "On-chain deployment and verification",
        "inputs": ["compiled_contract", "test_results"],
        "outputs": ["contract_address", "transaction_hash", "verification"],
        "duration_sec": 10,
        "criteria": ["Deployed to {chain}", "Verified on block explorer"]
    }},
    "total_duration_sec": 60,
    "dependencies": [
        {{"from": "design_phase", "to": "code_phase"}},
        {{"from": "code_phase", "to": "audit_phase"}},
        {{"from": "code_phase", "to": "test_phase"}},
        {{"from": "audit_phase", "to": "deploy_phase"}},
        {{"from": "test_phase", "to": "deploy_phase"}}
    ]
}}

Return ONLY valid JSON, no markdown formatting.
"""

        try:
            client = self._get_anthropic_client()
            import asyncio

            loop = asyncio.get_event_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.messages.create(
                        model="claude-3-5-sonnet-20241022",
                        max_tokens=2000,
                        temperature=0.7,
                        messages=[{"role": "user", "content": decomposition_prompt}],
                    ),
                ),
                timeout=30.0,
            )

            response_text = response.content[0].text.strip()

            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            plan_dict = json.loads(response_text)

            try:
                validated_plan = ROMAExecutionPlan(**plan_dict)
                logger.info(
                    f"ROMA plan validated: {validated_plan.total_duration_sec}s total duration"
                )

                if self.redis_manager:
                    await self.redis_manager.set(
                        cache_key, validated_plan.to_dict(), ttl=PLAN_CACHE_TTL_SECONDS
                    )
                    logger.info(f"ROMA plan cached with key: {cache_key}")

                return validated_plan

            except Exception as validation_error:
                logger.warning(
                    f"Plan validation failed: {validation_error}, returning unvalidated plan"
                )
                if self.redis_manager:
                    await self.redis_manager.set(cache_key, plan_dict, ttl=PLAN_CACHE_TTL_SECONDS)
                return plan_dict

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse ROMA plan JSON: {e}")
            logger.error(f"Response text: {response_text[:500]}")
            raise ValueError(f"Invalid JSON response from ROMA planner: {e}")
        except asyncio.TimeoutError:
            logger.error("ROMA planner timeout after 30 seconds")
            raise TimeoutError("ROMA planning timed out")
        except Exception as e:
            logger.error(f"ROMA planning failed: {e}", exc_info=True)
            raise RuntimeError(f"ROMA planning failed: {e}")

