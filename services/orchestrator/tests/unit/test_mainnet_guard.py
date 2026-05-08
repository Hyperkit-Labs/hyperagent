"""Unit tests for mainnet_guard and deploy gates."""

from __future__ import annotations

import os
import sys
from types import SimpleNamespace

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


def test_prepare_deploy_api_blocks_rejected_security_verdict(monkeypatch):
    from api.workflows import prepare_deploy_api

    workflow = {
        "security_verdict": {"approvedForDeploy": False, "finalDecision": "REJECTED"},
        "simulation_passed": True,
        "contracts": {"Token.sol": "contract Token {}"},
    }
    monkeypatch.setattr("api.workflows.get_workflow", lambda workflow_id: workflow)
    monkeypatch.setattr("api.workflows.assert_workflow_owner", lambda w, request: None)
    monkeypatch.setattr("api.workflows.get_default_chain_id", lambda: 84532)

    request = SimpleNamespace()
    with pytest.raises(Exception) as exc_info:
        prepare_deploy_api("wf_123", request, chain_id=84532)

    exc = exc_info.value
    assert getattr(exc, "status_code", None) == 403
    assert "security policy verdict" in str(getattr(exc, "detail", "")).lower()


def test_prepare_deploy_api_blocks_when_simulation_gate_enforced(monkeypatch):
    from api.workflows import prepare_deploy_api

    workflow = {
        "security_verdict": {"approvedForDeploy": True, "finalDecision": "APPROVED"},
        "simulation_passed": False,
        "contracts": {"Token.sol": "contract Token {}"},
    }
    monkeypatch.setattr("api.workflows.get_workflow", lambda workflow_id: workflow)
    monkeypatch.setattr("api.workflows.assert_workflow_owner", lambda w, request: None)
    monkeypatch.setattr("api.workflows.get_default_chain_id", lambda: 84532)
    monkeypatch.setenv("ENFORCE_SIMULATION_BEFORE_DEPLOY", "1")

    request = SimpleNamespace()
    with pytest.raises(Exception) as exc_info:
        prepare_deploy_api("wf_123", request, chain_id=84532)

    exc = exc_info.value
    assert getattr(exc, "status_code", None) == 403
    assert "simulation" in str(getattr(exc, "detail", "")).lower()
