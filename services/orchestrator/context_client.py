"""
Long-term context read/write. Uses Acontext when MEMORY_BACKEND=acontext and configured.
No-op when disabled. Wired into pipeline nodes for spec, design, deploy.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_acontext_store = None
_acontext_search = None
_configured = False


def _ensure_acontext():
    global _acontext_store, _acontext_search, _configured
    if _configured:
        return
    backend = (os.environ.get("MEMORY_BACKEND") or "").strip().lower()
    if backend != "acontext":
        _configured = True
        return
    try:
        import importlib.util

        _ctx_dir = os.path.join(os.path.dirname(__file__), "..", "context")
        _adapter_path = os.path.join(_ctx_dir, "acontext_adapter.py")
        if not os.path.isfile(_adapter_path):
            raise ImportError("acontext_adapter.py not found")
        spec = importlib.util.spec_from_file_location("acontext_adapter", _adapter_path)
        if spec is None or spec.loader is None:
            raise ImportError("acontext_adapter spec invalid")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _store = getattr(mod, "store_context", None)
        _search = getattr(mod, "search_context", None)
        _ok = getattr(mod, "is_configured", lambda: False)
        if _store and _search and _ok():
            _acontext_store = _store
            _acontext_search = _search
    except ImportError as e:
        logger.debug("acontext adapter not available: %s", e)
    _configured = True


def store_context(
    user_id: str,
    context_type: str,
    content: dict[str, Any],
    agent_name: str | None = "hyperagent",
    metadata: dict[str, Any] | None = None,
) -> bool:
    """Store run context when Acontext configured. Returns True if stored."""
    _ensure_acontext()
    if _acontext_store is None:
        return False
    try:
        _acontext_store(
            user_id,
            context_type,
            content,
            agent_name=agent_name,
            metadata=metadata or {},
        )
        return True
    except Exception as e:
        logger.warning("[context] store failed: %s", e)
        return False


def search_context(
    user_id: str,
    query: str | None = None,
    context_type: str | None = None,
    agent_name: str | None = "hyperagent",
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Search prior context when Acontext configured. Returns list of records."""
    _ensure_acontext()
    if _acontext_search is None:
        return []
    try:
        return _acontext_search(
            user_id,
            query=query,
            context_type=context_type,
            agent_name=agent_name,
            limit=limit,
        )
    except Exception as e:
        logger.warning("[context] search failed: %s", e)
        return []
