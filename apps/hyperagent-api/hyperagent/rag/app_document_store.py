"""App-wide document store and indexer utilities (pgvector + optional Pinecone)"""

import asyncio
import hashlib
import logging
import os
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.core.config import settings
from hyperagent.llm.provider import LLMProvider
from hyperagent.models.app_document import AppDocument

logger = logging.getLogger(__name__)


DEFAULT_INCLUDE_EXTS = {
    # Code
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".sol",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".md",
    ".sql",
    ".sh",
    ".ps1",
}

DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".github",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".cache",
    ".cursor",
}


def _is_binary_string(data: bytes) -> bool:
    return b"\0" in data


def _guess_language(file_path: str) -> Optional[str]:
    ext = os.path.splitext(file_path)[1].lower()
    mapping = {
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".sol": "solidity",
        ".md": "markdown",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".json": "json",
        ".sql": "sql",
        ".sh": "bash",
        ".ps1": "powershell",
        ".toml": "toml",
    }
    return mapping.get(ext)


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _chunk_text(text: str, chunk_size: int = 1800, overlap: int = 200) -> List[str]:
    if chunk_size <= 0:
        return [text]
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end]
        chunks.append(chunk)
        if end == n:
            break
        start = max(end - overlap, start + 1)
    return chunks


@dataclass
class IndexStats:
    files_scanned: int = 0
    files_indexed: int = 0
    chunks_inserted: int = 0
    chunks_skipped: int = 0
    errors: int = 0


