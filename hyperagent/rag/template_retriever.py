"""RAG template retriever with vector similarity"""

import logging
from typing import Dict, List, Optional

import numpy as np

from hyperagent.llm.provider import LLMProvider
from hyperagent.models.template import ContractTemplate

logger = logging.getLogger(__name__)


class TemplateRetriever:
    """
    Retrieval-Augmented Generation (RAG)

    Concept: Retrieve relevant templates before generation
    Logic:
        1. Generate embedding for user query
        2. Find similar templates using cosine similarity
        3. Inject templates into LLM prompt
        4. Generate contract with template context
    Benefits: Better code quality, follows patterns, reduces errors
    """

    def __init__(self, llm_provider: LLMProvider, db_session):
        """
        Initialize TemplateRetriever

        Args:
            llm_provider: LLM provider for embeddings
            db_session: Async database session (must be AsyncSession)

        Raises:
            TypeError: If db_session is not an async session
        """
        import asyncio
        import inspect

        self.llm_provider = llm_provider

        # Validate session is async
        if not hasattr(db_session, "execute"):
            raise TypeError(
                f"db_session must be an async session (AsyncSession). "
                f"Got: {type(db_session).__name__}"
            )

        # Check if execute is a coroutine function
        execute_method = getattr(db_session, "execute", None)
        if execute_method and not inspect.iscoroutinefunction(execute_method):
            raise TypeError(
                "db_session.execute must be an async method. "
                "Please use AsyncSession from sqlalchemy.ext.asyncio"
            )

        self.db_session = db_session

    async def retrieve_templates(
        self,
        user_query: str,
        contract_type: str = "Custom",
        limit: int = 5,
        similarity_threshold: float = 0.7,
    ) -> List[Dict]:
        """
        Retrieve similar templates for a query using vector similarity search

        Args:
            user_query: User's natural language query
            contract_type: Type of contract (ERC20, ERC721, etc.)
            limit: Maximum number of templates to return
            similarity_threshold: Minimum similarity score (0.0-1.0, default 0.7)

        Returns:
            List of template dictionaries with similarity scores
        """
        try:
            # Validate LLM provider is configured
            if not self.llm_provider:
                logger.error("LLM provider not configured. Cannot generate embeddings.")
                raise ValueError("LLM provider required for template retrieval")

            # Step 1: Generate query embedding
            query_embedding = await self.llm_provider.embed(user_query)

            if not query_embedding or len(query_embedding) != 1536:
                logger.warning("Invalid embedding generated, returning empty results")
                return []

            # Step 2: Query database for similar templates (async)
            templates = await ContractTemplate.find_similar_async(
                self.db_session,
                query_embedding,
                limit=limit * 2,  # Get more to filter by contract_type
            )

            if not templates:
                logger.debug("No templates found in database")
                return []

            # Step 3: Filter by contract_type if specified
            if contract_type != "Custom":
                templates = [t for t in templates if t.contract_type == contract_type]

            # Step 4: Calculate similarity scores and filter by threshold
            results = []
            for template in templates[:limit]:
                if template.embedding is None:
                    continue

                # Calculate cosine similarity
                similarity = self._calculate_similarity(query_embedding, template.embedding)

                # Filter by threshold
                if similarity >= similarity_threshold:
                    results.append(
                        {
                            "id": str(template.id),
                            "name": template.name,
                            "description": template.description,
                            "contract_type": template.contract_type,
                            "template_code": template.template_code,
                            "similarity_score": similarity,
                            "tags": template.tags or [],
                            "version": template.version,
                        }
                    )

            logger.info(
                f"Retrieved {len(results)} templates with similarity >= {similarity_threshold}"
            )
            return results

        except Exception as e:
            logger.error(f"Error retrieving templates: {e}", exc_info=True)
            return []

    def _calculate_similarity(self, embedding1: List[float], embedding2) -> float:
        """
        Calculate cosine similarity between two embeddings

        Args:
            embedding1: Query embedding (list of floats)
            embedding2: Template embedding (pgvector Vector or list)

        Returns:
            Similarity score between 0.0 and 1.0
        """
        try:
            # Convert pgvector Vector to list if needed
            if hasattr(embedding2, "__iter__") and not isinstance(embedding2, str):
                emb2_list = list(embedding2)
            else:
                emb2_list = embedding2

            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(emb2_list)

            # Calculate cosine similarity: dot(a, b) / (||a|| * ||b||)
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)

            if norm1 == 0 or norm2 == 0:
                return 0.0

            similarity = dot_product / (norm1 * norm2)

            # Cosine similarity ranges from -1 to 1, but for embeddings it's typically 0 to 1
            # Normalize to 0-1 range
            return max(0.0, min(1.0, (similarity + 1) / 2))

        except Exception as e:
            logger.error(f"Error calculating similarity: {e}", exc_info=True)
            return 0.0

    async def retrieve_and_generate(self, user_query: str, contract_type: str = "Custom") -> str:
        """
        RAG Pipeline

        Example Flow:
            Input: "Create ERC20 token with burn function"

            Step 1: Generate query embedding
            Step 2: Find top 3 similar templates
            Step 3: Build prompt with templates
            Step 4: Generate contract
        """
        # Step 1: Generate query embedding
        query_embedding = await self.llm_provider.embed(user_query)

        # Step 2: Find similar templates using vector search
        similar_templates = await self.retrieve_templates(user_query, contract_type, limit=3)

        # Step 3: Build context-aware prompt
        prompt = self._build_rag_prompt(user_query, contract_type, similar_templates)

        # Step 4: Generate with context
        contract_code = await self.llm_provider.generate(prompt)

        # Step 5: Extract Solidity code from markdown code blocks if present
        from hyperagent.utils.markdown import extract_solidity_code

        contract_code = extract_solidity_code(contract_code)

        return contract_code

    async def retrieve_template_code(self, template: "ContractTemplate") -> str:
        """
        Retrieve template code with IPFS fallback

        Priority:
        1. Database (fast, always available)
        2. IPFS (if database fails or code missing)

        Args:
            template: ContractTemplate instance

        Returns:
            Template code as string

        Raises:
            ValueError: If template code is not available
        """
        from hyperagent.core.config import settings

        # Primary: Database (fast)
        if template.template_code:
            return template.template_code

        # Fallback: IPFS
        if template.ipfs_hash and settings.pinata_jwt:
            try:
                from hyperagent.rag.pinata_manager import PinataManager

                pinata = PinataManager(settings.pinata_jwt)
                code = await pinata.retrieve_template(template.ipfs_hash)

                logger.info(f"Retrieved template code from IPFS: {template.ipfs_hash}")

                # Optionally update database with retrieved code (async in background)
                # This could be done via a background task

                return code
            except Exception as e:
                logger.error(f"Failed to retrieve from IPFS: {e}")
                raise ValueError(f"Template code not available. IPFS retrieval failed: {e}")

        raise ValueError("Template code not available in database or IPFS")

    def _build_rag_prompt(self, query: str, contract_type: str, templates: List) -> str:
        """Build prompt with retrieved templates as context"""
        template_context = ""
        if templates:
            template_context = "\n\n".join(
                [
                    f"Template: {t.get('name', 'Unknown')} (Similarity: {t.get('similarity_score', 0):.2f})\n{t.get('template_code', '')}"
                    for t in templates
                ]
            )
        else:
            template_context = "No similar templates found. Generate from scratch."

        return f"""Generate a production-ready Solidity smart contract.

User Request: {query}
Contract Type: {contract_type}

Relevant Templates (for reference):
{template_context}

Requirements:
1. Follow OpenZeppelin standards
2. Include security best practices
3. Add comprehensive NatSpec comments
4. Return ONLY Solidity code without explanations

Contract:"""
