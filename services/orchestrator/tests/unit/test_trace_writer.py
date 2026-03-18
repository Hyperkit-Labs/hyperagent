"""Unit tests: trace writer. Stub rejected in production."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


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
    import importlib
    import trace_writer as m
    importlib.reload(m)

    if not m.IS_PRODUCTION:
        pytest.skip("IS_PRODUCTION false; set NODE_ENV=production")

    # When IPFS not configured, blob_id is stub -> raises in production
    with pytest.raises(RuntimeError, match="stub|IPFS|Verifiable|mandatory"):
        await m.write_trace("run-1", "codegen", 0, "completed", "ok", None)
