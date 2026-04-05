"""Unit tests for canonical_env (single parse path for service URLs)."""

from __future__ import annotations

import pytest

import canonical_env as ce


def test_parse_bool():
    assert ce.parse_bool(None) is False
    assert ce.parse_bool("") is False
    assert ce.parse_bool("1") is True
    assert ce.parse_bool("true") is True
    assert ce.parse_bool("FALSE") is False
    assert ce.parse_bool("maybe", default=True) is True
    assert ce.parse_bool("maybe", default=False) is False


def test_get_service_url_dev_default(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("ORCHESTRATOR_URL", raising=False)
    assert ce.get_service_url("orchestrator") == "http://localhost:8000"


def test_get_service_url_explicit(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ORCHESTRATOR_URL", "https://orch.example/api")
    monkeypatch.delenv("NODE_ENV", raising=False)
    assert ce.get_service_url("orchestrator") == "https://orch.example/api"


def test_get_service_url_production_requires_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.delenv("ORCHESTRATOR_URL", raising=False)
    with pytest.raises(RuntimeError, match="ORCHESTRATOR_URL"):
        ce.get_service_url("orchestrator")
