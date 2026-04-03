"""Unit tests for IPFS gateway policy helpers."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_canonical_ipfs_gateway_url_default_domain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PINATA_GATEWAY_BASE", raising=False)
    monkeypatch.setenv("PINATA_GATEWAY_DOMAIN", "gateway.pinata.cloud")
    from ipfs_client import canonical_ipfs_gateway_url

    assert canonical_ipfs_gateway_url("QmX") == "https://gateway.pinata.cloud/ipfs/QmX"


def test_canonical_ipfs_gateway_url_custom_base(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PINATA_GATEWAY_BASE", "https://my.pinata.cloud/ipfs")
    from ipfs_client import canonical_ipfs_gateway_url

    assert canonical_ipfs_gateway_url("QmY") == "https://my.pinata.cloud/ipfs/QmY"
