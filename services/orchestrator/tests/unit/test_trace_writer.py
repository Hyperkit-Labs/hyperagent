"""Unit tests: trace writer. Stub rejected in production."""

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


def test_stub_trace_id_format():
    from trace_writer import _stub_trace_id

    bid = _stub_trace_id("run-1", "audit", 2)
    assert bid.startswith("stub:")
    assert "run-1" in bid
    assert "audit" in bid
    assert "2" in bid


@pytest.mark.asyncio
async def test_write_trace_production_stub_raises(monkeypatch):
    """In production, stub blob_id raises RuntimeError."""
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

    # When IPFS not configured, blob_id is stub -> raises in production
    with pytest.raises(RuntimeError, match="stub|IPFS|Verifiable|mandatory"):
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


def test_write_trace_sync_dev_returns_stub_on_inner_failure(monkeypatch):
    """Non-production may return stub when the async path fails."""
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("ENV", raising=False)
    import importlib

    import trace_writer as m

    importlib.reload(m)
    assert m.IS_PRODUCTION is False

    async def _boom(*_a, **_k):
        raise ValueError("simulated trace failure")

    monkeypatch.setattr(m, "write_trace", _boom)

    blob_id, da_cert, ref = m.write_trace_sync("run-1", "codegen", 0, "completed", "ok", None)
    assert blob_id is not None
    assert str(blob_id).startswith("stub:")
    assert da_cert is None
    assert ref is None
