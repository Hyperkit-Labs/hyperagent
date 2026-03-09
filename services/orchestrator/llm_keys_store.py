"""
In-memory LLM API keys per workspace (BYOK). Keyed by workspace_id; no key values returned on GET.
"""

from __future__ import annotations

import threading

_store: dict[str, dict[str, str]] = {}
_lock = threading.Lock()
DEFAULT_WORKSPACE = "default"


def get_configured_providers(workspace_id: str = DEFAULT_WORKSPACE) -> list[str]:
    with _lock:
        keys = _store.get(workspace_id) or {}
        return [k for k, v in keys.items() if v and str(v).strip()]


def get_keys_for_pipeline(workspace_id: str = DEFAULT_WORKSPACE) -> dict[str, str]:
    """Return key values for pipeline use (internal)."""
    with _lock:
        return dict(_store.get(workspace_id) or {})


def set_keys(workspace_id: str, keys: dict[str, str]) -> list[str]:
    """Merge keys into workspace. Returns list of configured provider names."""
    with _lock:
        current = _store.get(workspace_id) or {}
        merged = {**current, **{k: v for k, v in keys.items() if v and str(v).strip()}}
        _store[workspace_id] = merged
        return list(merged.keys())


def delete_keys(workspace_id: str = DEFAULT_WORKSPACE) -> None:
    with _lock:
        _store.pop(workspace_id, None)
