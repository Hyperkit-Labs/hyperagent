"""Unit tests for registries module."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_get_requires_exploit_sim_erc20():
    from registries import get_requires_exploit_sim

    assert get_requires_exploit_sim("erc20") is False
    assert get_requires_exploit_sim("erc721") is False
    assert get_requires_exploit_sim("nft") is False


def test_get_requires_exploit_sim_dex():
    from registries import get_requires_exploit_sim

    assert get_requires_exploit_sim("dex") is True
    assert get_requires_exploit_sim("lending") is True
    assert get_requires_exploit_sim("vault") is True


def test_get_default_pipeline_id():
    from registries import get_default_pipeline_id

    pid = get_default_pipeline_id()
    assert isinstance(pid, str)
    assert len(pid) > 0


def test_get_timeout_returns_float():
    from registries import get_timeout

    t = get_timeout("spec")
    assert isinstance(t, (int, float))
    assert t > 0
