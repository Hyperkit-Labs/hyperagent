"""Regression tests for inbound webhook routes mounted in the orchestrator app."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


@pytest.mark.parametrize(
    ("path", "payload", "expected_status"),
    [
        ("/api/v1/x402/settlement", {}, 400),
        ("/api/v1/simulation/webhooks/tenderly", {}, 400),
        ("/api/v1/storage/webhooks/pinata", {}, 200),
    ],
)
def test_inbound_webhook_routes_are_mounted(
    client,
    path: str,
    payload: dict[str, object],
    expected_status: int,
) -> None:
    response = client.post(path, json=payload)

    assert response.status_code == expected_status
    assert response.status_code != 404
