"""Pashov audit agent: fail-closed regression.
On HTTP errors or exceptions, run_pashov_audit must return success=False (not True)."""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

os.environ["PASHOV_AUDIT_ENABLED"] = "true"


@pytest.fixture(autouse=True)
def _patch_refs(monkeypatch):
    """Stub _load_pashov_refs so audit actually runs without submodule."""
    from agents import pashov_audit_agent

    monkeypatch.setattr(
        pashov_audit_agent,
        "_load_pashov_refs",
        lambda: ("vec", "judging", "fmt", "attack"),
    )
    yield


@pytest.mark.asyncio
async def test_pashov_http_error_returns_false(monkeypatch):
    """HTTP non-200 must return success=False."""
    import httpx
    from agents.pashov_audit_agent import run_pashov_audit

    class FakeResponse:
        status_code = 500
        text = "internal error"

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def post(self, *a, **kw):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: FakeClient())
    findings, success = await run_pashov_audit(
        {"Test.sol": "pragma solidity ^0.8.0;"}, {}
    )
    assert success is False, "HTTP error must fail-closed"
    assert findings == []


@pytest.mark.asyncio
async def test_pashov_exception_returns_false(monkeypatch):
    """Network/timeout exception must return success=False."""
    import httpx
    from agents.pashov_audit_agent import run_pashov_audit

    class FailClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def post(self, *a, **kw):
            raise httpx.ConnectTimeout("timeout")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: FailClient())
    findings, success = await run_pashov_audit(
        {"Test.sol": "pragma solidity ^0.8.0;"}, {}
    )
    assert success is False, "Exception must fail-closed"
    assert findings == []


@pytest.mark.asyncio
async def test_pashov_success_returns_true(monkeypatch):
    """Successful 200 response must return success=True."""
    import httpx
    from agents.pashov_audit_agent import run_pashov_audit

    class OkResponse:
        status_code = 200

        def json(self):
            return {"text": "No findings."}

    class OkClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def post(self, *a, **kw):
            return OkResponse()

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: OkClient())
    findings, success = await run_pashov_audit(
        {"Test.sol": "pragma solidity ^0.8.0;"}, {}
    )
    assert success is True
    assert findings == []
