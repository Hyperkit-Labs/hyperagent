"""HTTP behavior for agent-registry + A2A endpoints (mocked store + db)."""

from __future__ import annotations

import os
import sys
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

AGENT_ID = str(uuid.uuid4())
TASK_ID = str(uuid.uuid4())


@pytest.fixture
def client():
    from api.agent_lifecycle import a2a_router, erc8004_router, registry_router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(registry_router)
    app.include_router(a2a_router)
    app.include_router(erc8004_router)
    return TestClient(app)


def test_register_agent_requires_db(client: TestClient) -> None:
    with patch("api.agent_lifecycle.db.is_configured", return_value=False):
        r = client.post(
            "/api/v1/agent-registry/agents",
            json={
                "owner_service": "orchestrator",
                "name": "TestAgent",
                "capabilities": ["deploy"],
                "chain_id": 8453,
            },
        )
    assert r.status_code == 503


def test_register_agent_ok(client: TestClient) -> None:
    row = {
        "id": AGENT_ID,
        "status": "registered",
        "registry_cid": "bafytest",
    }
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        with patch("api.agent_lifecycle.store.insert_registry_agent", return_value=row):
            r = client.post(
                "/api/v1/agent-registry/agents",
                json={
                    "owner_service": "orchestrator",
                    "name": "DeployAgent",
                    "capabilities": ["deploy"],
                    "chain_id": 8453,
                    "metadata": {"version": "1.0.0"},
                },
            )
    assert r.status_code == 200
    data = r.json()
    assert data["agent_id"] == AGENT_ID
    assert data["status"] == "registered"


def test_dispatch_rejects_ineligible_agent(client: TestClient) -> None:
    task = {
        "id": TASK_ID,
        "status": "queued",
        "trace_id": "trace-1",
        "payload_cid": None,
    }
    agent = {
        "id": AGENT_ID,
        "status": "deprecated",
    }
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        with patch("api.agent_lifecycle.store.get_a2a_task", return_value=task):
            with patch(
                "api.agent_lifecycle.store.get_registry_agent", return_value=agent
            ):
                r = client.post(
                    f"/api/v1/a2a/tasks/{TASK_ID}/dispatch",
                    json={"agent_id": AGENT_ID},
                )
    assert r.status_code == 400
    assert "not eligible" in r.json()["detail"].lower()


def test_dispatch_ok(client: TestClient) -> None:
    task = {
        "id": TASK_ID,
        "status": "queued",
        "trace_id": "trace-1",
        "payload_cid": "bafypayload",
    }
    agent = {
        "id": AGENT_ID,
        "status": "registered",
    }
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        with patch("api.agent_lifecycle.store.get_a2a_task", return_value=task):
            with patch(
                "api.agent_lifecycle.store.get_registry_agent", return_value=agent
            ):
                with patch(
                    "api.agent_lifecycle.store.latest_reputation_score",
                    return_value=0.5,
                ):
                    with patch(
                        "api.agent_lifecycle.store.update_a2a_task",
                        return_value=True,
                    ):
                        with patch(
                            "api.agent_lifecycle.store.insert_message",
                            return_value={"id": str(uuid.uuid4())},
                        ):
                            r = client.post(
                                f"/api/v1/a2a/tasks/{TASK_ID}/dispatch",
                                json={"agent_id": AGENT_ID},
                            )
    assert r.status_code == 200
    assert r.json()["status"] == "dispatched"


def test_complete_success_requires_output_cid(client: TestClient) -> None:
    task = {"id": TASK_ID, "status": "acknowledged"}
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        with patch("api.agent_lifecycle.store.get_a2a_task", return_value=task):
            r = client.post(
                f"/api/v1/a2a/tasks/{TASK_ID}/complete",
                json={"success": True, "summary": "ok"},
            )
    assert r.status_code == 400


def test_complete_failure_without_cid(client: TestClient) -> None:
    task = {"id": TASK_ID, "status": "acknowledged"}
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        with patch("api.agent_lifecycle.store.get_a2a_task", return_value=task):
            with patch("api.agent_lifecycle.store.update_a2a_task", return_value=True):
                with patch(
                    "api.agent_lifecycle.store.suppress_nonfinal_outputs_for_failed_task",
                    return_value=True,
                ):
                    with patch(
                        "api.agent_lifecycle.store.mark_messages_responded",
                        return_value=True,
                    ):
                        r = client.post(
                            f"/api/v1/a2a/tasks/{TASK_ID}/complete",
                            json={"success": False, "summary": "bad"},
                        )
    assert r.status_code == 200
    assert r.json()["status"] == "failed"


def test_erc8004_sync_not_implemented(client: TestClient) -> None:
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        r = client.post("/api/v1/erc8004/sync")
    assert r.status_code == 501
    body = r.json()
    assert "detail" in body
    assert "not implemented" in str(body["detail"]).lower()


def test_artifact_rejected_when_task_failed(client: TestClient) -> None:
    task = {"id": TASK_ID, "status": "failed"}
    with patch("api.agent_lifecycle.db.is_configured", return_value=True):
        with patch("api.agent_lifecycle.store.get_a2a_task", return_value=task):
            r = client.post(
                f"/api/v1/a2a/tasks/{TASK_ID}/artifacts",
                json={
                    "artifact_type": "bundle",
                    "cid": "bafyx",
                    "status": "published",
                },
            )
    assert r.status_code == 409
