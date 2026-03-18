"""Integration tests: orchestrator HTTP API. Run from services/orchestrator with pytest."""

from __future__ import annotations

import os
import sys

import pytest

# Run from services/orchestrator so imports resolve
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


def test_config_public(client):
    r = client.get("/api/v1/config")
    assert r.status_code == 200
    j = r.json()
    assert "x402_enabled" in j
    assert "monitoring_enabled" in j


def test_agents_list(client):
    r = client.get("/api/v1/agents")
    assert r.status_code == 200
    j = r.json()
    assert "agents" in j
    assert isinstance(j["agents"], list)
    names = [a["name"] for a in j["agents"]]
    assert "spec" in names
    assert "codegen" in names


def test_networks(client):
    r = client.get("/api/v1/networks")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_blueprints_from_registry(client):
    r = client.get("/api/v1/blueprints")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_health(client):
    r = client.get("/health")
    assert r.status_code in (200, 204, 404)
    if r.status_code == 200:
        j = r.json()
        assert "status" in j or "ok" in str(j).lower()


def test_workflows_list_accepts_x_user_id(client):
    """X-User-Id header is accepted; list returns 200."""
    r = client.get("/api/v1/workflows", headers={"X-User-Id": "test-user-123"})
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j
    assert isinstance(j["workflows"], list)


def test_workflows_list_without_auth(client):
    """List without X-User-Id returns 200 (anonymous allowed)."""
    r = client.get("/api/v1/workflows")
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j
