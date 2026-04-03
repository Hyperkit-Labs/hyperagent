"""Integration: Orchestrator writes IPFS-backed trace when Pinata is enabled."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture
def mock_storage_provider():
    with (
        patch("ipfs_client.is_configured", return_value=True),
        patch(
            "ipfs_client.pin_json",
            new_callable=AsyncMock,
            return_value="QmTestTrace123",
        ),
        patch("da_client.is_configured", return_value=False),
    ):
        yield


@pytest.mark.asyncio
async def test_write_trace_returns_cid_when_pinata_enabled(mock_storage_provider):
    """write_trace pins to IPFS and returns real CID when storage configured."""
    from trace_writer import write_trace

    blob_id, da_cert, ref_block = await write_trace(
        run_id="run-ipfs-test",
        step_type="codegen",
        step_index=0,
        status="completed",
        output_summary="ok",
    )
    assert blob_id == "QmTestTrace123"
    assert blob_id.startswith("Qm") or blob_id.startswith("bafy")
