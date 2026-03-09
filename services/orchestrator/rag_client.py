"""RAG client: query vectordb service for spec/template context. Used by spec and codegen nodes.
Set VECTORDB_URL (default http://localhost:8010) to enable RAG. No-op when unconfigured.
Supports versioned metadata fields (library_version, status, timestamp) for filtered retrieval."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

VECTORDB_URL = os.environ.get("VECTORDB_URL", "http://localhost:8010").rstrip("/")
RAG_TIMEOUT = float(os.environ.get("RAG_TIMEOUT_SEC", "5"))


def is_configured() -> bool:
    return bool(VECTORDB_URL and VECTORDB_URL != "http://localhost:8010") or bool(os.environ.get("VECTORDB_ENABLED"))


async def query_specs(
    prompt: str,
    limit: int = 5,
    library_version: str | None = None,
    status_filter: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    """Query vectordb for similar specs. When user_id is set, prioritizes tenant-scoped fixes (The Vault)."""
    if not is_configured():
        return []
    seen: set[str] = set()
    results: list[dict[str, Any]] = []
    try:
        if user_id:
            payload_user: dict[str, Any] = {
                "query": prompt,
                "collection": "specs",
                "limit": min(limit, 3),
                "metadata_filter": {"user_id": user_id, "status": "verified"},
            }
            if library_version:
                payload_user["metadata_filter"]["library_version"] = library_version
            if status_filter:
                payload_user["metadata_filter"]["status"] = status_filter
            async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
                r = await client.post(f"{VECTORDB_URL}/query", json=payload_user)
                r.raise_for_status()
                for item in r.json().get("results", []):
                    sid = item.get("id") or item.get("payload", {}).get("spec_id", "")
                    if sid and sid not in seen:
                        seen.add(sid)
                        results.append(item)
        payload_global: dict[str, Any] = {"query": prompt, "collection": "specs", "limit": limit}
        metadata_filter: dict[str, str] = {}
        if library_version:
            metadata_filter["library_version"] = library_version
        if status_filter:
            metadata_filter["status"] = status_filter
        else:
            metadata_filter["status"] = "verified"
        if metadata_filter:
            payload_global["metadata_filter"] = metadata_filter
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.post(f"{VECTORDB_URL}/query", json=payload_global)
            r.raise_for_status()
            for item in r.json().get("results", []):
                sid = item.get("id") or item.get("payload", {}).get("spec_id", "")
                if sid and sid not in seen:
                    seen.add(sid)
                    results.append(item)
        return results[:limit]
    except Exception as e:
        logger.warning("[rag] query_specs failed: %s", e)
        return []


async def query_security_advisories(
    prompt: str, limit: int = 5, user_id: str | None = None
) -> list[dict[str, Any]]:
    """Query vectordb for security advisories (type=security_advisory)."""
    if not is_configured():
        return []
    try:
        payload: dict[str, Any] = {
            "query": prompt,
            "collection": "specs",
            "limit": limit,
            "metadata_filter": {"type": "security_advisory", "status": "verified"},
        }
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.post(f"{VECTORDB_URL}/query", json=payload)
            r.raise_for_status()
            return r.json().get("results", [])
    except Exception as e:
        logger.warning("[rag] query_security_advisories failed: %s", e)
        return []


async def query_scv_patterns(
    prompt: str, limit: int = 5, user_id: str | None = None
) -> list[dict[str, Any]]:
    """Query vectordb for SCV vulnerability patterns (type=scv_pattern)."""
    if not is_configured():
        return []
    try:
        payload: dict[str, Any] = {
            "query": prompt,
            "collection": "specs",
            "limit": limit,
            "metadata_filter": {"type": "scv_pattern", "status": "verified"},
        }
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.post(f"{VECTORDB_URL}/query", json=payload)
            r.raise_for_status()
            return r.json().get("results", [])
    except Exception as e:
        logger.warning("[rag] query_scv_patterns failed: %s", e)
        return []


async def query_templates(
    prompt: str,
    limit: int = 5,
    library_version: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    """Query vectordb for similar templates with optional version filtering."""
    if not is_configured():
        return []
    try:
        payload: dict[str, Any] = {"query": prompt, "collection": "templates", "limit": limit}
        if library_version:
            payload["metadata_filter"] = {"library_version": library_version}
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.post(f"{VECTORDB_URL}/query", json=payload)
            r.raise_for_status()
            return r.json().get("results", [])
    except Exception as e:
        logger.warning("[rag] query_templates failed: %s", e)
        return []


async def index_spec(
    spec_id: str,
    spec: dict,
    text: str | None = None,
    library_version: str | None = None,
    status: str = "verified",
) -> bool:
    """Index a finalized spec for future RAG retrieval with versioned metadata."""
    if not is_configured():
        return False
    try:
        meta: dict[str, Any] = {
            "library_version": library_version or spec.get("version", "1.0"),
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if spec.get("type"):
            meta["type"] = spec["type"]
        payload: dict[str, Any] = {
            "spec_id": spec_id,
            "spec": spec,
            "text": text,
            "metadata": meta,
        }
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.post(f"{VECTORDB_URL}/index/spec", json=payload)
            r.raise_for_status()
            return r.json().get("ok", False)
    except Exception as e:
        logger.warning("[rag] index_spec failed: %s", e)
        return False


async def index_fix(
    run_id: str,
    original_code: str,
    fixed_code: str,
    error_context: str,
    user_id: str | None = None,
) -> bool:
    """Index an autofix result for cross-project memory (The Vault).
    Stores the error and fix pair so future similar projects benefit."""
    if not is_configured():
        return False
    try:
        payload: dict[str, Any] = {
            "spec_id": f"fix-{run_id}",
            "spec": {
                "type": "autofix",
                "original_snippet": original_code[:2000],
                "fixed_snippet": fixed_code[:2000],
                "error_context": error_context[:500],
            },
            "text": f"Autofix: {error_context[:200]}",
            "metadata": {
                "status": "verified",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "type": "autofix",
            },
        }
        if user_id:
            payload["metadata"]["user_id"] = user_id
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.post(f"{VECTORDB_URL}/index/spec", json=payload)
            r.raise_for_status()
            return r.json().get("ok", False)
    except Exception as e:
        logger.warning("[rag] index_fix failed: %s", e)
        return False


async def blacklist_entry(spec_id: str, reason: str = "economically unsafe") -> bool:
    """Soft-delete/blacklist a RAG entry by marking its status as deprecated.
    Ensures the DesignAgent excludes it from future queries."""
    if not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            r = await client.patch(
                f"{VECTORDB_URL}/metadata/{spec_id}",
                json={"status": "deprecated", "deprecation_reason": reason},
            )
            r.raise_for_status()
            return r.json().get("ok", False)
    except Exception as e:
        logger.warning("[rag] blacklist_entry failed: %s", e)
        return False
