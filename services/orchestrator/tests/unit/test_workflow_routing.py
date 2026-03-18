"""Unit tests: workflow routing. Exploit sim fail-closed."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from workflow import _after_exploit_simulation, _after_security_policy_evaluator


def test_after_exploit_simulation_missing_state_defaults_to_failure():
    """Missing exploit_simulation_passed defaults to False -> failed or autofix."""
    state = {}
    result = _after_exploit_simulation(state)
    assert result in ("failed", "autofix")


def test_after_exploit_simulation_passed_false_routes_to_failed_or_autofix():
    """exploit_simulation_passed=False -> never ui_scaffold."""
    state = {"exploit_simulation_passed": False, "autofix_cycle": 10}
    result = _after_exploit_simulation(state)
    assert result == "failed"


def test_after_exploit_simulation_passed_true_routes_to_ui_scaffold():
    """exploit_simulation_passed=True -> ui_scaffold."""
    state = {"exploit_simulation_passed": True}
    result = _after_exploit_simulation(state)
    assert result == "ui_scaffold"


def test_after_security_policy_approved_routes_to_exploit_sim():
    """security_approved_for_deploy=True -> exploit_simulation."""
    state = {"security_approved_for_deploy": True}
    result = _after_security_policy_evaluator(state)
    assert result == "exploit_simulation"


def test_after_security_policy_not_approved_routes_to_failed():
    """security_approved_for_deploy=False -> failed."""
    state = {"security_approved_for_deploy": False}
    result = _after_security_policy_evaluator(state)
    assert result == "failed"
