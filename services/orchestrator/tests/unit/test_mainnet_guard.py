"""Unit tests for mainnet_guard and deploy gates."""

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


def test_check_security_verdict_deploy_gate_no_verdict():
    from mainnet_guard import check_security_verdict_deploy_gate

    ok, _ = check_security_verdict_deploy_gate({})
    assert ok is True


def test_check_security_verdict_deploy_gate_rejected():
    from mainnet_guard import check_security_verdict_deploy_gate

    ok, reason = check_security_verdict_deploy_gate(
        {"security_verdict": {"approvedForDeploy": False, "finalDecision": "REJECTED"}}
    )
    assert ok is False
    assert "security policy verdict" in reason.lower()


def test_check_security_verdict_deploy_gate_approved():
    from mainnet_guard import check_security_verdict_deploy_gate

    ok, _ = check_security_verdict_deploy_gate(
        {"security_verdict": {"approvedForDeploy": True}}
    )
    assert ok is True


def test_check_simulation_deploy_gate_off_by_default(monkeypatch):
    from mainnet_guard import check_simulation_deploy_gate

    monkeypatch.delenv("ENFORCE_SIMULATION_BEFORE_DEPLOY", raising=False)
    ok, _ = check_simulation_deploy_gate({"simulation_passed": False})
    assert ok is True


def test_check_simulation_deploy_gate_enforced(monkeypatch):
    from mainnet_guard import check_simulation_deploy_gate

    monkeypatch.setenv("ENFORCE_SIMULATION_BEFORE_DEPLOY", "1")
    ok, reason = check_simulation_deploy_gate({"simulation_passed": False})
    assert ok is False
    assert "simulation" in reason.lower()

    ok2, _ = check_simulation_deploy_gate({"simulation_passed": True})
    assert ok2 is True
