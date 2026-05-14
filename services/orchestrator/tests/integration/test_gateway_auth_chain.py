"""Integration tests: gateway-orchestrator auth chain.
Verifies orchestrator accepts signed X-User-Id values from the gateway proxy.
Gateway sets x-user-id from JWT sub and signs it; orchestrator uses it for
workflow ownership and other user-scoped backend actions."""

from __future__ import annotations

import hashlib
import hmac
import os
import sys

import pytest

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


def test_workflows_list_with_x_user_id_returns_user_scoped(client):
    """Gateway passes signed X-User-Id; orchestrator uses it for workflow listing."""
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    r = client.get("/api/v1/workflows", headers=_signed_user_headers(user_id))
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
    """POST /generate accepts signed X-User-Id for ownership and billing context."""
    user_id = "550e8400-e29b-41d4-a716-446655440001"
    r = client.post(
        "/api/v1/workflows/generate",
        json={"nlp_input": "Create an ERC20 token", "api_keys": {"openai": "sk-test"}},
        headers=_signed_user_headers(user_id),
    )
    assert r.status_code in (200, 402, 422, 503)
    if r.status_code == 200:
        j = r.json()
        assert "workflow_id" in j
        assert "status" in j
