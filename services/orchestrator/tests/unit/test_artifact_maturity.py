"""Unit tests for artifact_maturity."""

from artifact_maturity import (
    compute_artifact_maturity,
    compute_sandbox_lifecycle_coverage,
)


def test_maturity_blocked_on_failed_status():
    assert (
        compute_artifact_maturity({"status": "failed", "contracts": {"a.sol": "x"}})
        == "blocked"
    )


def test_maturity_draft_codegen_only():
    assert (
        compute_artifact_maturity(
            {
                "status": "building",
                "contracts": {"C.sol": "pragma"},
                "stages": [{"stage": "codegen", "status": "completed"}],
            }
        )
        == "draft"
    )


def test_maturity_validated_audit_and_sim():
    assert (
        compute_artifact_maturity(
            {
                "status": "building",
                "current_stage": "awaiting_deploy_approval",
                "audit_passed": True,
                "simulation_passed": True,
                "contracts": {"C.sol": "pragma"},
                "stages": [
                    {"stage": "audit", "status": "completed"},
                    {"stage": "simulation", "status": "completed"},
                ],
            }
        )
        == "validated"
    )


def test_maturity_production_ready_with_deployment():
    assert (
        compute_artifact_maturity(
            {
                "status": "completed",
                "audit_passed": True,
                "simulation_passed": True,
                "contracts": {"C.sol": "pragma"},
                "deployments": [
                    {"contract_address": "0xabc", "chain_id": 1},
                ],
            }
        )
        == "production_ready"
    )


def test_sandbox_lifecycle_keys():
    cov = compute_sandbox_lifecycle_coverage(
        {
            "spec": {"x": 1},
            "contracts": {"a.sol": "x"},
            "ui_schema": {"pages": []},
            "simulation_passed": True,
            "deployments": [{}],
            "stages": [
                {"stage": "audit", "status": "completed"},
                {"stage": "test_generation", "status": "completed"},
                {"stage": "monitor", "status": "completed"},
            ],
        }
    )
    assert cov["spec_intake"] is True
    assert cov["contract_scaffold"] is True
    assert cov["frontend_scaffold"] is True
    assert cov["validation_gates"] is True
    assert cov["simulation"] is True
    assert cov["deploy"] is True
    assert cov["monitor_post_deploy"] is True
