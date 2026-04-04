"""Property-based tests for artifact maturity classification."""

from __future__ import annotations

import os
import sys

from hypothesis import given, settings
from hypothesis import strategies as st

sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)

from artifact_maturity import compute_artifact_maturity  # noqa: E402

MATURITY = frozenset({"draft", "validated", "production_ready", "blocked"})

stage_entry = st.fixed_dictionaries(
    {
        "stage": st.sampled_from(
            [
                "spec",
                "design",
                "codegen",
                "audit",
                "simulation",
                "deploy",
                "security_check",
                "exploit_sim",
            ]
        ),
        "status": st.sampled_from(
            ["pending", "running", "completed", "failed", "skipped"]
        ),
    }
)


@settings(max_examples=40, deadline=None)
@given(
    status=st.sampled_from(
        ["building", "completed", "failed", "success", "deployed", "running"]
    ),
    current_stage=st.one_of(st.none(), st.text(max_size=48)),
    stages=st.lists(stage_entry, max_size=10),
    audit_passed=st.one_of(st.none(), st.booleans()),
    simulation_passed=st.one_of(st.none(), st.booleans()),
    contracts=st.one_of(
        st.none(),
        st.dictionaries(st.text(max_size=16), st.text(max_size=32), max_size=5),
    ),
    deployments=st.one_of(
        st.none(),
        st.lists(
            st.fixed_dictionaries(
                {
                    "contract_address": st.one_of(
                        st.none(),
                        st.just("0x1234567890123456789012345678901234567890"),
                    ),
                }
            ),
            max_size=4,
        ),
    ),
)
def test_maturity_always_in_enum(
    status,
    current_stage,
    stages,
    audit_passed,
    simulation_passed,
    contracts,
    deployments,
):
    wf = {
        "status": status,
        "current_stage": current_stage,
        "stages": stages,
        "audit_passed": audit_passed,
        "simulation_passed": simulation_passed,
        "contracts": contracts or {},
        "deployments": deployments,
    }
    m = compute_artifact_maturity(wf)
    assert m in MATURITY


@given(st.text(min_size=1, max_size=64))
def test_failed_status_always_blocked(extra: str):
    assert (
        compute_artifact_maturity(
            {"status": "failed", "current_stage": extra, "contracts": {"x.sol": "1"}}
        )
        == "blocked"
    )
