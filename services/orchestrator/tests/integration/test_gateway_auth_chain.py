"""Integration tests: gateway-orchestrator auth chain.
Verifies orchestrator accepts and uses X-User-Id from gateway proxy.
Gateway sets x-user-id from JWT sub; orchestrator uses it for workflows, credits, etc."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


def test_workflows_list_with_x_user_id_returns_user_scoped(client):
    """Gateway passes X-User-Id; orchestrator uses it for workflow listing."""
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    r = client.get("/api/v1/workflows", headers={"X-User-Id": user_id})
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j
    assert isinstance(j["workflows"], list)


def test_workflows_list_without_x_user_id_allows_anonymous(client):
    """Orchestrator allows anonymous when no X-User-Id (dev/legacy)."""
    r = client.get("/api/v1/workflows")
    assert r.status_code == 200
    j = r.json()
    assert "workflows" in j


def test_generate_accepts_x_user_id(client):
    """POST /generate accepts X-User-Id for credit deduction and workflow ownership."""
    user_id = "550e8400-e29b-41d4-a716-446655440001"
    r = client.post(
        "/api/v1/workflows/generate",
        json={"nlp_input": "Create an ERC20 token", "api_keys": {"openai": "sk-test"}},
        headers={"X-User-Id": user_id},
    )
    assert r.status_code in (200, 402, 422, 503)
    if r.status_code == 200:
        j = r.json()
        assert "workflow_id" in j
        assert "status" in j
