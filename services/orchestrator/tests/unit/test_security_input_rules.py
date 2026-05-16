"""Security-oriented API rules: malformed input must not yield 5xx for typical fuzz."""

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


def _detail_messages(response) -> list[str]:
    detail = response.json()["detail"]
    if isinstance(detail, str):
        return [detail]
    return [item.get("msg", "") for item in detail if isinstance(item, dict)]


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("IDENTITY_HMAC_SECRET", IDENTITY_SECRET)
    monkeypatch.setenv("ENFORCE_IDENTITY_HMAC", "1")
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


def test_workflows_list_status_injection_string(client):
    """SQL-like fragments in query must not crash the handler."""
    r = client.get(
        "/api/v1/workflows",
        params={"status": "'; DROP TABLE workflows;--"},
    )
    assert r.status_code == 422
    assert any("status must be one of" in msg for msg in _detail_messages(r))


def test_workflows_list_extreme_limit(client):
    r = client.get("/api/v1/workflows", params={"limit": "999999999"})
    assert r.status_code == 422


def test_workflows_list_rejects_invalid_status(client):
    r = client.get("/api/v1/workflows", params={"status": "dropped_table"})
    assert r.status_code == 422
    assert any("status must be one of" in msg for msg in _detail_messages(r))


def test_workflow_path_param_rejects_unsafe_id(client):
    r = client.get("/api/v1/workflows/bad%20id")
    assert r.status_code == 422
    assert "workflow_id must contain only" in r.json()["detail"]


def test_logs_reject_invalid_pagination(client):
    r = client.get("/api/v1/logs", params={"page": "0", "page_size": "500"})
    assert r.status_code == 422


def test_logs_reject_unknown_query_key(client):
    r = client.get("/api/v1/logs", params={"unknown": "1"})
    assert r.status_code == 422
    assert "Unsupported query parameter" in _detail_messages(r)


def test_llm_keys_reject_unknown_query_key(client):
    r = client.get("/api/v1/workspaces/current/llm-keys", params={"foo": "bar"})
    assert r.status_code == 422
    assert "Unsupported query parameter" in _detail_messages(r)


def test_networks_reject_invalid_boolean_query(client):
    r = client.get("/api/v1/networks", params={"skale": "maybe"})
    assert r.status_code == 422
    assert any("skale must be one of" in msg for msg in _detail_messages(r))


def test_payments_history_rejects_invalid_offset(client):
    r = client.get(
        "/api/v1/payments/history",
        params={"offset": "-1"},
        headers=_signed_user_headers("user-123"),
    )
    assert r.status_code == 422


def test_domains_reject_invalid_limit(client):
    r = client.get(
        "/api/v1/infra/domains",
        params={"limit": "0"},
        headers=_signed_user_headers("user-123"),
    )
    assert r.status_code == 422


def test_openapi_json_is_object(client):
    """OpenAPI document remains loadable (contract for gateways and codegen)."""
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert data.get("openapi") or data.get("swagger")
    assert "paths" in data
