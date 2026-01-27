"""Application-wide document chunks with vector embeddings"""

import uuid
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BOOLEAN,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from sqlalchemy import select

from hyperagent.models import Base


class AppDocument(Base):
    """
    AppDocument stores chunked content from the codebase/docs with an embedding

    Table: hyperagent.app_documents
    - Supports semantic search across entire application
    - Embedding size: 1536 (aligned with existing pgvector usage)
    """

    __tablename__ = "app_documents"
    __table_args__ = (
        {"schema": "hyperagent"},
        UniqueConstraint(
            "file_path", "checksum", "chunk_index", name="uq_app_documents_file_checksum_chunk"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_name = Column(String(255), nullable=True)
    file_path = Column(Text, nullable=False, index=True)
    language = Column(String(30), nullable=True)
    checksum = Column(String(64), nullable=False)  # sha256
    chunk_index = Column(Integer, nullable=False, default=0)

    # Content and embedding
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))

    # Optional metadata
    tokens_estimate = Column(Integer, nullable=True)
    metadata = Column(JSONB, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @classmethod
    async def find_similar_async(
        cls, session, query_embedding: List[float], limit: int = 5
    ) -> List["AppDocument"]:
        """
        Semantic similarity search using pgvector cosine distance (async)
        """
        from pgvector.sqlalchemy import Vector as _Vector
        from sqlalchemy.sql import func as sql_func
        from sqlalchemy import cast

        similarity = sql_func.cosine_distance(cls.embedding, cast(query_embedding, _Vector(1536)))
        stmt = (
            select(cls)
            .where(cls.embedding.isnot(None))
            .order_by(similarity)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return result.scalars().all()

    def __repr__(self) -> str:
        return f"<AppDocument {self.file_path}#{self.chunk_index}>"
