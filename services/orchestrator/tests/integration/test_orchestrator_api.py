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


# ---------------------------------------------------------------------------
# Gateway -> orchestrator auth chain: X-User-Id propagation, JWT flow
# ---------------------------------------------------------------------------


def test_workflows_generate_accepts_x_user_id(client):
    """When X-User-Id is present (as set by gateway from JWT sub), generate accepts it."""
    r = client.post(
        "/api/v1/workflows/generate",
        json={
            "nlp_input": "Create a simple ERC20 token",
            "api_keys": {"openai": "sk-test-placeholder"},
        },
        headers={"X-User-Id": "test-user-uuid-auth-chain"},
    )
    assert r.status_code == 200
    j = r.json()
    assert "workflow_id" in j
    assert "status" in j
    assert j["status"] == "running"


def test_workflows_list_scoped_by_x_user_id(client):
    """List workflows returns only those owned by X-User-Id when present."""
    r = client.get("/api/v1/workflows", headers={"X-User-Id": "test-user-uuid-auth-chain"})
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j
    for w in j["workflows"]:
        uid = w.get("user_id") or w.get("wallet_user_id") or "anonymous"
        assert uid in ("test-user-uuid-auth-chain", "anonymous")


def test_workflow_get_requires_owner(client):
    """Getting a workflow owned by another user returns 403 when X-User-Id is different."""
    r = client.post(
        "/api/v1/workflows/generate",
        json={
            "nlp_input": "Create ERC20",
            "api_keys": {"openai": "sk-test"},
        },
        headers={"X-User-Id": "owner-user-123"},
    )
    assert r.status_code == 200
    wf_id = r.json()["workflow_id"]

    r2 = client.get(f"/api/v1/workflows/{wf_id}", headers={"X-User-Id": "other-user-456"})
    assert r2.status_code == 403
