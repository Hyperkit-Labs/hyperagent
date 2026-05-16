"""GatewayProxyBoundaryMiddleware: non-public production traffic must come via gateway."""

from __future__ import annotations

import importlib
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def _client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "service-secret")

    import api.gateway_proxy_middleware as gpm

    importlib.reload(gpm)
    from api.gateway_proxy_middleware import GatewayProxyBoundaryMiddleware

    app = FastAPI()
    app.add_middleware(GatewayProxyBoundaryMiddleware)

    @app.get("/api/v1/workflows")
    def _wf():
        return {"ok": True}

    @app.get("/api/v1/config")
    def _cfg():
        return {"ok": True}

    return TestClient(app)


def test_rejects_direct_non_public_request_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(monkeypatch)
    r = client.get("/api/v1/workflows")
    assert r.status_code == 403
    assert r.json().get("code") == "GATEWAY_PROXY_REQUIRED"


def test_accepts_gateway_marked_request_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(monkeypatch)
    r = client.get(
        "/api/v1/workflows",
        headers={"X-Gateway-Proxy": "1", "X-Internal-Token": "service-secret"},
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_public_path_skips_gateway_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(monkeypatch)
    r = client.get("/api/v1/config")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_rejects_invalid_internal_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(monkeypatch)
    r = client.get("/api/v1/workflows", headers={"X-Internal-Token": "wrong"})
    assert r.status_code == 403
    assert r.json().get("code") == "GATEWAY_PROXY_REQUIRED"
    assert r.json().get("gateway_proxy_seen") is False


def test_rejects_gateway_marker_without_internal_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(monkeypatch)
    r = client.get("/api/v1/workflows", headers={"X-Gateway-Proxy": "1"})
    assert r.status_code == 403
    assert r.json().get("code") == "GATEWAY_PROXY_REQUIRED"
    assert r.json().get("gateway_proxy_seen") is True


def test_accepts_valid_internal_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client(monkeypatch)
    r = client.get("/api/v1/workflows", headers={"X-Internal-Token": "service-secret"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
