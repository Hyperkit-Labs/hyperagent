"""
Qdrant collections and indexing. Vector size 1536 (OpenAI text-embedding-3-small / ada-002).
Collections: templates, specs. Create if not exist; upsert and query.
"""
from __future__ import annotations

import os
from typing import Any

VECTOR_SIZE = 1536
COLLECTION_SPECS = "specs"
COLLECTION_TEMPLATES = "templates"

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams
        _client = QdrantClient(url=url, timeout=10)
        return _client
    except Exception:
        return None


def is_configured() -> bool:
    return bool(os.environ.get("QDRANT_URL") and _get_client() is not None)


def ensure_collections() -> None:
    """Create collections if they do not exist."""
    c = _get_client()
    if not c:
        return
    from qdrant_client.models import Distance, VectorParams
    for name in (COLLECTION_SPECS, COLLECTION_TEMPLATES):
        try:
            c.get_collection(name)
        except Exception:
            c.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )


def upsert(collection: str, point_id: str, vector: list[float], payload: dict[str, Any]) -> bool:
    """Upsert one point. Returns True on success."""
    c = _get_client()
    if not c:
        return False
    if collection not in (COLLECTION_SPECS, COLLECTION_TEMPLATES):
        return False
    try:
        ensure_collections()
        c.upsert(
            collection_name=collection,
            points=[{"id": point_id, "vector": vector, "payload": payload}],
        )
        return True
    except Exception:
        return False


def query(collection: str, vector: list[float], limit: int = 10) -> list[dict]:
    """Search by vector; return list of {id, score, payload}."""
    c = _get_client()
    if not c:
        return []
    if collection not in (COLLECTION_SPECS, COLLECTION_TEMPLATES):
        return []
    try:
        results = c.search(
            collection_name=collection,
            query_vector=vector,
            limit=limit,
        )
        return [
            {"id": str(r.id), "score": r.score, "payload": r.payload or {}}
            for r in results
        ]
    except Exception:
        return []
