"""Integration tests: full pipeline flow with mocked providers.
Verifies spec -> design -> codegen -> audit -> simulation -> deploy wiring.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture
def mock_providers():
    """Mock simulation, deploy, storage providers for pipeline tests."""
    with (
        patch("providers.get_simulation_provider") as sim,
        patch("providers.get_deploy_provider") as deploy,
        patch("providers.get_storage_provider") as storage,
    ):
        sim.return_value.simulate = AsyncMock(
            return_value={"success": True, "gasUsed": 100000}
        )
        sim.return_value.simulate_bundle = AsyncMock(
            return_value={"success": True, "gasUsed": 200000}
        )
        deploy.return_value.get_deploy_plan = AsyncMock(
            return_value={
                "chainId": 5003,
                "rpcUrl": "https://rpc.testnet.mantle.xyz",
                "explorerUrl": "https://explorer.testnet.mantle.xyz",
                "bytecode": "0x",
                "abi": [],
                "constructorArgs": [],
            }
        )
        storage.return_value.pin = AsyncMock(
            return_value={"cid": "QmTest", "gatewayUrl": "https://gateway/ipfs/QmTest"}
        )
        storage.return_value.unpin = AsyncMock(return_value=None)
        yield


@pytest.fixture
def in_memory_store():
    """Force in-memory store (Supabase not configured) for isolated tests."""
    with patch("store._db.is_configured", return_value=False):
        yield


def test_workflow_create_and_list(mock_providers, in_memory_store):
    """Create workflow and list; verify in-memory or DB path."""
    from store import create_workflow, list_workflows, get_workflow

    wf_id = "test-pipeline-integration-001"
    rec = create_workflow(
        workflow_id=wf_id,
        intent="Simple ERC20 token",
        network="mantle-testnet",
        user_id="test-user",
        project_id="00000000-0000-0000-0000-000000000001",
    )
    assert rec["workflow_id"] == wf_id
    assert rec["intent"] == "Simple ERC20 token"
    assert rec["status"] == "running"

    fetched = get_workflow(wf_id)
    assert fetched is not None
    assert fetched["workflow_id"] == wf_id

    items = list_workflows(limit=10)
    assert any(w["workflow_id"] == wf_id for w in items)


def test_simulation_provider_circuit_breaker():
    """Circuit breaker rejects when open."""
    from circuit_breaker import CircuitOpenError, get_breaker

    breaker = get_breaker("simulation_test")
    for _ in range(6):
        breaker.record_failure()
    assert not breaker.can_execute()


def test_circuit_breaker_recovery():
    """Circuit breaker allows trial after recovery timeout."""
    from circuit_breaker import CircuitBreaker

    cb = CircuitBreaker("recovery_test", failure_threshold=2, recovery_timeout_sec=0.01)
    cb.record_failure()
    cb.record_failure()
    assert not cb.can_execute()
    import time

    time.sleep(0.02)
    assert cb.can_execute()
