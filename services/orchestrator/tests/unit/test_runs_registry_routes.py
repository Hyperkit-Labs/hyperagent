"""Unit tests for runs registry contract hardening."""

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


def test_step_index_rejects_unknown_step() -> None:
    from node_common import step_index

    with pytest.raises(ValueError, match="Unknown pipeline step"):
        step_index("unknown-step")


def test_has_unverifiable_trace_rejects_legacy_stub_ids() -> None:
    from api.runs_registry import _has_unverifiable_trace

    assert _has_unverifiable_trace([{"trace_blob_id": "stub:run:step:0"}]) is True


@pytest.mark.asyncio
async def test_quick_demo_helper_requires_url(monkeypatch) -> None:
    import api.runs_registry as runs_registry

    monkeypatch.setattr(runs_registry, "SANDBOX_API_URL", "https://sandbox.test")
    monkeypatch.setattr(runs_registry, "SANDBOX_API_KEY", "token")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"sandbox_id": "sbx-1", "status": "running"}

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(
        runs_registry.httpx,
        "AsyncClient",
        lambda timeout=120: FakeAsyncClient(),
    )

    with pytest.raises(runs_registry.HTTPException, match="no url"):
        await runs_registry._quick_demo_via_docker_sandbox(
            tarball_url="https://orchestrator.test/api/v1/workflows/wf/tarball"
        )
