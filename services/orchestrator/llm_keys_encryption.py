"""
BYOK at-rest encryption for wallet_users.encrypted_llm_keys.

When LLM_KEY_KMS_KEY_ARN is set: envelope encryption. Orchestrator never sees the master key.
  - Encrypt: generate DEK, encrypt payload with DEK (AES-GCM), KMS.encrypt(DEK), store [encrypted_DEK, payload].
  - Decrypt: KMS.decrypt(encrypted_DEK) -> DEK, decrypt payload locally.
Otherwise: Fernet with LLM_KEY_ENCRYPTION_KEY (key in env).
"""

from __future__ import annotations

import json
import os

try:
    from llm_keys_kms import (
        _is_envelope_blob,
        _is_kms_configured,
        decrypt_llm_keys_kms,
        encrypt_llm_keys_kms,
    )
except ImportError:
    _is_kms_configured = lambda: False
    _is_envelope_blob = lambda _: False
    decrypt_llm_keys_kms = None
    encrypt_llm_keys_kms = None


def _get_fernet_key() -> bytes:
    """Return Fernet key (44-char base64url bytes). Use Fernet.generate_key() to create."""
    raw = os.environ.get("LLM_KEY_ENCRYPTION_KEY")
    if not raw or len(raw) < 44:
        raise ValueError(
            "LLM_KEY_ENCRYPTION_KEY must be set (44-char base64url from Fernet.generate_key())"
        )
    return raw.encode("utf-8")


def encrypt_llm_keys(raw_keys: dict[str, str]) -> str:
    """Encrypt keys for storage. KMS envelope when LLM_KEY_KMS_KEY_ARN is set (master key never on server); else Fernet."""
    if _is_kms_configured() and encrypt_llm_keys_kms:
        return encrypt_llm_keys_kms(raw_keys)
    from cryptography.fernet import Fernet

    f = Fernet(_get_fernet_key())
    data = json.dumps(raw_keys, sort_keys=True).encode("utf-8")
    return f.encrypt(data).decode("ascii")


def decrypt_llm_keys(ciphertext: str) -> dict[str, str]:
    """Decrypt from storage. KMS envelope when configured and blob is v1 envelope; else Fernet (legacy or non-KMS)."""
    if _is_kms_configured() and _is_envelope_blob(ciphertext) and decrypt_llm_keys_kms:
        return decrypt_llm_keys_kms(ciphertext)
    if _is_kms_configured() and not _is_envelope_blob(ciphertext):
        try:
            from cryptography.fernet import Fernet

            f = Fernet(_get_fernet_key())
            data = f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
            return json.loads(data)
        except Exception:
            raise ValueError(
                "Stored value is not KMS envelope format. Re-save LLM keys in Settings to migrate to KMS envelope encryption."
            )
    from cryptography.fernet import Fernet

    f = Fernet(_get_fernet_key())
    data = f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
    return json.loads(data)
