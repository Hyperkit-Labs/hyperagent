"""Unit tests for security policy evaluator."""

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


def test_evaluate_security_policy_approved():
    """Minimal step_outputs with passing tools yields APPROVED."""
    from security.evaluator import evaluate_security_policy

    step_outputs = {
        "scrubd": {"passed": True, "findings": []},
        "audit_findings": [],
        "simulation": {"passed": True, "simulation_passed": True},
        "simulation_results": {"passed": True},
    }
    verdict = evaluate_security_policy("run-1", step_outputs)
    assert verdict["finalDecision"] in ("APPROVED", "APPROVED_WITH_WAIVER", "REJECTED")
    assert "runId" in verdict
    assert verdict["runId"] == "run-1"
    assert "policyVersion" in verdict
    assert "toolResults" in verdict


def test_evaluate_security_policy_rejected_on_audit_failure():
    """Blocking audit finding yields REJECTED."""
    from security.evaluator import evaluate_security_policy

    step_outputs = {
        "scrubd": {"passed": True, "findings": []},
        "audit_findings": [
            {
                "tool": "slither",
                "title": "Critical vuln",
                "severity": "critical",
                "description": "Reentrancy",
            }
        ],
        "simulation": {"passed": True},
        "simulation_results": {"passed": True},
    }
    verdict = evaluate_security_policy("run-2", step_outputs)
    assert verdict["finalDecision"] == "REJECTED"
    assert verdict["approvedForDeploy"] is False
