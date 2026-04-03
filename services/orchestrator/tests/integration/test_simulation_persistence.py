"""Integration: Orchestrator triggers simulation and persists the result path."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture
def mock_sim_provider():
    with patch("providers.get_simulation_provider") as m:
        prov = m.return_value
        prov.simulate = AsyncMock(return_value={"success": True, "gasUsed": 150000})
        prov.simulate_bundle = AsyncMock(
            return_value={"success": True, "gasUsed": 200000}
        )
        yield m


@pytest.fixture
def in_memory_store():
    with patch("store._db.is_configured", return_value=False):
        yield


@pytest.mark.asyncio
async def test_simulation_agent_persists_result(mock_sim_provider, in_memory_store):
    """Simulation agent runs, returns passed, and result shape is correct."""
    from agents.simulation_agent import run_tenderly_simulations

    deployments = [
        {
            "chain_id": 5003,
            "plan": {
                "bytecode": "0x608060405234801561001057600080fd5b50",
                "chainId": 5003,
            },
        }
    ]
    result = await run_tenderly_simulations(
        contracts={},
        spec={},
        chains=[5003],
        deployments=deployments,
        run_id="test-sim-persist-001",
    )
    assert result["passed"] is True
    assert "simulations" in result
    assert len(result["simulations"]) == 1
    sim = result["simulations"][0]
    assert sim.get("success") is True
    assert sim.get("gasUsed") == 150000
    assert sim.get("chain_id") == 5003
