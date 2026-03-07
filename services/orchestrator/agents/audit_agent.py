"""Audit agent: call audit service (Slither + Mythril); persist to security_findings.
Includes weighted-evidence consensus resolution for conflicting tool results."""
import logging
import os
from collections import defaultdict

import httpx

from db import insert_security_finding, is_configured
from registries import get_timeout

logger = logging.getLogger(__name__)
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001")
AUDIT_TOOLS = ["slither", "mythril"]

TOOL_WEIGHTS: dict[str, float] = {
    "slither": 0.6,
    "mythril": 0.5,
    "mythx": 0.7,
    "echidna": 0.8,
}

SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def _resolve_consensus(findings: list[dict]) -> list[dict]:
    """Resolve conflicting severities from different tools using weighted evidence.
    When Slither says High but Mythril says Low for the same issue location,
    the final severity is the weighted average rather than worst-case."""
    grouped: dict[str, list[dict]] = defaultdict(list)
    for f in findings:
        key = (f.get("title", "") or f.get("description", ""))[:80]
        if not key:
            key = f.get("location", "unknown")
        grouped[key].append(f)

    resolved: list[dict] = []
    for key, group in grouped.items():
        if len(group) == 1:
            resolved.append(group[0])
            continue

        total_weight = 0.0
        weighted_severity = 0.0
        for f in group:
            tool = f.get("tool", "").split(",")[0].strip().lower()
            weight = TOOL_WEIGHTS.get(tool, 0.5)
            sev_val = SEVERITY_ORDER.get(f.get("severity", "info"), 0)
            weighted_severity += sev_val * weight
            total_weight += weight

        avg_severity = weighted_severity / total_weight if total_weight > 0 else 0
        reverse_map = {v: k for k, v in SEVERITY_ORDER.items()}
        consensus_level = reverse_map.get(round(avg_severity), "medium")

        merged = group[0].copy()
        merged["severity"] = consensus_level
        merged["tool"] = ",".join(sorted(set(f.get("tool", "") for f in group)))
        merged["consensus"] = True
        merged["contributing_tools"] = len(group)
        resolved.append(merged)

    return resolved


async def run_security_audits(
    contracts: dict,
    framework: str,
    run_id: str = "",
) -> list:
    findings = []
    contracts_to_audit = [
        (name.replace(".sol", ""), code)
        for name, code in (contracts or {}).items()
        if name.endswith(".sol") and isinstance(code, str)
    ]
    if not contracts_to_audit:
        return []

    audit_succeeded_count = 0
    for contract_name, code in contracts_to_audit:
        try:
            async with httpx.AsyncClient(timeout=get_timeout("audit")) as client:
                r = await client.post(
                    f"{AUDIT_SERVICE_URL.rstrip('/')}/audit",
                    params={"tool": ",".join(AUDIT_TOOLS)},
                    json={"contractCode": code, "contractName": contract_name},
                )
                if r.status_code != 200:
                    logger.warning("[audit] %s returned %s: %s", contract_name, r.status_code, r.text[:200])
                    continue
                audit_succeeded_count += 1
                data = r.json()
                raw_findings = data.get("findings", []) if isinstance(data, dict) else data if isinstance(data, list) else []
                tool_label = ",".join(data.get("tools_run", AUDIT_TOOLS)) if isinstance(data, dict) else "audit"
                for f in raw_findings:
                    finding = {
                        "tool": tool_label,
                        "severity": (f.get("severity") or "info").lower(),
                        "title": f.get("title", ""),
                        "description": f.get("description", ""),
                        "location": f.get("location"),
                        "category": f.get("category"),
                    }
                    findings.append(finding)
                    if is_configured() and run_id:
                        insert_security_finding(
                            run_id=run_id,
                            tool=finding["tool"],
                            severity=finding["severity"],
                            title=finding["title"],
                            description=finding.get("description"),
                            location=finding.get("location"),
                            category=finding.get("category"),
                        )
        except Exception as e:
            logger.warning("[audit] %s failed: %s", contract_name, e)
            continue

    if audit_succeeded_count == 0 and contracts_to_audit:
        logger.error("[audit] All %d contract(s) failed to audit (service unreachable or error)", len(contracts_to_audit))
        findings.append({
            "tool": "audit",
            "severity": "high",
            "title": "Audit service unavailable",
            "description": "All contracts failed to reach the audit service. Check AUDIT_SERVICE_URL and that Slither/Mythril are installed.",
            "location": None,
            "category": "service",
        })

    if len(findings) > 1:
        findings = _resolve_consensus(findings)
        logger.info("[audit] consensus resolution applied: %d findings", len(findings))
    return findings
