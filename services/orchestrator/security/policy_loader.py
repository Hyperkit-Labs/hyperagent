"""Load and validate security policy from YAML registry."""

from __future__ import annotations

from typing import Any

from registries import _ensure_loaded

_loaded: dict[str, Any] | None = None


def _get_security_spec() -> dict[str, Any]:
    global _loaded
    if _loaded is None:
        _ensure_loaded()
        from registries import _SECURITY

        root = _SECURITY or {}
        spec = root.get("spec", {})
        sec = spec.get("security", {})
        _loaded = sec if sec else spec
    return _loaded or {}


def get_mandatory_tools() -> list[str]:
    """Tools that must run and pass for deploy approval."""
    spec = _get_security_spec()
    tools = spec.get("tools", {}).get("mandatory")
    if tools:
        return list(tools)
    # Fallback to legacy
    from registries import _SECURITY

    root = _SECURITY or {}
    for p in root.get("spec", {}).get("policies", []) or []:
        if p.get("id") == "default":
            return list(p.get("mandatoryTools", []))
    return ["scrubd", "slither", "mythril", "tenderly"]


def get_deploy_block_severity() -> list[str]:
    """Severities that block deploy when unwaived."""
    spec = _get_security_spec()
    deploy = spec.get("deploy", {})
    sev = deploy.get("deploy_block_severity")
    if sev:
        return list(sev)
    from registries import _SECURITY

    root = _SECURITY or {}
    for p in root.get("spec", {}).get("policies", []) or []:
        if p.get("id") == "default":
            db = p.get("deployBlockSeverity")
            return [db] if db else ["high", "critical"]
    return ["high", "critical"]


def get_max_allowed_severity_for_deploy() -> str:
    """Max severity allowed to deploy (e.g. medium)."""
    spec = _get_security_spec()
    deploy = spec.get("deploy", {})
    m = deploy.get("max_allowed_severity_for_deploy")
    if m:
        return str(m).lower()
    from registries import _SECURITY

    root = _SECURITY or {}
    for p in root.get("spec", {}).get("policies", []) or []:
        if p.get("id") == "default":
            return str(p.get("maxAllowedSeverityForDeploy", "medium")).lower()
    return "medium"


def get_require_simulation_success() -> bool:
    """Whether Tenderly simulation must pass for deploy."""
    spec = _get_security_spec()
    if "require_simulation_success" in spec:
        return bool(spec["require_simulation_success"])
    from registries import _SECURITY

    root = _SECURITY or {}
    for p in root.get("spec", {}).get("policies", []) or []:
        if p.get("id") == "default":
            return bool(p.get("requireSimulationSuccess", True))
    return True


def get_echidna_required_when() -> list[str]:
    """Conditions when Echidna is required (e.g. generated_invariants_present)."""
    spec = _get_security_spec()
    cond = spec.get("tools", {}).get("conditional_mandatory", {}).get("echidna", {})
    when = cond.get("when", [])
    return list(when) if when else []


def get_ai_requires_corroboration() -> bool:
    """Whether Pashov findings require deterministic match to block."""
    spec = _get_security_spec()
    corr = spec.get("correlation", {})
    return bool(corr.get("ai_requires_one_deterministic_match", True))


def get_policy_version() -> str:
    """Policy version for verdict."""
    spec = _get_security_spec()
    return str(spec.get("version", "1"))


def get_waiver_requirements() -> list[str]:
    """Required fields for waiver metadata."""
    spec = _get_security_spec()
    deploy = spec.get("deploy", {})
    req = deploy.get("waiver_requires", [])
    return list(req) if req else [
        "approver_id",
        "approver_role",
        "reason",
        "expiry_at",
        "evidence_refs",
        "linked_run_id",
    ]
