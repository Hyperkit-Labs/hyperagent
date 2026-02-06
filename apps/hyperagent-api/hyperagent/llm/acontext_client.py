"""Acontext AI Memory API Client for session-based prompt enhancement"""

import logging
from typing import Any, Dict, List, Optional

import httpx

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class AcontextClient:
    """
    Acontext AI Memory API Client

    Concept: Store and retrieve contract generation context for improved prompts
    Logic:
        1. Store successful contracts with their requirements
        2. Retrieve similar contracts by similarity search
        3. Load audit issues from past contracts
        4. Enhance prompts with historical context
    """

    def __init__(self):
        self.base_url = settings.acontext_url
        self.api_key = settings.acontext_api_key
        self.enabled = bool(self.base_url and self.api_key)

        if not self.enabled:
            logger.warning(
                "Acontext client not configured. Set ACONTEXT_URL and ACONTEXT_API_KEY to enable."
            )

    async def store_contract(
        self,
        contract_code: str,
        contract_type: str,
        requirements: str,
        audit_issues: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Store successful contract in Acontext memory

        Args:
            contract_code: Generated contract code
            contract_type: Type of contract (ERC20, ERC721, etc.)
            requirements: Original requirements/prompt
            audit_issues: List of audit issues found (if any)
            metadata: Additional metadata (network, constructor_args, etc.)

        Returns:
            Memory ID if successful, None if disabled or failed
        """
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/memory/store",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "content": contract_code,
                        "type": "contract",
                        "metadata": {
                            "contract_type": contract_type,
                            "requirements": requirements,
                            "audit_issues": audit_issues or [],
                            **(metadata or {}),
                        },
                    },
                )
                response.raise_for_status()
                result = response.json()
                memory_id = result.get("id")
                logger.info(f"Stored contract in Acontext memory: {memory_id}")
                return memory_id
        except Exception as e:
            logger.error(f"Failed to store contract in Acontext: {e}")
            return None

    async def retrieve_similar_contracts(
        self, query: str, contract_type: Optional[str] = None, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve similar contracts from Acontext memory

        Args:
            query: Search query (requirements or description)
            contract_type: Filter by contract type (optional)
            limit: Maximum number of results

        Returns:
            List of similar contracts with their metadata
        """
        if not self.enabled:
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {"query": query, "limit": limit}
                if contract_type:
                    params["type"] = contract_type

                response = await client.get(
                    f"{self.base_url}/memory/search",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    params=params,
                )
                response.raise_for_status()
                result = response.json()
                contracts = result.get("results", [])
                logger.info(f"Retrieved {len(contracts)} similar contracts from Acontext")
                return contracts
        except Exception as e:
            logger.error(f"Failed to retrieve contracts from Acontext: {e}")
            return []

    async def get_audit_issues(self, contract_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get common audit issues for contract type

        Args:
            contract_type: Filter by contract type (optional)

        Returns:
            List of common audit issues with patterns
        """
        if not self.enabled:
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {}
                if contract_type:
                    params["contract_type"] = contract_type

                response = await client.get(
                    f"{self.base_url}/memory/audit-issues",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    params=params,
                )
                response.raise_for_status()
                result = response.json()
                issues = result.get("issues", [])
                logger.info(f"Retrieved {len(issues)} audit issue patterns from Acontext")
                return issues
        except Exception as e:
            logger.error(f"Failed to retrieve audit issues from Acontext: {e}")
            return []

    def enhance_prompt(
        self,
        base_prompt: str,
        similar_contracts: List[Dict[str, Any]],
        audit_issues: List[Dict[str, Any]],
    ) -> str:
        """
        Enhance prompt with historical context from Acontext

        Args:
            base_prompt: Original user prompt
            similar_contracts: Similar contracts from memory
            audit_issues: Common audit issues to avoid

        Returns:
            Enhanced prompt with context
        """
        if not similar_contracts and not audit_issues:
            return base_prompt

        enhanced = base_prompt

        # Add similar contract context
        if similar_contracts:
            enhanced += "\n\n## Similar Successful Contracts:\n"
            for i, contract in enumerate(similar_contracts[:3], 1):  # Top 3
                metadata = contract.get("metadata", {})
                enhanced += f"\n{i}. {metadata.get('contract_type', 'Contract')} - {metadata.get('requirements', 'N/A')[:100]}"

        # Add audit issue warnings
        if audit_issues:
            enhanced += "\n\n## Common Issues to Avoid:\n"
            for issue in audit_issues[:5]:  # Top 5
                enhanced += (
                    f"\n- {issue.get('title', 'Issue')}: {issue.get('description', 'N/A')[:100]}"
                )

        enhanced += "\n\nGenerate optimized Solidity code that avoids known issues and follows successful patterns."

        return enhanced
