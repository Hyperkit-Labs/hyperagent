"""Security-oriented API rules: malformed input must not yield 5xx for typical fuzz."""

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


def test_workflows_list_status_injection_string(client):
    """SQL-like fragments in query must not crash the handler."""
    r = client.get(
        "/api/v1/workflows",
        params={"status": "'; DROP TABLE workflows;--"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "workflows" in body


def test_workflows_list_extreme_limit(client):
    r = client.get("/api/v1/workflows", params={"limit": "999999999"})
    assert r.status_code in (200, 422)


def test_openapi_json_is_object(client):
    """OpenAPI document remains loadable (contract for gateways and codegen)."""
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert data.get("openapi") or data.get("swagger")
    assert "paths" in data
