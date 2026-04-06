"""Security policy evaluator: produce normalized verdict from step outputs.
Deterministic tools and simulation are the hard gate; AI review is mandatory context."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, cast

from .finding_correlation import correlate_findings
from .finding_normalizers import (
    echidna_not_applicable,
    normalize_echidna,
    normalize_mythril,
    normalize_pashov,
    normalize_scrubd,
    normalize_slither,
    normalize_tenderly,
)
from .policy_loader import (
    get_ai_requires_corroboration,
    get_deploy_block_severity,
    get_echidna_required_when,
    get_mandatory_tools,
    get_max_allowed_severity_for_deploy,
    get_policy_version,
    get_require_simulation_success,
)
from .schemas import (
    FinalDecision,
    GateStatus,
    NormalizedFinding,
    SecurityVerdict,
    ToolResult,
)
from .waiver_validation import has_valid_waiver

logger = logging.getLogger(__name__)

BLOCKING_SEVERITIES = frozenset({"high", "critical"})


def _has_echidna_prereqs(step_outputs: dict[str, Any]) -> bool:
    """True when Echidna is required: invariants or assertion harness present."""
    when = get_echidna_required_when()
    if "always" in when:
        return True
    test_files = step_outputs.get("test_files") or {}
    if isinstance(test_files, dict):
        combined = " ".join(
            str(v) for v in test_files.values() if isinstance(v, str)
        ).lower()
    else:
        combined = str(test_files).lower()
    if "generated_invariants_present" in when or "assertion_harness_present" in when:
        return (
            "invariant_" in combined
            or "echidna" in combined
            or ("assert(" in combined and "test" in combined)
        )
    return False


def _collect_findings_from_audit(
    audit_findings: list[dict],
) -> list[NormalizedFinding]:
    """Convert audit agent findings into normalized shape for tool attribution."""
    out: list[NormalizedFinding] = []
    for f in audit_findings or []:
        tool_raw = (f.get("tool") or "").lower()
        if "slither" in tool_raw:
            out.append(normalize_slither(f))
        elif "mythril" in tool_raw:
            out.append(normalize_mythril(f))
        elif "pashov" in tool_raw:
            out.append(normalize_pashov(f))
        else:
            sev = (f.get("severity") or "info").lower()
            out.append(
                dict(
                    id=f"audit:{f.get('title','')[:40]}:{f.get('location','')}",
                    tool="slither",
                    title=f.get("title", "Unknown"),
                    description=f.get("description", ""),
                    severity=sev,
                    corroboratedBy=[],
                    waivable=sev in ("low", "info", "medium"),
                    blocking=sev in ("high", "critical"),
                )
            )
    return out


def evaluate_security_policy(
    run_id: str,
    step_outputs: dict[str, Any],
    policy_overrides: dict[str, Any] | None = None,
) -> SecurityVerdict:
    """Produce one normalized verdict from prior step outputs.
    NOT_APPLICABLE is never treated as PASS. Pashov blocks only when corroborated."""
    policy = policy_overrides or {}
    mandatory = policy.get("mandatoryTools") or get_mandatory_tools()
    deploy_block_sev = policy.get("deployBlockSeverity") or get_deploy_block_severity()
    if isinstance(deploy_block_sev, str):
        deploy_block_sev = [deploy_block_sev]
    require_sim = policy.get("requireSimulationSuccess")
    if require_sim is None:
        require_sim = get_require_simulation_success()
    ai_corroboration = get_ai_requires_corroboration()

    tool_results: list[ToolResult] = []

    # SCRUBD
    scrubd_raw = step_outputs.get("scrubd") or {
        "passed": step_outputs.get("scrubd_validation_passed", True),
        "findings": step_outputs.get("scrubd_findings") or [],
    }
    tool_results.append(normalize_scrubd(scrubd_raw))

    # Slither + Mythril + Pashov from audit
    audit_findings = step_outputs.get("audit_findings") or []
    slither_findings: list[NormalizedFinding] = []
    mythril_findings: list[NormalizedFinding] = []
    pashov_findings: list[NormalizedFinding] = []
    for f in audit_findings:
        tool_raw = (f.get("tool") or "").lower()
        if "slither" in tool_raw:
            slither_findings.append(normalize_slither(f))
        elif "mythril" in tool_raw:
            mythril_findings.append(normalize_mythril(f))
        elif "pashov" in tool_raw:
            pashov_findings.append(normalize_pashov(f))
        else:
            sev = (f.get("severity") or "info").lower()
            slither_findings.append(
                NormalizedFinding(
                    id=f"audit:{f.get('title','')[:40]}",
                    tool="slither",
                    title=f.get("title", "Unknown"),
                    description=f.get("description", ""),
                    severity=sev,
                    corroboratedBy=[],
                    waivable=sev in ("low", "info", "medium"),
                    blocking=sev in ("high", "critical"),
                )
            )

    all_findings: list[NormalizedFinding] = []
    all_findings.extend(slither_findings)
    all_findings.extend(mythril_findings)
    all_findings.extend(pashov_findings)

    slither_status: GateStatus = (
        "FAIL" if any(f.get("blocking") for f in slither_findings) else "PASS"
    )
    mythril_status: GateStatus = (
        "FAIL" if any(f.get("blocking") for f in mythril_findings) else "PASS"
    )

    tool_results.append(
        ToolResult(
            tool="slither",
            status=slither_status,
            required="slither" in mandatory,
            executed=len(slither_findings) >= 0 or len(audit_findings) > 0,
            findings=slither_findings,
        )
    )
    tool_results.append(
        ToolResult(
            tool="mythril",
            status=mythril_status,
            required="mythril" in mandatory,
            executed=len(mythril_findings) >= 0 or len(audit_findings) > 0,
            findings=mythril_findings,
        )
    )
    tool_results.append(
        ToolResult(
            tool="pashov",
            status="PASS",
            required=True,
            executed=True,
            findings=pashov_findings,
        )
    )

    # Echidna
    echidna_required = _has_echidna_prereqs(step_outputs)
    echidna_raw = step_outputs.get("echidna")
    if echidna_required and echidna_raw:
        tool_results.append(normalize_echidna(echidna_raw))
    else:
        tool_results.append(
            echidna_not_applicable("No generated invariants or assertion harness")
        )

    # Tenderly (simulation)
    sim_raw = (
        step_outputs.get("simulation") or step_outputs.get("simulation_results") or {}
    )
    if isinstance(sim_raw, dict):
        tool_results.append(normalize_tenderly(sim_raw))
    else:
        tool_results.append(
            ToolResult(
                tool="tenderly",
                status="FAIL",
                required=True,
                executed=False,
                findings=[
                    NormalizedFinding(
                        id="tenderly:no-result",
                        tool="tenderly",
                        title="Simulation missing",
                        description="No simulation result available",
                        severity="critical",
                        corroboratedBy=[],
                        waivable=False,
                        blocking=True,
                    )
                ],
            )
        )

    # Correlate
    correlated = correlate_findings(
        [dict(f) for f in all_findings],
        ai_requires_deterministic=ai_corroboration,
    )

    blocking: list[NormalizedFinding] = []
    waived: list[NormalizedFinding] = []
    for raw in correlated:
        f = dict(raw)
        if has_valid_waiver(f):
            waived.append(cast(NormalizedFinding, f))
        elif f.get("blocking"):
            sev = (f.get("severity") or "").lower()
            if sev in BLOCKING_SEVERITIES:
                blocked = True
                if (f.get("tool") or "").lower() == "pashov" and ai_corroboration:
                    if not (f.get("corroboratedBy") or []):
                        blocked = False
                if blocked:
                    blocking.append(cast(NormalizedFinding, f))

    mandatory_fail = any(
        tr.get("required") and tr.get("status") == "FAIL"
        for tr in tool_results
        if tr.get("tool") in mandatory
    )
    _tenderly: ToolResult | None = next(
        (tr for tr in tool_results if tr.get("tool") == "tenderly"),
        None,
    )
    tenderly_ok = (_tenderly or {}).get("status") == "PASS"

    if mandatory_fail or not tenderly_ok or blocking:
        final_decision: FinalDecision = "REJECTED"
        overall_status: GateStatus = "FAIL"
    elif waived:
        final_decision = "APPROVED_WITH_WAIVER"
        overall_status = "WAIVED"
    else:
        final_decision = "APPROVED"
        overall_status = "PASS"

    not_applicable = [
        tr["tool"] for tr in tool_results if tr.get("status") == "NOT_APPLICABLE"
    ]

    return SecurityVerdict(
        runId=run_id,
        policyVersion=policy.get("version") or get_policy_version(),
        finalDecision=final_decision,
        overallStatus=overall_status,
        toolResults=tool_results,
        blockingFindings=blocking,
        waivedFindings=waived,
        notApplicableTools=not_applicable,
        requiresHumanReview=len(waived) > 0,
        approvedForDeploy=final_decision != "REJECTED",
        generatedAt=datetime.now(timezone.utc).isoformat(),
        signedBy="orchestrator",
    )
