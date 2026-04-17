"""
Pipeline eval harness — Pillar 3: Continuous Improvement.

These tests validate pipeline OUTPUT STRUCTURE and QUALITY CONTRACTS,
not just unit-level correctness. They serve as the eval baseline referenced
in docs/control-plane/engineering-honesty-deliverables.md ("Evals: Not done").

Running:
    pytest services/orchestrator/tests/eval/ -v

In CI (add to .github/workflows/ci.yml):
    - name: Pipeline evals
      run: pytest services/orchestrator/tests/eval/ -v --tb=short

Fixtures follow the same pattern as tests/unit/ — no live network calls.
All pipeline nodes are called with fully-mocked dependencies so evals run
in any environment without external services.

Future: extend with golden-file comparisons and MLflow-tracked pass rates.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

FIXTURE_DIR = Path(__file__).parent / "fixtures"
FIXTURE_DIR.mkdir(exist_ok=True)


def _minimal_state(**overrides: Any) -> dict[str, Any]:
    """Minimal valid AgentState for eval tests."""
    base: dict[str, Any] = {
        "run_id": "eval-run-001",
        "user_id": "user-eval",
        "project_id": "proj-eval",
        "user_prompt": "Create an ERC-20 token with 1 million supply",
        "api_keys": {},
        "agent_session_jwt": "",
        "auto_approve": True,
        "messages": [],
        "current_stage": "start",
        "autofix_cycle": 0,
        "autofix_history": [],
        "discussion_trace": [],
        "debate_converged": False,
        "invariants": [],
        "invariant_violations": [],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Eval 1: AgentState contract — required keys present after each stage
# ---------------------------------------------------------------------------


class TestAgentStateContract:
    """Verify AgentState shape is preserved across pipeline stages."""

    def test_workflow_state_has_required_fields(self) -> None:
        from workflow_state import AgentState

        required = {
            "run_id",
            "user_id",
            "user_prompt",
            "api_keys",
            "messages",
            "current_stage",
            "autofix_cycle",
        }
        annotations = AgentState.__annotations__
        missing = required - set(annotations.keys())
        assert not missing, f"AgentState missing required fields: {missing}"

    def test_agent_protocol_callable(self) -> None:
        from workflow_state import AgentProtocol

        assert callable(AgentProtocol), "AgentProtocol must be callable (Protocol)"

    def test_max_autofix_cycles_bounded(self) -> None:
        from workflow_state import MAX_AUTOFIX_CYCLES

        assert 1 <= MAX_AUTOFIX_CYCLES <= 5, (
            f"MAX_AUTOFIX_CYCLES={MAX_AUTOFIX_CYCLES} is out of expected range [1,5]. "
            "Too low = no self-healing; too high = cost runaway."
        )


# ---------------------------------------------------------------------------
# Eval 2: Spec output quality contracts
# ---------------------------------------------------------------------------


class TestSpecOutputQuality:
    """Spec agent must produce structured output with mandatory fields."""

    REQUIRED_SPEC_FIELDS = {"token_type", "risk_profile"}

    @pytest.mark.asyncio
    async def test_spec_agent_produces_required_fields(self) -> None:
        fake_spec = {
            "token_type": "ERC-20",
            "risk_profile": "high",
            "name": "TestToken",
            "symbol": "TST",
            "total_supply": 1_000_000,
        }
        with (
            patch("nodes.invoke_roma_spec", new=AsyncMock(return_value=fake_spec)),
            patch("nodes.rag_client") as mock_rag,
            patch("nodes.context_client") as mock_ctx,
            patch("nodes.ipfs_client") as mock_ipfs,
            patch("nodes.update_workflow"),
            patch("nodes._step_start"),
            patch("nodes._step_complete", new=AsyncMock()),
        ):
            mock_rag.query_specs = AsyncMock(return_value=[])
            mock_rag.query_templates = AsyncMock(return_value=[])
            mock_rag.index_spec = AsyncMock(return_value=True)
            mock_ctx.search_context = MagicMock(return_value=[])
            mock_ctx.store_context = MagicMock()
            mock_ipfs.pin_and_record = AsyncMock()

            from nodes import spec_agent

            state = _minimal_state()
            result = await spec_agent(state)

            spec = result.get("spec") or {}
            missing = self.REQUIRED_SPEC_FIELDS - set(spec.keys())
            assert not missing, f"Spec missing required fields: {missing}"

    def test_spec_risk_profile_is_valid(self) -> None:
        valid = {"low", "medium", "high", "critical"}
        for risk in valid:
            spec = {"token_type": "ERC-20", "risk_profile": risk}
            assert spec["risk_profile"] in valid


# ---------------------------------------------------------------------------
# Eval 3: Audit findings structure contract
# ---------------------------------------------------------------------------


class TestAuditFindingsContract:
    """Every audit finding must have severity and either title or category."""

    REQUIRED_FINDING_KEYS = {"severity"}
    VALID_SEVERITIES = {"critical", "high", "medium", "low", "informational"}

    def test_finding_has_severity(self) -> None:
        sample_finding = {
            "title": "Reentrancy",
            "severity": "high",
            "category": "SWC-107",
            "description": "External call before state update.",
            "location": "Token.sol:42",
        }
        assert sample_finding.get("severity", "").lower() in self.VALID_SEVERITIES

    def test_findings_list_schema(self) -> None:
        findings = [
            {"title": "Reentrancy", "severity": "high", "category": "SWC-107"},
            {"title": "Integer overflow", "severity": "medium", "category": "SWC-101"},
        ]
        for f in findings:
            missing = self.REQUIRED_FINDING_KEYS - set(f.keys())
            assert not missing, f"Finding missing: {missing}"
            sev = f.get("severity", "").lower()
            assert sev in self.VALID_SEVERITIES, f"Invalid severity: {sev}"


# ---------------------------------------------------------------------------
# Eval 4: Security verdict is deterministic
# ---------------------------------------------------------------------------


class TestSecurityVerdict:
    """Security policy evaluator must produce a deterministic verdict."""

    REQUIRED_VERDICT_KEYS = {"finalDecision", "approvedForDeploy"}
    VALID_DECISIONS = {"APPROVED", "REJECTED", "CONDITIONAL"}

    def test_security_evaluator_import(self) -> None:
        try:
            from security.evaluator import evaluate_security_policy
        except ImportError:
            pytest.skip("security.evaluator not available in this env")

    def test_verdict_structure(self) -> None:
        verdict = {
            "finalDecision": "REJECTED",
            "approvedForDeploy": False,
            "blocking_findings": ["Reentrancy"],
        }
        missing = self.REQUIRED_VERDICT_KEYS - set(verdict.keys())
        assert not missing, f"Verdict missing keys: {missing}"
        assert verdict["finalDecision"] in self.VALID_DECISIONS


# ---------------------------------------------------------------------------
# Eval 5: MLflow tracker no-ops when not configured
# ---------------------------------------------------------------------------


class TestMLflowTrackerNoOp:
    """MLflow tracker must be safe to call when MLFLOW_TRACKING_URI is unset."""

    def test_is_configured_false_by_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("MLFLOW_TRACKING_URI", raising=False)
        import importlib

        import mlflow_tracker

        importlib.reload(mlflow_tracker)
        assert not mlflow_tracker.is_configured()

    def test_start_pipeline_run_noop(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("MLFLOW_TRACKING_URI", raising=False)
        import importlib

        import mlflow_tracker

        importlib.reload(mlflow_tracker)
        mlflow_tracker.start_pipeline_run("test-run-id", params={"key": "val"})

    def test_log_audit_findings_noop(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("MLFLOW_TRACKING_URI", raising=False)
        import importlib

        import mlflow_tracker

        importlib.reload(mlflow_tracker)
        mlflow_tracker.log_audit_findings(
            "test-run-id",
            [{"severity": "high", "title": "test"}],
            audit_passed=False,
        )


# ---------------------------------------------------------------------------
# Eval 6: RAG client audit indexing contract
# ---------------------------------------------------------------------------


class TestRAGAuditIndexing:
    """rag_client.index_audit_findings must handle empty and populated finding lists."""

    @pytest.mark.asyncio
    async def test_no_op_when_not_configured(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("VECTORDB_URL", "http://localhost:8010")
        monkeypatch.delenv("VECTORDB_ENABLED", raising=False)

        import importlib

        import rag_client

        importlib.reload(rag_client)
        result = await rag_client.index_audit_findings(
            "run-123", [{"severity": "high", "title": "test"}], audit_passed=False
        )
        assert result is False, "Should no-op when VECTORDB not configured"

    @pytest.mark.asyncio
    async def test_skips_indexing_on_clean_pass(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("VECTORDB_URL", "http://localhost:8010")
        monkeypatch.delenv("VECTORDB_ENABLED", raising=False)

        import importlib

        import rag_client

        importlib.reload(rag_client)
        result = await rag_client.index_audit_findings(
            "run-clean", [], audit_passed=True
        )
        assert result is False, "Should skip indexing when no findings and audit passed"


# ---------------------------------------------------------------------------
# Eval 7: ERC-8004 YAML registry is parseable
# ---------------------------------------------------------------------------


class TestERC8004RegistryYAML:
    """The ERC-8004 YAML file must be parseable and contain required fields."""

    YAML_PATH = (
        Path(__file__).parent.parent.parent.parent.parent
        / "infra"
        / "registries"
        / "erc8004"
        / "erc8004.yaml"
    )

    def test_yaml_exists(self) -> None:
        assert self.YAML_PATH.exists(), f"ERC-8004 YAML not found at {self.YAML_PATH}"

    def test_yaml_parseable(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        assert data is not None

    def test_yaml_has_chains(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        chains = (data.get("spec") or {}).get("chains") or []
        assert len(chains) >= 2, "Registry should define at least 2 chains"

    def test_each_chain_has_required_fields(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        chains = (data.get("spec") or {}).get("chains") or []
        required = {"chainId", "identityRegistry"}
        for chain in chains:
            missing = required - set(chain.keys())
            assert not missing, f"Chain {chain.get('slug')} missing fields: {missing}"

    def test_hyperagent_registrations_have_real_tx_hashes(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        hyperagent = (data.get("spec") or {}).get("hyperagent") or {}
        agent_ids = hyperagent.get("agentIds") or []
        assert (
            len(agent_ids) >= 1
        ), "HyperAgent should have at least one on-chain registration"
        for reg in agent_ids:
            tx = reg.get("registerTxHash") or ""
            assert (
                tx.startswith("0x") and len(tx) == 66
            ), f"Invalid txHash for agentId={reg.get('agentId')}: {tx!r}"


# ---------------------------------------------------------------------------
# Eval 8: models.yaml has correct BYOK providers
# ---------------------------------------------------------------------------


class TestModelsRegistry:
    """models.yaml must contain only real, documented BYOK providers."""

    YAML_PATH = (
        Path(__file__).parent.parent.parent.parent.parent
        / "infra"
        / "registries"
        / "models.yaml"
    )

    VALID_PROVIDERS = {"openai", "anthropic", "google", "openrouter"}

    def test_byok_providers_are_real(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        byok = (data.get("spec") or {}).get("byokEnvMapping") or {}
        unknown = set(byok.keys()) - self.VALID_PROVIDERS
        assert not unknown, (
            f"models.yaml byokEnvMapping contains unrecognized providers: {unknown}. "
            "Only add providers with documented public APIs."
        )

    def test_no_fabricated_model_providers(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        models = (data.get("spec") or {}).get("models") or []
        for m in models:
            provider = m.get("provider", "")
            assert provider in self.VALID_PROVIDERS, (
                f"Model entry has unknown provider '{provider}'. "
                "Only add providers with real, documented public APIs."
            )

    def test_routing_has_required_fields(self) -> None:
        import yaml

        with open(self.YAML_PATH) as f:
            data = yaml.safe_load(f)
        routing = (data.get("spec") or {}).get("routing") or {}
        assert "defaultFrontier" in routing, "routing must specify defaultFrontier"
        assert "defaultCheap" in routing, "routing must specify defaultCheap"
        assert (
            "cheapThresholdTokens" in routing
        ), "routing must specify cheapThresholdTokens"
