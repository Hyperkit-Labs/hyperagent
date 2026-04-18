"""Regression tests for SKALE simulation fallback when Tenderly is unavailable."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.mark.asyncio
async def test_skale_simulation_uses_rpc_fallback_when_tenderly_is_unavailable() -> (
    None
):
    import agents.simulation_agent as simulation_agent

    deployments = [
        {
            "chain_id": 1187947933,
            "contract_name": "ExampleToken",
            "plan": {
                "bytecode": "0x6080604052348015600f57600080fd5b50",
                "chainId": 1187947933,
            },
        }
    ]
    fallback_result = {
        "success": True,
        "gasUsed": 210000,
        "rpc_simulated": True,
        "note": "RPC fallback",
    }

    with patch.object(
        simulation_agent,
        "get_simulation_provider",
    ) as mock_provider_factory, patch.object(
        simulation_agent,
        "_simulate_via_rpc",
        new=AsyncMock(return_value=fallback_result),
    ) as mock_rpc_fallback:
        mock_provider_factory.return_value.simulate = AsyncMock(
            return_value={
                "success": False,
                "error": "Tenderly not configured",
                "gasUsed": 0,
            }
        )

        result = await simulation_agent.run_tenderly_simulations(
            contracts={},
            spec={},
            chains=[1187947933],
            deployments=deployments,
            run_id="",
        )

    mock_rpc_fallback.assert_awaited_once_with(
        1187947933,
        "0x6080604052348015600f57600080fd5b50",
    )
    assert result["passed"] is True
    assert result["simulations"] == [
        {
            "success": True,
            "gasUsed": 210000,
            "chain_id": 1187947933,
            "contract_name": "ExampleToken",
            "rpc_simulated": True,
            "note": "RPC fallback",
        }
    ]