class AppDocumentStore:
    """
    Store and retrieve `AppDocument` records with pgvector search.
    Optionally mirrors embeddings into Pinecone when configured.
    """

    def __init__(
        self,
        db: AsyncSession,
        llm: LLMProvider,
        repo_name: Optional[str] = None,
    ) -> None:
        self.db = db
        self.llm = llm
        self.repo_name = repo_name or "local"

        # Optional Pinecone setup
        self._pinecone_index = None
        if settings.pinecone_api_key:
            try:
                from pinecone import Pinecone

                pc = Pinecone(api_key=settings.pinecone_api_key)
                index_name = settings.pinecone_index_name or "hyperkit-docs"
                if index_name not in {i.name for i in pc.list_indexes()}:
                    logger.info("Creating Pinecone index %s (dimensions=1536)", index_name)
                    pc.create_index(
                        name=index_name,
                        dimension=1536,
                        metric="cosine",
                        spec={"serverless": {"cloud": "aws", "region": "us-east-1"}},
                    )
                self._pinecone_index = pc.Index(index_name)
            except Exception as e:
                logger.warning("Pinecone unavailable: %s", e)
                self._pinecone_index = None

    async def upsert_chunk(
        self,
        file_path: str,
        chunk_index: int,
        content: str,
        language: Optional[str],
        metadata: Optional[Dict] = None,
        precomputed_embedding: Optional[List[float]] = None,
    ) -> bool:
        """
        Upsert a single chunk into Postgres and optionally Pinecone.
        Returns True if inserted, False if skipped (duplicate exists).
        """
        checksum = _sha256_hex(content)

        # Check if exists (by unique key)
        stmt = select(AppDocument.id).where(
            (AppDocument.file_path == file_path)
            & (AppDocument.checksum == checksum)
            & (AppDocument.chunk_index == chunk_index)
        )
        existing = await self.db.execute(stmt)
        if existing.scalar_one_or_none() is not None:
            return False

        embedding = precomputed_embedding or await self._safe_embed(content)

        doc = AppDocument(
            repo_name=self.repo_name,
            file_path=file_path,
            language=language,
            checksum=checksum,
            chunk_index=chunk_index,
            content=content,
            embedding=embedding,
            tokens_estimate=max(1, len(content) // 4),
            metadata=metadata or {},
        )
        self.db.add(doc)
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

        # Mirror to Pinecone (best-effort)
        if self._pinecone_index is not None and embedding:
            try:
                vector_id = f"{checksum}:{chunk_index}"
                self._pinecone_index.upsert(
                    vectors=[
                        {
                            "id": vector_id,
                            "values": embedding,
                            "metadata": {
                                "file_path": file_path,
                                "chunk_index": chunk_index,
                                "language": language or "",
                                "repo_name": self.repo_name,
                            },
                        }
                    ]
                )
            except Exception as e:
                logger.warning("Pinecone upsert failed: %s", e)

        return True

    async def delete_file(self, file_path: str) -> int:
        """Delete all chunks for a given file_path. Returns number of rows deleted."""
        stmt = delete(AppDocument).where(AppDocument.file_path == file_path)
        result = await self.db.execute(stmt)
        await self.db.commit()
        # SQLAlchemy 2.x returns result.rowcount for Core deletes
        return result.rowcount or 0

    async def search(self, query: str, top_k: int = 5) -> List[Dict]:
        """Semantic search using pgvector similarity."""
        query_emb = await self._safe_embed(query)
        docs = await AppDocument.find_similar_async(self.db, query_emb, limit=top_k)
        results = []
        for d in docs:
            snippet = d.content[:400]
            results.append(
                {
                    "id": str(d.id),
                    "file_path": d.file_path,
                    "language": d.language,
                    "chunk_index": d.chunk_index,
                    "content_snippet": snippet,
                    "tokens_estimate": d.tokens_estimate,
                }
            )
        return results

    async def index_paths(
        self,
        paths: Sequence[str],
        root_dir: Optional[str] = None,
        include_exts: Optional[Iterable[str]] = None,
        exclude_dirs: Optional[Iterable[str]] = None,
        max_file_size_bytes: int = 1_500_000,
        chunk_size: int = 1800,
        overlap: int = 200,
        reindex: bool = False,
        max_files: Optional[int] = None,
    ) -> IndexStats:
        """
        Walk and index files under the provided paths.
        """
        root = os.path.abspath(root_dir or os.getcwd())
        include = set(include_exts or DEFAULT_INCLUDE_EXTS)
        exclude = set(exclude_dirs or DEFAULT_EXCLUDED_DIRS)

        stats = IndexStats()
        processed_files = 0

        for input_path in paths:
            abs_path = os.path.abspath(os.path.join(root, input_path))
            if os.path.isdir(abs_path):
                for dirpath, dirnames, filenames in os.walk(abs_path):
                    # mutate dirnames in-place to skip excluded
                    dirnames[:] = [d for d in dirnames if d not in exclude]
                    for fname in filenames:
                        if max_files and processed_files >= max_files:
                            return stats
                        fpath = os.path.join(dirpath, fname)
                        if os.path.splitext(fpath)[1].lower() not in include:
                            continue
                        inserted_any, inserted_count, skipped_count = await self._index_single_file(
                            fpath, root, max_file_size_bytes, chunk_size, overlap, reindex
                        )
                        if inserted_any:
                            stats.files_indexed += 1
                        stats.chunks_inserted += inserted_count
                        stats.chunks_skipped += skipped_count
                        stats.files_scanned += 1
                        processed_files += 1
            elif os.path.isfile(abs_path):
                if max_files and processed_files >= max_files:
                    return stats
                inserted_any, inserted_count, skipped_count = await self._index_single_file(
                    abs_path, root, max_file_size_bytes, chunk_size, overlap, reindex
                )
                if inserted_any:
                    stats.files_indexed += 1
                stats.chunks_inserted += inserted_count
                stats.chunks_skipped += skipped_count
                stats.files_scanned += 1
                processed_files += 1

        return stats

    async def _index_single_file(
        self,
        abs_path: str,
        root: str,
        max_file_size_bytes: int,
        chunk_size: int,
        overlap: int,
        reindex: bool,
    ) -> tuple[bool, int, int]:
        rel_path = os.path.relpath(abs_path, root)
        try:
            size = os.path.getsize(abs_path)
            if size > max_file_size_bytes:
                logger.debug("Skip large file %s (%.2f MB)", rel_path, size / 1_000_000)
                return False, 0, 0
            with open(abs_path, "rb") as f:
                raw = f.read()
            if _is_binary_string(raw):
                return False, 0, 0
            text = raw.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.warning("Failed to read %s: %s", rel_path, e)
            return False, 0, 0

        language = _guess_language(rel_path)
        chunks = _chunk_text(text, chunk_size=chunk_size, overlap=overlap)

        if reindex:
            await self.delete_file(rel_path)

        inserted_any = False
        inserted_count = 0
        skipped_count = 0
        for idx, chunk in enumerate(chunks):
            try:
                inserted = await self.upsert_chunk(
                    file_path=rel_path,
                    chunk_index=idx,
                    content=chunk,
                    language=language,
                    metadata={"root": root},
                )
                inserted_any = inserted_any or inserted
                if inserted:
                    inserted_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                logger.warning("Upsert failed for %s#%d: %s", rel_path, idx, e)
        return inserted_any, inserted_count, skipped_count

    async def _safe_embed(self, text: str) -> List[float]:
        try:
            emb = await self.llm.embed(text)
            if not emb:
                return [0.0] * 1536
            if len(emb) < 1536:
                emb = emb + [0.0] * (1536 - len(emb))
            elif len(emb) > 1536:
                emb = emb[:1536]
            return emb
        except Exception as e:
            logger.warning("Embedding failed, using zero vector: %s", e)
            return [0.0] * 1536
