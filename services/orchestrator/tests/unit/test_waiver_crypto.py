"""Unit tests for waiver evidence HMAC and canonical JSON."""

from __future__ import annotations

import hashlib
import hmac
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from security.waiver_crypto import canonical_json_bytes, payload_sha256, verify_hmac_sha256


def test_canonical_json_ordering_stable():
    a = {"z": 1, "a": 2}
    b = {"a": 2, "z": 1}
    assert canonical_json_bytes(a) == canonical_json_bytes(b)


def test_payload_sha256_matches_direct_sha256():
    obj = {"run_id": "r1", "finding_id": "f1"}
    expected = hashlib.sha256(canonical_json_bytes(obj)).hexdigest()
    assert payload_sha256(obj) == expected


def test_verify_hmac_accepts_valid_signature():
    secret = "test-secret-key"
    payload = {"a": 1, "b": "x"}
    sig = hmac.new(
        secret.encode("utf-8"),
        canonical_json_bytes(payload),
        hashlib.sha256,
    ).hexdigest()
    assert verify_hmac_sha256(secret, payload, sig) is True


def test_verify_hmac_rejects_wrong_secret_or_tamper():
    secret = "s1"
    payload = {"k": "v"}
    sig = hmac.new(
        secret.encode("utf-8"),
        canonical_json_bytes(payload),
        hashlib.sha256,
    ).hexdigest()
    assert verify_hmac_sha256("other", payload, sig) is False
    assert verify_hmac_sha256(secret, {**payload, "extra": 1}, sig) is False
    assert verify_hmac_sha256("", payload, sig) is False
    assert verify_hmac_sha256(secret, payload, "") is False
