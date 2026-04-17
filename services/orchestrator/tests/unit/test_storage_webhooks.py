"""Unit tests for Pinata webhook signature verification."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_pinata_signature_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PINATA_WEBHOOK_SECRET", "testsecret")
    from webhook_utils import verify_hmac_sha256

    body = b'{"type":"pinning","data":{"cid":"QmX"}}'
    digest = hmac.new(b"testsecret", body, hashlib.sha256).hexdigest()
    assert verify_hmac_sha256(body, digest, "testsecret") is True
    assert verify_hmac_sha256(body, f"sha256={digest}", "testsecret") is True
    assert verify_hmac_sha256(body, "deadbeef", "testsecret") is False


def test_extract_cid() -> None:
    from api.storage_webhooks import _extract_cid

    assert _extract_cid({"cid": "QmTestCidHashNine"}) == "QmTestCidHashNine"
    assert (
        _extract_cid({"data": {"cid": "bafybeiTest123456789"}})
        == "bafybeiTest123456789"
    )
