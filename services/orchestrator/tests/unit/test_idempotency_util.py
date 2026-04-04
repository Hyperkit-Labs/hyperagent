"""Tests for idempotency_util."""

from idempotency_util import (
    composite_idempotency_key,
    normalize_idempotency_key,
    redis_dedupe_key,
)


def test_normalize_empty() -> None:
    assert normalize_idempotency_key(None) is None
    assert normalize_idempotency_key("") is None
    assert normalize_idempotency_key("   ") is None


def test_normalize_safe_passthrough() -> None:
    assert normalize_idempotency_key("run-abc_1.x") == "run-abc_1.x"


def test_normalize_hashes_long() -> None:
    long_key = "x" * 300
    out = normalize_idempotency_key(long_key)
    assert out is not None
    assert len(out) == 64


def test_composite() -> None:
    assert composite_idempotency_key("user-1", "k") == "user-1:k"
    assert composite_idempotency_key("", "k") == "k"


def test_redis_dedupe_key() -> None:
    assert redis_dedupe_key("pay", "u1:abc") == "idempotency:pay:u1:abc"
