"""Contract tests: HTTP responses validate against explicit Pydantic models (API drift guard)."""

from __future__ import annotations

import os
import sys

import pytest
from pydantic import BaseModel, ConfigDict, Field

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


class ConfigResponseContract(BaseModel):
    """GET /api/v1/config — required keys for Studio; extras allowed."""

    model_config = ConfigDict(extra="allow")

    x402_enabled: bool
    monitoring_enabled: bool | None = None


class AgentsResponseContract(BaseModel):
    model_config = ConfigDict(extra="allow")

    agents: list[dict] = Field(default_factory=list)


class WorkflowsListContract(BaseModel):
    model_config = ConfigDict(extra="allow")

    workflows: list[dict] = Field(default_factory=list)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


def test_contract_get_config(client):
    r = client.get("/api/v1/config")
    assert r.status_code == 200
    ConfigResponseContract.model_validate(r.json())


def test_contract_get_agents(client):
    r = client.get("/api/v1/agents")
    assert r.status_code == 200
    AgentsResponseContract.model_validate(r.json())


def test_contract_get_workflows_list(client):
    r = client.get("/api/v1/workflows")
    assert r.status_code == 200
    WorkflowsListContract.model_validate(r.json())
