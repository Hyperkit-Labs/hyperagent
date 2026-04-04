"""SpoofedIdentityMiddleware: reject unsigned X-User-Id when enforcement is on."""

from __future__ import annotations

import hashlib
import hmac
import importlib
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def _user_id_sig(user_id: str, secret: str) -> str:
    sig = hmac.new(secret.encode(), user_id.encode(), hashlib.sha256).hexdigest()
    return f"{user_id}.{sig}"


def _client_with_middleware(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("IDENTITY_HMAC_SECRET", "unit-test-secret")
    monkeypatch.setenv("ENFORCE_IDENTITY_HMAC", "1")

    import api.common as common
    import api.spoofed_identity_middleware as sim

    importlib.reload(common)
    importlib.reload(sim)

    from api.spoofed_identity_middleware import SpoofedIdentityMiddleware

    app = FastAPI()
    app.add_middleware(SpoofedIdentityMiddleware)

    @app.get("/api/v1/workflows")
    def _wf():
        return {"ok": True}

    return TestClient(app)


def test_rejects_x_user_id_without_signature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client_with_middleware(monkeypatch)
    uid = "550e8400-e29b-41d4-a716-446655440000"
    r = client.get("/api/v1/workflows", headers={"X-User-Id": uid})
    assert r.status_code == 401
    body = r.json()
    assert body.get("code") == "IDENTITY_SIGNATURE_REQUIRED"


def test_accepts_x_user_id_with_valid_hmac(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client_with_middleware(monkeypatch)
    uid = "550e8400-e29b-41d4-a716-446655440000"
    sig = _user_id_sig(uid, "unit-test-secret")
    r = client.get(
        "/api/v1/workflows",
        headers={"X-User-Id": uid, "x-user-id-sig": sig},
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_no_user_header_skips_middleware(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _client_with_middleware(monkeypatch)
    r = client.get("/api/v1/workflows")
    assert r.status_code == 200
