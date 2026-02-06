"""Vector store operations using pgvector"""

import logging
from typing import Any, Dict, List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from hyperagent.models.template import ContractTemplate

logger = logging.getLogger(__name__)


class VectorStore:
    """
    Vector Store for Semantic Search

    Concept: Store and query vector embeddings for RAG
    Logic: Use pgvector extension for cosine similarity search
    Benefits: Fast semantic search, integrated with PostgreSQL
    """

    def __init__(self, db_session: Session):
        self.session = db_session

    async def store_contract(
        self,
        contract_code: str,
        contract_type: str,
        embedding: Optional[List[float]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Store contract with embedding

        Logic:
        1. Generate embedding if not provided (using LLM provider)
        2. Store in contract_templates table
        3. Return template ID

        Args:
            contract_code: Solidity contract code
            contract_type: Contract type (ERC20, ERC721, etc.)
            embedding: Optional pre-computed embedding (1536 dimensions)
            metadata: Optional metadata dictionary

        Returns:
            Template ID (UUID string)
        """
        try:
            # Generate embedding if not provided
            if embedding is None:
                embedding = await self._generate_embedding(contract_code)

            # Create template record
            from uuid import uuid4

            template = ContractTemplate(
                id=uuid4(),
                name=(
                    metadata.get("name", f"{contract_type}_template")
                    if metadata
                    else f"{contract_type}_template"
                ),
                description=metadata.get("description", "") if metadata else "",
                contract_type=contract_type,
                template_code=contract_code,
                embedding=embedding,
                is_active=True,
                tags=metadata.get("tags", []) if metadata else [],
                template_metadata=metadata or {},
            )

            # Store in database
            if isinstance(self.session, AsyncSession):
                self.session.add(template)
                await self.session.commit()
                await self.session.refresh(template)
            else:
                self.session.add(template)
                self.session.commit()
                self.session.refresh(template)

            logger.info(f"Stored contract template: {template.id}")
            return str(template.id)

        except Exception as e:
            logger.error(f"Failed to store contract in vector store: {e}")
            raise

    async def retrieve_similar(
        self, query_text: str, contract_type: Optional[str] = None, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find similar contracts using cosine similarity

        Logic:
        1. Generate embedding for query text
        2. Calculate cosine distance
        3. Order by similarity
        4. Return top N results

        Args:
            query_text: Query text (NLP description)
            contract_type: Optional contract type filter
            limit: Maximum number of results

        Returns:
            List of similar contract dictionaries
        """
        try:
            # Generate embedding for query
            query_embedding = await self._generate_embedding(query_text)

            # Find similar templates
            if isinstance(self.session, AsyncSession):
                similar_templates = await ContractTemplate.find_similar_async(
                    self.session, query_embedding, limit=limit
                )
            else:
                similar_templates = ContractTemplate.find_similar(
                    self.session, query_embedding, limit=limit
                )

            # Filter by contract type if specified
            if contract_type:
                similar_templates = [
                    t for t in similar_templates if t.contract_type == contract_type
                ]

            # Convert to dictionaries
            results = []
            for template in similar_templates:
                results.append(
                    {
                        "id": str(template.id),
                        "name": template.name,
                        "description": template.description,
                        "contract_type": template.contract_type,
                        "template_code": template.template_code,
                        "similarity_score": None,  # Could calculate from distance if needed
                        "metadata": template.template_metadata or {},
                    }
                )

            logger.info(f"Found {len(results)} similar contracts for query")
            return results

        except Exception as e:
            logger.error(f"Failed to retrieve similar contracts: {e}")
            # Return empty list on error (graceful degradation)
            return []

    async def _generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using LLM provider

        Args:
            text: Text to embed

        Returns:
            Embedding vector (1536 dimensions for Gemini, padded from 768)
        """
        try:
            from hyperagent.core.config import settings
            from hyperagent.llm.provider import LLMProviderFactory

            # Use Gemini for embeddings (returns 768, padded to 1536)
            llm_provider = LLMProviderFactory.create("gemini", api_key=settings.gemini_api_key)

            # Generate embedding using embed() method
            embedding = await llm_provider.embed(text)

            if not embedding:
                raise ValueError("Empty embedding returned")

            # Gemini returns 768 dimensions, padded to 1536 (or already 1536)
            # Ensure it's 1536 for pgvector
            if len(embedding) < 1536:
                # Pad with zeros if needed
                embedding = embedding + [0.0] * (1536 - len(embedding))
            elif len(embedding) > 1536:
                # Truncate if longer
                embedding = embedding[:1536]

            return embedding

        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            # Return zero vector as fallback (not ideal but prevents crashes)
            logger.warning("Using zero vector as embedding fallback")
            return [0.0] * 1536
