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
    assert all(a["status"] == "idle" for a in j["agents"])


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
    assert r.status_code in (200, 204, 404, 503)
    if r.status_code == 200:
        j = r.json()
        assert "status" in j or "ok" in str(j).lower()


def test_health_live(client):
    r = client.get("/health/live")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


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


def test_metrics_rejects_invalid_time_range(client):
    r = client.get("/api/v1/metrics?time_range=1d")
    assert r.status_code == 422


def test_domains_list(client, monkeypatch):
    import api.infra as infra_api

    monkeypatch.setattr(infra_api.db, "is_configured", lambda: True)
    monkeypatch.setattr(
        infra_api.db,
        "list_custom_domains_for_wallet",
        lambda wallet_user_id, limit=100: [
            {
                "id": "dom-1",
                "domain": "example.com",
                "status": "pending",
                "created_at": "2026-04-26T00:00:00Z",
            }
        ],
    )

    r = client.get("/api/v1/infra/domains", headers={"X-User-Id": "user-123"})
    assert r.status_code == 200
    assert r.json()[0]["domain"] == "example.com"


def test_add_domain_validates_input(client, monkeypatch):
    import api.infra as infra_api

    monkeypatch.setattr(infra_api.db, "is_configured", lambda: True)
    r = client.post(
        "/api/v1/infra/domains",
        headers={"X-User-Id": "user-123"},
        json={"domain": "https://bad.example"},
    )
    assert r.status_code == 400
    assert "hostname" in r.json()["detail"]
