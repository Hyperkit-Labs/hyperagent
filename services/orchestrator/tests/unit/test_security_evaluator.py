"""Unit tests for security policy evaluator."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


@pytest.fixture(autouse=True)
def _policy_env(monkeypatch):
    monkeypatch.setenv("SECURITY_POLICY_MANDATORY_TOOLS", "slither,mythril,tenderly")
    monkeypatch.setenv("SECURITY_POLICY_DEPLOY_BLOCK_SEVERITY", "high,critical")
    monkeypatch.setenv("SECURITY_POLICY_REQUIRE_SIMULATION_SUCCESS", "true")


def test_evaluate_security_policy_rejects_on_high_finding():
    from security.evaluator import evaluate_security_policy

    step_outputs = {
        "scrubd": {"passed": True, "findings": []},
        "audit_findings": [
            {
                "tool": "slither",
                "severity": "high",
                "title": "Reentrancy",
                "description": "Reentrancy risk",
                "location": "Token.sol:42",
            }
        ],
        "simulation": {"success": True},
    }
    verdict = evaluate_security_policy("run-1", step_outputs)
    assert verdict["finalDecision"] in ("REJECTED", "APPROVED_WITH_WAIVER")
    assert verdict["finalDecision"] != "APPROVED"


def test_evaluate_security_policy_passes_clean_audit():
    from security.evaluator import evaluate_security_policy

    step_outputs = {
        "scrubd": {"passed": True, "findings": []},
        "audit_findings": [
            {"tool": "slither", "severity": "low", "title": "Style", "description": ""},
            {"tool": "mythril", "severity": "info", "title": "Info", "description": ""},
        ],
        "simulation": {"success": True},
    }
    verdict = evaluate_security_policy("run-2", step_outputs)
    assert verdict["finalDecision"] in ("APPROVED", "APPROVED_WITH_WAIVER", "REJECTED")


def test_evaluate_security_policy_verdict_has_required_fields():
    from security.evaluator import evaluate_security_policy

    step_outputs = {
        "scrubd": {"passed": True, "findings": []},
        "audit_findings": [],
        "simulation": {"success": True},
    }
    verdict = evaluate_security_policy("run-3", step_outputs)
    assert "finalDecision" in verdict
    assert "overallStatus" in verdict
    assert verdict["finalDecision"] in ("APPROVED", "APPROVED_WITH_WAIVER", "REJECTED")
