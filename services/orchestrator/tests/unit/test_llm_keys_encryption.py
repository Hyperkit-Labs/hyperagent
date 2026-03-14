"""Unit tests for llm_keys_encryption (Fernet path)."""

from __future__ import annotations

import os
import sys

import pytest
from cryptography.fernet import Fernet

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture(autouse=True)
def _fernet_env(monkeypatch):
    key = Fernet.generate_key().decode("ascii")
    monkeypatch.setenv("LLM_KEY_ENCRYPTION_KEY", key)
    monkeypatch.delenv("LLM_KEY_KMS_KEY_ARN", raising=False)


def test_encrypt_decrypt_roundtrip():
    from llm_keys_encryption import decrypt_llm_keys, encrypt_llm_keys

    raw = {"openai": "sk-test", "anthropic": "sk-ant-test"}
    ct = encrypt_llm_keys(raw)
    assert isinstance(ct, str)
    assert len(ct) > 0
    dec = decrypt_llm_keys(ct)
    assert dec == raw


def test_encrypt_empty_dict():
    from llm_keys_encryption import decrypt_llm_keys, encrypt_llm_keys

    ct = encrypt_llm_keys({})
    dec = decrypt_llm_keys(ct)
    assert dec == {}


def test_decrypt_invalid_raises():
    from llm_keys_encryption import decrypt_llm_keys

    with pytest.raises(Exception):
        decrypt_llm_keys("not-valid-fernet-token")


def test_encrypt_requires_key(monkeypatch):
    monkeypatch.delenv("LLM_KEY_ENCRYPTION_KEY", raising=False)
    from llm_keys_encryption import encrypt_llm_keys

    with pytest.raises(ValueError, match="LLM_KEY_ENCRYPTION_KEY"):
        encrypt_llm_keys({"x": "y"})
