"""Unit tests: trace writer. Production requires persisted traces."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ),
)


def test_build_trace_payload():
    from trace_writer import build_trace_payload

    payload = build_trace_payload("run-1", "codegen", 0, "completed", "ok", None)
    assert payload["run_id"] == "run-1"
    assert payload["step_type"] == "codegen"
    assert payload["step_index"] == 0
    assert payload["status"] == "completed"
    assert payload["output_summary"] == "ok"


@pytest.mark.asyncio
async def test_write_trace_production_without_storage_raises(monkeypatch):
    """In production, missing trace persistence raises RuntimeError."""
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EIGENDA_ENABLED", "0")
    monkeypatch.delenv("EIGENDA_PRIVATE_KEY", raising=False)
    import importlib

    import da_client
    import trace_writer as m

    importlib.reload(da_client)
    importlib.reload(m)

    if not m.IS_PRODUCTION:
        pytest.skip("IS_PRODUCTION false; set NODE_ENV=production")

    with pytest.raises(RuntimeError, match="IPFS|Verifiable|mandatory"):
        await m.write_trace("run-1", "codegen", 0, "completed", "ok", None)


def test_write_trace_sync_production_inner_failure_raises(monkeypatch):
    """Production must not fall back to stub when sync wrapper hits an error."""
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EIGENDA_ENABLED", "0")
    monkeypatch.delenv("EIGENDA_PRIVATE_KEY", raising=False)
    import importlib

    import da_client
    import trace_writer as m

    importlib.reload(da_client)
    importlib.reload(m)

    if not m.IS_PRODUCTION:
        pytest.skip("IS_PRODUCTION false")

    async def _boom(*_a, **_k):
        raise ValueError("simulated trace failure")

    monkeypatch.setattr(m, "write_trace", _boom)

    with pytest.raises(RuntimeError, match="Stub traces are not allowed"):
        m.write_trace_sync("run-1", "codegen", 0, "completed", "ok", None)


def test_write_trace_sync_dev_returns_empty_trace_on_inner_failure(monkeypatch):
    """Non-production may return an empty trace when the async path fails."""
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("ENV", raising=False)
    import importlib

    import trace_writer as m

    importlib.reload(m)
    assert m.IS_PRODUCTION is False

    async def _boom(*_a, **_k):
        raise ValueError("simulated trace failure")

    monkeypatch.setattr(m, "write_trace", _boom)

    blob_id, da_cert, ref = m.write_trace_sync(
        "run-1", "codegen", 0, "completed", "ok", None
    )
    assert blob_id is None
    assert da_cert is None
    assert ref is None
