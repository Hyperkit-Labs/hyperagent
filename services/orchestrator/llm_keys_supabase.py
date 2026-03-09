"""
BYOK persistence: read/write wallet_users.encrypted_llm_keys by user_id.
user_id = gateway X-User-Id = wallet_users.id (SIWE). Uses llm_keys_encryption (Fernet) and db Supabase client (service role).
Ensures keys persist across restarts and refresh; gateway must send X-User-Id (from JWT sub = wallet_users.id).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import db
from llm_keys_encryption import decrypt_llm_keys, encrypt_llm_keys

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    return bool(
        db.is_configured()
        and (
            os.environ.get("LLM_KEY_ENCRYPTION_KEY")
            or os.environ.get("LLM_KEY_KMS_KEY_ARN")
        )
    )


def _get_ciphertext_from_value(val: Any) -> str | None:
    """Extract ciphertext string from wallet_users.encrypted_llm_keys (JSONB may be string or object)."""
    if val is None:
        return None
    if isinstance(val, str) and val.strip():
        return val.strip()
    if isinstance(val, dict) and isinstance(val.get("ciphertext"), str):
        return val["ciphertext"].strip()
    return None


def get_configured_providers(user_id: str) -> list[str]:
    """Return list of configured provider names for user_id (no key values). user_id = wallet_users.id."""
    if not _is_configured() or not user_id:
        return []
    client = db._client()
    if not client:
        return []
    try:
        r = (
            client.table("wallet_users")
            .select("encrypted_llm_keys")
            .eq("id", user_id)
            .execute()
        )
        row = (r.data or [{}])[0] if r.data else {}
        ciphertext = _get_ciphertext_from_value(row.get("encrypted_llm_keys"))
        if not ciphertext:
            return []
        raw = decrypt_llm_keys(ciphertext)
        return [k for k, v in raw.items() if v and str(v).strip()]
    except Exception as e:
        logger.warning(
            "[byok] get_configured_providers user_id=%s error=%s", user_id, e
        )
        return []


def get_keys_for_user(user_id: str) -> dict[str, str]:
    """Return decrypted key map for pipeline use (internal). user_id = wallet_users.id."""
    if not _is_configured() or not user_id:
        return {}
    client = db._client()
    if not client:
        return {}
    try:
        r = (
            client.table("wallet_users")
            .select("encrypted_llm_keys")
            .eq("id", user_id)
            .execute()
        )
        row = (r.data or [{}])[0] if r.data else {}
        ciphertext = _get_ciphertext_from_value(row.get("encrypted_llm_keys"))
        if not ciphertext:
            return {}
        return decrypt_llm_keys(ciphertext)
    except Exception as e:
        logger.warning("[byok] get_keys_for_user user_id=%s error=%s", user_id, e)
        return {}


def set_keys_for_user(user_id: str, keys: dict[str, str]) -> list[str]:
    """Merge keys into wallet_users.encrypted_llm_keys for user_id. Returns list of configured provider names."""
    if not _is_configured() or not user_id:
        return []
    client = db._client()
    if not client:
        return []
    try:
        current = get_keys_for_user(user_id)
        merged = {**current, **{k: v for k, v in keys.items() if v and str(v).strip()}}
        ciphertext = encrypt_llm_keys(merged)
        client.table("wallet_users").update({"encrypted_llm_keys": ciphertext}).eq(
            "id", user_id
        ).execute()
        return list(merged.keys())
    except Exception as e:
        logger.warning("[byok] set_keys_for_user user_id=%s error=%s", user_id, e)
        return []


def delete_keys_for_user(user_id: str) -> bool:
    """Clear encrypted_llm_keys for user_id (wallet_users.id). Returns True if a row was updated."""
    if not _is_configured() or not user_id:
        return False
    if not db._is_uuid(user_id):
        logger.warning(
            "[byok] delete_keys_for_user invalid user_id (not UUID): %s",
            user_id[:20] if user_id else "",
        )
        return False
    client = db._client()
    if not client:
        return False
    try:
        r = (
            client.table("wallet_users")
            .update({"encrypted_llm_keys": None})
            .eq("id", user_id)
            .execute()
        )
        updated = r.data if r.data is not None else []
        if not updated:
            logger.warning(
                "[byok] delete_keys_for_user no row updated for user_id=%s", user_id
            )
            return False
        return True
    except Exception as e:
        logger.warning("[byok] delete_keys_for_user user_id=%s error=%s", user_id, e)
        return False
