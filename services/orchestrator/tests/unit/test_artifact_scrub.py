"""Unit tests for IPFS artifact scrubbing before Pinata."""

from __future__ import annotations

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_scrub_redacts_sensitive_key_names() -> None:
    from security.artifact_scrub import scrub_for_ipfs

    d = scrub_for_ipfs(
        {"name": "x", "api_key": "secret", "nested": {"password": "p"}}
    )
    assert d["api_key"] == "[redacted]"
    assert d["nested"]["password"] == "[redacted]"
    assert d["name"] == "x"


def test_scrub_redacts_token_like_strings() -> None:
    from security.artifact_scrub import scrub_for_ipfs

    out = scrub_for_ipfs(
        {"t": "prefix sk-abcdefghijklmnopqrst suffix"}
    )
    assert "sk-abc" not in out["t"]
    assert "redacted" in out["t"].lower()


def test_assert_safe_accepts_clean_payload() -> None:
    from security.artifact_scrub import assert_safe_for_ipfs, scrub_for_ipfs

    clean = scrub_for_ipfs({"note": "hello world"})
    assert_safe_for_ipfs(clean)
