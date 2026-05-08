"""SpoofedIdentityMiddleware: reject unsigned X-User-Id when enforcement is on."""

from __future__ import annotations

import hashlib
import hmac
import importlib
import os
import sys
from base64 import urlsafe_b64encode

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def _user_id_sig(user_id: str, secret: str) -> str:
    sig = hmac.new(secret.encode(), user_id.encode(), hashlib.sha256).hexdigest()
    return f"{user_id}.{sig}"


def _mint_hs256_jwt(payload: dict[str, str], secret: str) -> str:
    import json

    def _b64(data: bytes) -> str:
        return urlsafe_b64encode(data).decode().rstrip("=")

    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = _b64(json.dumps(header, separators=(",", ":")).encode())
    p_b64 = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{h_b64}.{p_b64}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    s_b64 = _b64(sig)
    return f"{h_b64}.{p_b64}.{s_b64}"


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


def test_invalid_x_user_id_signature_falls_back_to_valid_bearer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Bearer fallback in get_caller_id uses AUTH_JWT_SECRET (not IDENTITY_HMAC_SECRET).
    monkeypatch.setenv("AUTH_JWT_SECRET", "unit-test-secret")
    client = _client_with_middleware(monkeypatch)
    token = _mint_hs256_jwt(
        {"sub": "550e8400-e29b-41d4-a716-446655440000"},
        "unit-test-secret",
    )
    r = client.get(
        "/api/v1/workflows",
        headers={
            "X-User-Id": "spoofed-user-id",
            "authorization": f"Bearer {token}",
        },
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}
