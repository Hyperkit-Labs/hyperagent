"""Unit tests for registries module."""

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


def test_get_x402_enabled_env_override():
    import registries

    os.environ["X402_ENABLED"] = "true"
    try:
        assert registries.get_x402_enabled() is True
    finally:
        os.environ.pop("X402_ENABLED", None)

    os.environ["X402_ENABLED"] = "false"
    try:
        assert registries.get_x402_enabled() is False
    finally:
        os.environ.pop("X402_ENABLED", None)


def test_get_default_pipeline_id():
    import registries

    pid = registries.get_default_pipeline_id()
    assert isinstance(pid, str)
    assert len(pid) > 0


def test_get_registry_versions():
    import registries

    versions = registries.get_registry_versions()
    assert isinstance(versions, dict)


def test_get_default_chain_id():
    import registries

    cid = registries.get_default_chain_id()
    assert isinstance(cid, int)
    assert cid > 0


def test_get_roma_complexity_threshold():
    import registries

    t = registries.get_roma_complexity_threshold()
    assert isinstance(t, int)
    assert t >= 0


def test_get_timeout():
    import registries

    t = registries.get_timeout("codegen")
    assert isinstance(t, (int, float))
    assert t > 0
