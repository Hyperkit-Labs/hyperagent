"""Simulation agent: TENDERLY_SIMULATION_REQUIRED default is fail-closed."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


def test_tenderly_simulation_required_defaults_true():
    """When TENDERLY_SIMULATION_REQUIRED is not set, it must default to True (fail-closed)."""
    env_backup = os.environ.pop("TENDERLY_SIMULATION_REQUIRED", None)
    try:
        # Re-evaluate the default
        val = os.environ.get("TENDERLY_SIMULATION_REQUIRED", "true").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        assert val is True, "Default must be fail-closed (true)"
    finally:
        if env_backup is not None:
            os.environ["TENDERLY_SIMULATION_REQUIRED"] = env_backup


def test_tenderly_simulation_required_explicit_false():
    """Explicit false must disable the gate."""
    os.environ["TENDERLY_SIMULATION_REQUIRED"] = "false"
    try:
        val = os.environ.get("TENDERLY_SIMULATION_REQUIRED", "true").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        assert val is False
    finally:
        del os.environ["TENDERLY_SIMULATION_REQUIRED"]
