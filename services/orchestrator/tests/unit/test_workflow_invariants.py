"""Workflow / maturity invariants (explicit state rules, not property generation)."""

from __future__ import annotations

import os
import sys

sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)

from artifact_maturity import compute_artifact_maturity  # noqa: E402


def test_invariant_blocked_never_production_ready():
    """Blocked classification cannot coexist with production_ready label."""
    wf = {
        "status": "failed",
        "stages": [],
        "contracts": {"a.sol": "x"},
    }
    assert compute_artifact_maturity(wf) == "blocked"


def test_invariant_production_ready_requires_deployment_evidence():
    """Without deployment address, completed pipeline stays below production_ready."""
    wf = {
        "status": "completed",
        "current_stage": "deployed",
        "stages": [
            {"stage": "audit", "status": "completed"},
            {"stage": "simulation", "status": "completed"},
        ],
        "audit_passed": True,
        "simulation_passed": True,
        "contracts": {"t.sol": "pragma"},
        "deployments": [],
    }
    assert compute_artifact_maturity(wf) != "production_ready"
