"""
Thin Acontext adapter: config from env, call Acontext REST API. No custom protocol; use vendor API only.
When MEMORY_BACKEND=acontext and ACONTEXT_API_URL (+ ACONTEXT_API_KEY) set, use this. One adapter, one code path.
"""
from __future__ import annotations

import os
from typing import Any

_BASE = (os.environ.get("ACONTEXT_API_URL") or os.environ.get("ACONTEXT_BASE_URL") or "").rstrip("/")
_KEY = (os.environ.get("ACONTEXT_API_KEY") or "").strip()


def is_configured() -> bool:
    """True when Acontext API URL and key are set."""
    return bool(_BASE and _KEY)


def store_context(
    user_id: str,
    context_type: str,
    content: dict[str, Any],
    agent_name: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[str, str]:
    """
    POST to Acontext memories API. Returns (memory_id, created_at).
    Raises on non-2xx. Thin: config in, call SDK/API, return result.
    """
    import httpx
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {_KEY}"}
    body = {
        "content": content,
        "metadata": {
            "workspace_id": user_id,
            "agent": agent_name or "hyperagent",
            "context_type": context_type,
            **(metadata or {}),
        },
    }
    with httpx.Client(timeout=15.0) as client:
        r = client.post(f"{_BASE}/memories", json=body, headers=headers)
        r.raise_for_status()
        data = r.json()
    mid = data.get("id") or data.get("memory_id") or ""
    created = data.get("created_at") or data.get("created_at") or ""
    return (str(mid), str(created))


def search_context(
    user_id: str,
    query: str | None = None,
    context_type: str | None = None,
    agent_name: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    POST to Acontext memories search API. Returns list of records (id, content, metadata, created_at).
    Thin: config in, call API, return result.
    """
    import httpx
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {_KEY}"}
    body = {
        "workspace_id": user_id,
        "query": query or "",
        "agent": agent_name,
        "context_type": context_type,
        "limit": min(max(limit, 1), 100),
    }
    with httpx.Client(timeout=15.0) as client:
        r = client.post(f"{_BASE}/memories/search", json=body, headers=headers)
        r.raise_for_status()
        data = r.json()
    results = data.get("results") or data.get("memories") or data if isinstance(data, list) else []
    return [dict(x) for x in results]
