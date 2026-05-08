"""Integration tests: orchestrator HTTP API. Run from services/orchestrator with pytest."""

from __future__ import annotations

import hashlib
import hmac
import os
import sys

import pytest

# Run from services/orchestrator so imports resolve
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

IDENTITY_SECRET = "unit-test-secret"


def _signed_user_headers(user_id: str) -> dict[str, str]:
    sig = hmac.new(
        IDENTITY_SECRET.encode(), user_id.encode(), hashlib.sha256
    ).hexdigest()
    return {"X-User-Id": user_id, "x-user-id-sig": f"{user_id}.{sig}"}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IDENTITY_HMAC_SECRET", IDENTITY_SECRET)
    monkeypatch.setenv("ENFORCE_IDENTITY_HMAC", "1")
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
    r = client.get(
        "/api/v1/workflows",
        headers=_signed_user_headers("test-user-123"),
        params={"limit": "10"},
    )
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j
    assert isinstance(j["workflows"], list)


def test_workflows_list_without_auth(client):
    """List without X-User-Id returns 200 (anonymous allowed)."""
    r = client.get("/api/v1/workflows", params={"limit": "1"})
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j


def test_llm_keys_read_with_user_header(client):
    r = client.get(
        "/api/v1/workspaces/current/llm-keys",
        headers=_signed_user_headers("test-user-123"),
    )
    assert r.status_code == 200
    body = r.json()
    assert "configured_providers" in body
    assert isinstance(body["configured_providers"], list)


def test_logs_routes_return_real_payloads(client, monkeypatch):
    import api.runs_registry as runs_registry_api

    monkeypatch.setattr(
        runs_registry_api.db,
        "get_recent_activity_logs",
        lambda limit=100: [
            {
                "service": "orchestrator",
                "message": "workflow queued",
                "timestamp": "2026-05-08T00:00:00Z",
            }
        ],
    )

    logs = client.get("/api/v1/logs", params={"page": "1", "page_size": "5"})
    assert logs.status_code == 200
    assert logs.json()["page_size"] == 5
    assert isinstance(logs.json()["logs"], list)

    services = client.get("/api/v1/logs/services")
    assert services.status_code == 200
    assert services.json() == ["orchestrator"]

    hosts = client.get("/api/v1/logs/hosts")
    assert hosts.status_code == 200
    assert hosts.json() == ["orchestrator"]


def test_logs_routes_fail_explicitly_when_backend_unavailable(client, monkeypatch):
    import api.runs_registry as runs_registry_api

    def _boom(limit=100):
        raise RuntimeError("db unavailable")

    monkeypatch.setattr(runs_registry_api.db, "get_recent_activity_logs", _boom)

    logs = client.get("/api/v1/logs")
    assert logs.status_code == 503
    assert logs.json()["detail"] == "activity logs unavailable"

    services = client.get("/api/v1/logs/services")
    assert services.status_code == 503
    assert services.json()["detail"] == "activity log services unavailable"

    hosts = client.get("/api/v1/logs/hosts")
    assert hosts.status_code == 503
    assert hosts.json()["detail"] == "activity log hosts unavailable"


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

    r = client.get(
        "/api/v1/infra/domains",
        headers=_signed_user_headers("user-123"),
    )
    assert r.status_code == 200
    assert r.json()[0]["domain"] == "example.com"


def test_add_domain_validates_input(client, monkeypatch):
    import api.infra as infra_api

    monkeypatch.setattr(infra_api.db, "is_configured", lambda: True)
    r = client.post(
        "/api/v1/infra/domains",
        headers=_signed_user_headers("user-123"),
        json={"domain": "https://bad.example"},
    )
    assert r.status_code == 400
    assert "hostname" in r.json()["detail"]
