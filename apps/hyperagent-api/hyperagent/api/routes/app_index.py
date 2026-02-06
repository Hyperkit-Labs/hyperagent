"""API routes for application-wide indexing and semantic search"""

import logging
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.core.config import settings
from hyperagent.db.session import get_db
from hyperagent.llm.provider import LLMProvider, LLMProviderFactory
from hyperagent.rag.app_document_store import AppDocumentStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/app-index", tags=["app-index"])


class IndexRequest(BaseModel):
    paths: List[str] = Field(default_factory=lambda: ["."])
    root_dir: Optional[str] = None
    include_exts: Optional[List[str]] = None
    exclude_dirs: Optional[List[str]] = None
    chunk_size: int = 1800
    overlap: int = 200
    reindex: bool = False
    max_files: Optional[int] = None
    max_file_size_bytes: int = 1_500_000
    repo_name: Optional[str] = None
    llm_provider: Optional[str] = Field(default=None, description="gemini or openai (auto if None)")


class IndexResponse(BaseModel):
    files_scanned: int
    files_indexed: int
    chunks_inserted: int
    chunks_skipped: int
    errors: int


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    llm_provider: Optional[str] = Field(default=None, description="gemini or openai (auto if None)")


class SearchResult(BaseModel):
    id: str
    file_path: str
    chunk_index: int
    content_snippet: str
    language: Optional[str]
    tokens_estimate: Optional[int]


def _select_llm_provider(provider_hint: Optional[str]):
    # Choose provider based on hint and available keys
    provider_hint = (provider_hint or "").lower() or None
    if provider_hint == "gemini" and settings.gemini_api_key:
        return LLMProviderFactory.create("gemini", api_key=settings.gemini_api_key, model_name=settings.gemini_model)
    if provider_hint == "openai" and settings.openai_api_key:
        return LLMProviderFactory.create("openai", api_key=settings.openai_api_key)

    # Auto
    if settings.gemini_api_key:
        return LLMProviderFactory.create("gemini", api_key=settings.gemini_api_key, model_name=settings.gemini_model)
    if settings.openai_api_key:
        return LLMProviderFactory.create("openai", api_key=settings.openai_api_key)
    # Fallback to zero-vector provider so indexing still works without keys
    class _ZeroLLM(LLMProvider):
        async def generate(self, prompt: str, **kwargs) -> str:  # pragma: no cover
            return ""

        async def embed(self, text: str) -> List[float]:  # pragma: no cover
            return [0.0] * 1536

    logging.getLogger(__name__).warning(
        "No LLM API key configured; using zero-vector embeddings. Set GEMINI_API_KEY or OPENAI_API_KEY for semantic quality."
    )
    return _ZeroLLM()


@router.post("/index", response_model=IndexResponse)
async def index_repository(request: IndexRequest, db: AsyncSession = Depends(get_db)):
    """
    Walk the repository, chunk files, embed, and upsert into vector store.
    """
    llm = _select_llm_provider(request.llm_provider)
    root_dir = request.root_dir or os.getcwd()

    store = AppDocumentStore(db=db, llm=llm, repo_name=request.repo_name)

    stats = await store.index_paths(
        paths=request.paths,
        root_dir=root_dir,
        include_exts=request.include_exts,
        exclude_dirs=request.exclude_dirs,
        max_file_size_bytes=request.max_file_size_bytes,
        chunk_size=request.chunk_size,
        overlap=request.overlap,
        reindex=request.reindex,
        max_files=request.max_files,
    )

    # Note: chunks_inserted and chunks_skipped are tracked internally per upsert; we return 0 for now.
    # Could be enhanced by adjusting upsert return path to bubble counts.
    return IndexResponse(
        files_scanned=stats.files_scanned,
        files_indexed=stats.files_indexed,
        chunks_inserted=stats.chunks_inserted,
        chunks_skipped=stats.chunks_skipped,
        errors=stats.errors,
    )


@router.post("/search", response_model=List[SearchResult])
async def search_index(request: SearchRequest, db: AsyncSession = Depends(get_db)):
    """Semantic search across indexed documents."""
    llm = _select_llm_provider(request.llm_provider)
    store = AppDocumentStore(db=db, llm=llm)
    results = await store.search(request.query, top_k=request.top_k)
    return [SearchResult(**r) for r in results]
