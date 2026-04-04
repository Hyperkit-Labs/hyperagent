"""Artifact maturity and DApp lifecycle coverage (mandatory.md §4–§5, §17).

Computed on read from workflow records; not a substitute for full factory gating.
"""

from __future__ import annotations

from typing import Any, Literal

Maturity = Literal["draft", "validated", "production_ready", "blocked"]


def _stage_map(stages: list[dict[str, Any]] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for s in stages or []:
        name = (s.get("stage") or s.get("name") or "").strip()
        if not name:
            continue
        out[name] = (s.get("status") or "").lower()
    return out


def _deployments_have_address(deployments: list[Any] | None) -> bool:
    if not deployments:
        return False
    for d in deployments:
        if not isinstance(d, dict):
            continue
        if d.get("contract_address") or d.get("address"):
            return True
    return False


def compute_artifact_maturity(w: dict[str, Any]) -> Maturity:
    """Classify workflow output: draft vs validated vs production_ready vs blocked."""
    status = (w.get("status") or "").lower()
    current = (w.get("current_stage") or "").lower()
    st = _stage_map(w.get("stages"))
    meta = w.get("metadata") or w.get("meta_data") or {}

    fail_stages = (
        "audit_failed",
        "simulation_failed",
        "scrubd_failed",
        "exploit_sim_failed",
        "failed",
    )
    if status == "failed" or current in fail_stages:
        return "blocked"
    if meta.get("error") and status == "failed":
        return "blocked"

    for name in (
        "security_check",
        "scrubd",
        "audit",
        "simulation",
        "guardian",
        "exploit_sim",
        "deploy",
    ):
        if st.get(name) == "failed":
            return "blocked"

    inv = w.get("invariant_violations") or []
    if inv:
        for x in inv:
            if not isinstance(x, dict):
                continue
            sev = str(x.get("severity", "")).lower()
            if sev in ("high", "critical", "error"):
                return "blocked"

    if w.get("security_check_failed"):
        return "blocked"

    ap_raw = w.get("audit_passed")
    if ap_raw is False:
        return "blocked"

    if st.get("simulation") == "failed":
        return "blocked"

    deps = w.get("deployments") or []
    if _deployments_have_address(deps) and (
        status in ("completed", "success", "deployed")
        or current in ("deployed", "ui_scaffold")
    ):
        return "production_ready"

    contracts = w.get("contracts") or {}
    if not contracts:
        return "draft"

    audit_ok = ap_raw is True or (ap_raw is None and st.get("audit") == "completed")
    sim_raw = w.get("simulation_passed")
    sim_ok = sim_raw is True or (
        sim_raw is None and st.get("simulation") == "completed"
    )

    if audit_ok and sim_ok and st.get("exploit_sim") != "failed":
        return "validated"

    return "draft"


def compute_sandbox_lifecycle_coverage(w: dict[str, Any]) -> dict[str, bool]:
    """Which DApp lifecycle layers have evidence on this run (honest flags, not guarantees)."""
    st = _stage_map(w.get("stages"))
    contracts = w.get("contracts") or {}
    return {
        "spec_intake": bool(w.get("spec")),
        "contract_scaffold": bool(contracts),
        "frontend_scaffold": bool(w.get("ui_schema")),
        "validation_gates": st.get("audit") == "completed"
        and st.get("test_generation") == "completed",
        "simulation": bool(w.get("simulation_passed"))
        or st.get("simulation") == "completed",
        "deploy": bool(w.get("deployments")),
        "monitor_post_deploy": st.get("monitor") == "completed",
    }
