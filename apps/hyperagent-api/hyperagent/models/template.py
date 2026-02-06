"""Contract template model with vector embeddings"""

import uuid
from typing import List

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, Boolean, Column, DateTime, String, Text
from sqlalchemy import func as sql_func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from hyperagent.models import Base


class ContractTemplate(Base):
    """
    Contract Template with Vector Embeddings

    Concept: Store contract templates with semantic embeddings
    Logic: Embeddings enable similarity search for RAG
    Usage: Find similar templates when generating contracts
    """

    __tablename__ = "contract_templates"
    __table_args__ = {"schema": "hyperagent"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    contract_type = Column(String(50))

    # Template content
    template_code = Column(Text, nullable=False)
    ipfs_hash = Column(String(100), unique=True)

    # Vector embedding (1536 dimensions for Gemini)
    embedding = Column(Vector(1536))

    # Metadata
    version = Column(String(20))
    is_active = Column(Boolean, default=True)
    tags = Column(ARRAY(String))
    template_metadata = Column(JSONB)  # For version history and other metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @classmethod
    async def find_similar_async(
        cls, session, query_embedding: List[float], limit: int = 5
    ) -> List["ContractTemplate"]:
        """
        Semantic similarity search (async version)

        Logic: Use cosine similarity to find similar templates
        Formula: cosine_similarity = dot(a, b) / (||a|| * ||b||)
        """
        from sqlalchemy import select

        # Calculate cosine distance (lower = more similar)
        similarity = sql_func.cosine_distance(
            cls.embedding, sql_func.cast(query_embedding, Vector(1536))
        )

        # Query and order by similarity
        stmt = select(cls).where(cls.is_active == True).order_by(similarity).limit(limit)

        result = await session.execute(stmt)
        return result.scalars().all()

    @classmethod
    def find_similar(
        cls, session, query_embedding: List[float], limit: int = 5
    ) -> List["ContractTemplate"]:
        """
        Semantic similarity search (sync version for backward compatibility)

        Logic: Use cosine similarity to find similar templates
        Formula: cosine_similarity = dot(a, b) / (||a|| * ||b||)
        """
        from sqlalchemy import select

        # Calculate cosine distance (lower = more similar)
        similarity = sql_func.cosine_distance(
            cls.embedding, sql_func.cast(query_embedding, Vector(1536))
        )

        # Query and order by similarity
        stmt = select(cls).where(cls.is_active == True).order_by(similarity).limit(limit)

        # Handle both sync and async sessions
        if hasattr(session, "execute") and hasattr(session.execute, "__call__"):
            # Try async first
            try:
                import asyncio

                if asyncio.iscoroutinefunction(session.execute):
                    # This is an async session, but we're in a sync method
                    # Return a coroutine that can be awaited
                    return session.execute(stmt)
            except:
                pass

        # Sync session
        result = session.execute(stmt)
        if hasattr(result, "scalars"):
            return result.scalars().all()
        else:
            # Legacy query interface
            return (
                session.query(cls)
                .filter(cls.is_active == True)
                .order_by(similarity)
                .limit(limit)
                .all()
            )
