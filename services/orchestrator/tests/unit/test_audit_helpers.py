"""Unit tests for has_echidna_harness and severity_fails_gate (extracted to audit_agent)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from agents.audit_agent import (
    compute_audit_deploy_blocked,
    has_echidna_harness,
    severity_fails_gate,
)


class TestHasEchidnaHarness:
    def test_empty(self):
        assert has_echidna_harness({}) is False
        assert has_echidna_harness(None) is False

    def test_invariant_keyword(self):
        assert (
            has_echidna_harness({"test.sol": "function invariant_balance() public {"})
            is True
        )

    def test_echidna_keyword(self):
        assert has_echidna_harness({"test.sol": "// echidna configuration"}) is True

    def test_assert_with_test(self):
        assert (
            has_echidna_harness({"test.sol": "function testFoo() { assert(x > 0); }"})
            is True
        )

    def test_assert_without_test(self):
        assert has_echidna_harness({"lib.sol": "assert(x > 0);"}) is False

    def test_no_match(self):
        assert has_echidna_harness({"Token.sol": "contract Token {}"}) is False


class TestSeverityFailsGate:
    def test_high_fails_medium_gate(self):
        assert severity_fails_gate("high", "medium") is True

    def test_medium_passes_high_gate(self):
        assert severity_fails_gate("medium", "high") is False

    def test_same_severity_passes(self):
        assert severity_fails_gate("high", "high") is False

    def test_critical_fails_any_gate(self):
        assert severity_fails_gate("critical", "high") is True
        assert severity_fails_gate("critical", "medium") is True

    def test_info_passes_any_gate(self):
        assert severity_fails_gate("info", "critical") is False

    def test_unknown_severity_blocks(self):
        assert severity_fails_gate("unknown", "high") is True


class TestComputeAuditDeployBlocked:
    def test_audit_service_unavailable_blocks_deploy(self):
        findings = [
            {
                "tool": "audit",
                "severity": "high",
                "title": "Audit service unavailable",
                "description": "All contracts failed.",
                "category": "service",
            }
        ]
        blocked, blocking = compute_audit_deploy_blocked(findings)
        assert blocked is True
        assert len(blocking) == 1

    def test_normal_finding_not_blocked_without_tier_match(self):
        findings = [
            {
                "tool": "unknown_scanner",
                "severity": "high",
                "title": "Something",
                "category": "other",
            }
        ]
        blocked, _ = compute_audit_deploy_blocked(findings)
        assert blocked is False
