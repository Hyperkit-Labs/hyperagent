"""
In-memory LLM API keys per workspace (BYOK) for dev when Supabase is not configured.

Values are stored encrypted at rest when llm_keys_encryption can run (Fernet or KMS),
so plaintext keys do not sit in a plain dict across idle requests.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_store: dict[str, Any] = {}
_lock = threading.Lock()
DEFAULT_WORKSPACE = "default"
_ENC_MARKER = "__ha_enc__"


def _decrypt_entry(raw: Any) -> dict[str, str]:
    if not raw:
        return {}
    if (
        isinstance(raw, dict)
        and _ENC_MARKER in raw
        and isinstance(raw[_ENC_MARKER], str)
    ):
        try:
            from llm_keys_encryption import decrypt_llm_keys

            return decrypt_llm_keys(raw[_ENC_MARKER])
        except Exception as e:
            logger.warning("[byok] in-memory decrypt failed: %s", e)
            return {}
    if isinstance(raw, dict):
        return {k: v for k, v in raw.items() if k != _ENC_MARKER and isinstance(v, str)}
    return {}


def get_configured_providers(workspace_id: str = DEFAULT_WORKSPACE) -> list[str]:
    keys = get_keys_for_pipeline(workspace_id)
    return [k for k, v in keys.items() if v and str(v).strip()]


def get_keys_for_pipeline(workspace_id: str = DEFAULT_WORKSPACE) -> dict[str, str]:
    """Return key values for pipeline use (internal)."""
    with _lock:
        raw = _store.get(workspace_id)
    return _decrypt_entry(raw)


def set_keys(workspace_id: str, keys: dict[str, str]) -> list[str]:
    """Merge keys into workspace. Returns list of configured provider names."""
    with _lock:
        current = _decrypt_entry(_store.get(workspace_id))
        merged = {
            **current,
            **{k: v for k, v in keys.items() if v and str(v).strip()},
        }
        try:
            from llm_keys_encryption import encrypt_llm_keys

            _store[workspace_id] = {_ENC_MARKER: encrypt_llm_keys(merged)}
        except Exception as e:
            logger.warning(
                "[byok] in-memory encrypt unavailable, storing plaintext (dev only): %s",
                e,
            )
            _store[workspace_id] = dict(merged)
        return list(merged.keys())


def delete_keys(workspace_id: str = DEFAULT_WORKSPACE) -> None:
    with _lock:
        _store.pop(workspace_id, None)
