"""Unit tests for llm_keys_encryption. Fernet encrypt/decrypt round-trip."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ),
)

_TEST_FERNET_KEY = "PyDnoXvIlbKMLEoBFs_iApA1vqi3YPOJWXKoAPYUkAo="


@pytest.fixture(autouse=True)
def _patch_env(monkeypatch):
    monkeypatch.setenv("LLM_KEY_ENCRYPTION_KEY", _TEST_FERNET_KEY)
    monkeypatch.delenv("LLM_KEY_KMS_KEY_ARN", raising=False)


def test_encrypt_decrypt_round_trip():
    """Encrypt and decrypt round-trip returns original keys."""
    from llm_keys_encryption import decrypt_llm_keys, encrypt_llm_keys

    raw = {"openai": "sk-test-123", "anthropic": "sk-ant-test-456"}
    cipher = encrypt_llm_keys(raw)
    assert isinstance(cipher, str)
    assert cipher != str(raw)
    decrypted = decrypt_llm_keys(cipher)
    assert decrypted == raw


def test_encrypt_empty_dict():
    """Encrypt empty dict produces valid ciphertext."""
    from llm_keys_encryption import decrypt_llm_keys, encrypt_llm_keys

    raw = {}
    cipher = encrypt_llm_keys(raw)
    assert isinstance(cipher, str)
    decrypted = decrypt_llm_keys(cipher)
    assert decrypted == raw


def test_decrypt_invalid_raises():
    """Decrypt with invalid ciphertext raises."""
    from llm_keys_encryption import decrypt_llm_keys

    with pytest.raises(Exception):
        decrypt_llm_keys("not-valid-fernet")


def test_encrypt_without_key_raises(monkeypatch):
    """Encrypt without LLM_KEY_ENCRYPTION_KEY raises."""
    monkeypatch.delenv("LLM_KEY_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("LLM_KEY_ENCRYPTION_KEY", "")

    from llm_keys_encryption import encrypt_llm_keys

    with pytest.raises(ValueError, match="LLM_KEY_ENCRYPTION_KEY"):
        encrypt_llm_keys({"x": "y"})
