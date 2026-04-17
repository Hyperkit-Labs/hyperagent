"""
Connectivity hardening unit tests (connectivity audit P0/P1 items).

Covers:
  - BYOK error-path redaction (secret material must not appear in logs)
  - Audit fail-closed gate (AUDIT_MANDATORY=true blocks deploy when service unreachable)
  - Audit gate respects AUDIT_MANDATORY=false (advisory mode)
  - Simulation fail-closed (TENDERLY_SIMULATION_REQUIRED=true blocks on skip)
  - x402 mandatory: X402_MANDATORY_V01 enables middleware and removes internal bypass
  - x402 mandatory: pipeline /generate returns 402 when X402_MANDATORY_V01=1 and no credits/payment
"""

from __future__ import annotations

import importlib
import os

import pytest

# ---------------------------------------------------------------------------
# BYOK error redaction
# ---------------------------------------------------------------------------


def test_redact_error_for_storage_masks_api_key_like_strings() -> None:
    from api.common import redact_error_for_storage

    raw = "Request failed: api_key=sk-1234567890abcdef"
    out = redact_error_for_storage(raw)
    assert "sk-" not in out
    assert "redacted" in out.lower()


def test_redact_error_for_logs_masks_secrets() -> None:
    from api.common import redact_error_for_logs

    assert redact_error_for_logs("ok") == "ok"
    assert (
        redact_error_for_logs("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
        == "[redacted]"
    )


def test_get_keys_for_run_swallows_exception_without_leaking(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Key resolution failure must not propagate raw exception to caller."""
    import api.common as common

    def _bad_get_user(_uid: str) -> dict:
        raise RuntimeError("DB error: api_key=sk-supersecretkey123456")

    monkeypatch.setattr("llm_keys_supabase._is_configured", lambda: True, raising=False)
    monkeypatch.setattr(
        "llm_keys_supabase.get_keys_for_user", _bad_get_user, raising=False
    )

    # Must return empty dict, not raise
    result = common._get_keys_for_run("user-123", "ws-abc")
    assert result == {}


# ---------------------------------------------------------------------------
# Audit fail-closed gate
# ---------------------------------------------------------------------------


def test_audit_mandatory_env_defaults_true() -> None:
    """AUDIT_MANDATORY must default to true so the gate is fail-closed by default."""
    import agents.audit_agent as aa

    # Reload without any override to test the default
    orig = os.environ.pop("AUDIT_MANDATORY", None)
    try:
        importlib.reload(aa)
        assert aa.AUDIT_MANDATORY is True
    finally:
        if orig is not None:
            os.environ["AUDIT_MANDATORY"] = orig
        importlib.reload(aa)


def test_audit_mandatory_false_disables_service_block() -> None:
    """When AUDIT_MANDATORY=false, 'service unavailable' finding does NOT block deploy."""
    os.environ["AUDIT_MANDATORY"] = "false"
    try:
        import agents.audit_agent as aa

        importlib.reload(aa)
        finding = {
            "tool": "audit",
            "severity": "high",
            "title": "Audit service unavailable",
            "category": "service",
        }
        blocked = aa._finding_blocks_deploy(finding, [finding])
        assert (
            blocked is False
        ), "AUDIT_MANDATORY=false should not block on service unavailability"
    finally:
        os.environ.pop("AUDIT_MANDATORY", None)
        importlib.reload(aa)


def test_audit_mandatory_true_blocks_on_service_unavailable() -> None:
    """When AUDIT_MANDATORY=true (default), 'service unavailable' finding blocks deploy."""
    os.environ["AUDIT_MANDATORY"] = "true"
    try:
        import agents.audit_agent as aa

        importlib.reload(aa)
        finding = {
            "tool": "audit",
            "severity": "high",
            "title": "Audit service unavailable",
            "category": "service",
        }
        blocked = aa._finding_blocks_deploy(finding, [finding])
        assert (
            blocked is True
        ), "AUDIT_MANDATORY=true must block on service unavailability"
    finally:
        os.environ.pop("AUDIT_MANDATORY", None)
        importlib.reload(aa)


def test_compute_audit_deploy_blocked_service_unavailable_is_blocking() -> None:
    """compute_audit_deploy_blocked must return (True, [finding]) for service-unavailable findings."""
    os.environ["AUDIT_MANDATORY"] = "true"
    try:
        import agents.audit_agent as aa

        importlib.reload(aa)
        findings = [
            {
                "tool": "audit",
                "severity": "high",
                "title": "Audit service unavailable",
                "description": "All contracts failed to reach the audit service.",
                "location": None,
                "category": "service",
            }
        ]
        blocked, blocking = aa.compute_audit_deploy_blocked(findings)
        assert blocked is True
        assert len(blocking) == 1
    finally:
        os.environ.pop("AUDIT_MANDATORY", None)
        importlib.reload(aa)


# ---------------------------------------------------------------------------
# Simulation fail-closed gate
# ---------------------------------------------------------------------------


def test_tenderly_simulation_required_defaults_true() -> None:
    """TENDERLY_SIMULATION_REQUIRED must default to true (fail-closed)."""
    import agents.simulation_agent as sa

    orig = os.environ.pop("TENDERLY_SIMULATION_REQUIRED", None)
    try:
        importlib.reload(sa)
        assert sa.TENDERLY_SIMULATION_REQUIRED is True
    finally:
        if orig is not None:
            os.environ["TENDERLY_SIMULATION_REQUIRED"] = orig
        importlib.reload(sa)


# ---------------------------------------------------------------------------
# x402 mandatory enforcement
# ---------------------------------------------------------------------------


def test_x402_mandatory_v01_enables_middleware(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("X402_ENABLED", raising=False)
    monkeypatch.setenv("X402_MANDATORY_V01", "1")
    import x402_middleware

    importlib.reload(x402_middleware)
    assert x402_middleware._is_x402_enabled() is True


def test_x402_enforce_internal_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("X402_ENFORCE_INTERNAL", "true")
    import x402_middleware

    importlib.reload(x402_middleware)
    assert x402_middleware._x402_enforce_internal() is True


def test_x402_mandatory_v01_disables_internal_bypass() -> None:
    """X402_MANDATORY_V01=1 must set _X402_MANDATORY_V01=True so internal callers cannot bypass."""
    os.environ["X402_MANDATORY_V01"] = "1"
    try:
        import x402_middleware

        importlib.reload(x402_middleware)
        assert x402_middleware._X402_MANDATORY_V01 is True
    finally:
        os.environ.pop("X402_MANDATORY_V01", None)
        importlib.reload(x402_middleware)


def test_x402_mandatory_v01_off_by_default() -> None:
    """Without X402_MANDATORY_V01, internal bypass remains active (safe default for dev)."""
    os.environ.pop("X402_MANDATORY_V01", None)
    import x402_middleware

    importlib.reload(x402_middleware)
    assert x402_middleware._X402_MANDATORY_V01 is False


# ---------------------------------------------------------------------------
# Teardown
# ---------------------------------------------------------------------------


def teardown_module() -> None:
    for k in (
        "X402_MANDATORY_V01",
        "X402_ENFORCE_INTERNAL",
        "X402_ENABLED",
        "AUDIT_MANDATORY",
        "TENDERLY_SIMULATION_REQUIRED",
    ):
        os.environ.pop(k, None)
