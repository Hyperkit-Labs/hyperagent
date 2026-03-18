"""Normalize raw tool outputs into NormalizedFinding and ToolResult.
Mythril JSON, Slither, Echidna, Tenderly, SCRUBD, Pashov adapters."""

from __future__ import annotations

from typing import Any

from .schemas import NormalizedFinding, ToolResult

TOOL_NAMES = ("scrubd", "slither", "mythril", "echidna", "pashov", "tenderly")


def _normalize_severity(sev: Any) -> str:
    s = (sev or "info").lower()
    if s in ("critical", "high", "medium", "low", "info"):
        return s
    return "info"


def _normalize_title(title: Any) -> str:
    return str(title or "Unknown finding").strip() or "Unknown"


def normalize_mythril(issue: dict[str, Any]) -> NormalizedFinding:
    """Map Mythril JSON issue to NormalizedFinding. Preserves swc-id, tx_sequence."""
    sev = _normalize_severity(issue.get("severity"))
    swc = issue.get("swc-id") or issue.get("swc_id") or ""
    filename = issue.get("filename") or issue.get("file") or ""
    lineno = issue.get("lineno") or issue.get("line") or 0
    func = issue.get("function") or ""
    contract = issue.get("contract") or ""
    fid = f"mythril:{swc}:{filename}:{lineno}:{func}"
    return NormalizedFinding(
        id=fid,
        tool="mythril",
        title=_normalize_title(issue.get("title")),
        description=str(issue.get("description") or ""),
        severity=sev,
        swcId=swc,
        contract=contract,
        function=func,
        file=filename,
        line=int(lineno) if lineno else None,
        evidenceRef=issue.get("sourceMap") or "",
        txSequenceRef="artifact://tx-sequence" if issue.get("tx_sequence") else "",
        corroboratedBy=[],
        waivable=sev in ("low", "info", "medium"),
        blocking=sev in ("high", "critical"),
    )


def normalize_slither(finding: dict[str, Any]) -> NormalizedFinding:
    """Map Slither finding to NormalizedFinding."""
    sev = _normalize_severity(finding.get("severity"))
    cat = finding.get("category") or finding.get("check") or ""
    loc = finding.get("location") or finding.get("element") or ""
    fid = f"slither:{cat}:{loc}:{finding.get('description', '')[:80]}"
    return NormalizedFinding(
        id=fid,
        tool="slither",
        title=_normalize_title(finding.get("title") or finding.get("description")),
        description=str(finding.get("description") or ""),
        severity=sev,
        swcId=finding.get("swc_id") or "",
        contract=finding.get("contract") or "",
        function=finding.get("function") or "",
        file=finding.get("filename") or finding.get("file") or "",
        line=finding.get("line") or "",
        corroboratedBy=[],
        waivable=sev in ("low", "info", "medium"),
        blocking=sev in ("high", "critical"),
    )


def normalize_tenderly(sim: dict[str, Any]) -> ToolResult:
    """Map Tenderly simulation result to ToolResult."""
    failed = (
        sim.get("deploy_simulation_failed")
        or sim.get("revert_detected")
        or sim.get("runtime_flow_failed")
        or not sim.get("passed", True)
    )
    findings: list[NormalizedFinding] = []
    if failed:
        findings.append(
            NormalizedFinding(
                id="tenderly:simulation-failure",
                tool="tenderly",
                title="Simulation failed",
                description=str(sim.get("reason") or "Pre-deploy simulation failed"),
                severity="critical",
                corroboratedBy=[],
                waivable=False,
                blocking=True,
            )
        )
    return ToolResult(
        tool="tenderly",
        status="FAIL" if failed else "PASS",
        required=True,
        executed=True,
        findings=findings,
        rawArtifactRef=sim.get("artifactRef") or "",
    )


def normalize_scrubd(raw: dict[str, Any]) -> ToolResult:
    """Map SCRUBD output to ToolResult."""
    passed = raw.get("passed", True)
    findings_raw = raw.get("findings", [])
    findings: list[NormalizedFinding] = []
    for i, f in enumerate(findings_raw):
        sev = _normalize_severity(f.get("severity") or ("high" if not passed else "low"))
        findings.append(
            NormalizedFinding(
                id=f"scrubd:{i}:{f.get('type', '')}:{f.get('location', '')}",
                tool="scrubd",
                title=_normalize_title(f.get("title") or f.get("type") or "SCRUBD pattern"),
                description=str(f.get("description") or f.get("message") or ""),
                severity=sev,
                corroboratedBy=[],
                waivable=sev in ("low", "info", "medium"),
                blocking=sev in ("high", "critical") or not passed,
            )
        )
    return ToolResult(
        tool="scrubd",
        status="FAIL" if not passed else "PASS",
        required=True,
        executed=True,
        findings=findings,
    )


def normalize_pashov(finding: dict[str, Any]) -> NormalizedFinding:
    """Map Pashov finding to NormalizedFinding. AI tool; blocking only when corroborated."""
    sev = _normalize_severity(finding.get("severity"))
    return NormalizedFinding(
        id=f"pashov:{finding.get('title','')[:40]}:{finding.get('location','')}",
        tool="pashov",
        title=_normalize_title(finding.get("title")),
        description=str(finding.get("description") or ""),
        severity=sev,
        corroboratedBy=[],
        waivable=True,
        blocking=False,
    )


def normalize_echidna(raw: dict[str, Any]) -> ToolResult:
    """Map Echidna output to ToolResult. Property falsified = FAIL."""
    property_falsified = raw.get("property_falsified") or raw.get("assertion_failed")
    executed = raw.get("executed", True)
    findings: list[NormalizedFinding] = []
    if property_falsified:
        findings.append(
            NormalizedFinding(
                id="echidna:property-falsified",
                tool="echidna",
                title="Property falsified",
                description=str(raw.get("reason") or "Echidna property or assertion failed"),
                severity="high",
                corroboratedBy=[],
                waivable=False,
                blocking=True,
            )
        )
    return ToolResult(
        tool="echidna",
        status="FAIL" if property_falsified else "PASS",
        required=True,
        executed=executed,
        findings=findings,
    )


def echidna_not_applicable(reason: str) -> ToolResult:
    """Echidna NOT_APPLICABLE when no harness/invariants."""
    return ToolResult(
        tool="echidna",
        status="NOT_APPLICABLE",
        required=False,
        executed=False,
        findings=[],
        reason=reason,
    )
