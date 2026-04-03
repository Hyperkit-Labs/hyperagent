"""Audit agent: call audit service (Slither + Mythril); persist to security_findings.
Tiered gate model: Slither/Mythril block on High/Critical; Pashov blocks only when corroborated.
When OPENSANDBOX_ENABLED, routes through ExecutionBackend for gVisor/Firecracker isolation."""

import logging
import os
from collections import defaultdict

import httpx
from circuit_breaker import CircuitOpenError, get_breaker
from db import insert_security_finding, is_configured
from registries import get_deterministic_tools, get_timeout, get_tool_deploy_rule
from trace_context import get_trace_headers

_AUDIT_BREAKER_NAME = "audit_service"

logger = logging.getLogger(__name__)
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001")
AUDIT_TOOLS = ["slither", "mythril", "echidna"]
OPENSANDBOX_ENABLED = os.environ.get(
    "OPENSANDBOX_ENABLED", "false"
).strip().lower() in ("1", "true", "yes")

TOOL_WEIGHTS: dict[str, float] = {
    "slither": 0.6,
    "mythril": 0.5,
    "mythx": 0.7,
    "echidna": 0.8,
    "pashov-auditor": 0.65,
}

SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def has_echidna_harness(test_files: dict) -> bool:
    """True if test files contain Echidna invariants or assertion-heavy properties."""
    if not test_files or not isinstance(test_files, dict):
        return False
    combined = " ".join(
        str(v) for v in test_files.values() if isinstance(v, str)
    ).lower()
    return (
        "invariant_" in combined
        or "echidna" in combined
        or ("assert(" in combined and "test" in combined)
    )


def severity_fails_gate(severity: str, max_allowed: str) -> bool:
    """True when severity exceeds the max_allowed threshold."""
    order = ("info", "low", "medium", "high", "critical")
    try:
        return order.index(severity.lower()) > order.index(max_allowed.lower())
    except (ValueError, AttributeError):
        return True


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


def _is_pashov_corroborated(
    pashov_finding: dict,
    deterministic_findings: list[dict],
) -> bool:
    """True if Pashov finding is corroborated by Slither/Mythril/Echidna/Tenderly.
    Corroboration: same or overlapping location/title/category from a deterministic tool.
    """
    det_tools = set(get_deterministic_tools())
    p_title = (pashov_finding.get("title") or "").lower()
    p_desc = (pashov_finding.get("description") or "").lower()
    p_loc = (pashov_finding.get("location") or "").lower()

    for f in deterministic_findings:
        tool = (f.get("tool") or "").lower()
        if not any(dt in tool for dt in det_tools):
            continue
        d_title = (f.get("title") or "").lower()
        d_desc = (f.get("description") or "").lower()
        d_loc = (f.get("location") or "").lower()
        d_cat = (f.get("category") or "").lower()

        if p_title and d_title and (p_title in d_title or d_title in p_title):
            return True
        if p_desc and d_desc and (p_desc[:80] in d_desc or d_desc[:80] in p_desc):
            return True
        if p_loc and d_loc and (p_loc in d_loc or d_loc in p_loc):
            return True
        keywords = ["reentrancy", "access", "overflow", "unchecked", "transfer", "call"]
        if any(k in p_title or k in p_desc for k in keywords) and any(
            k in d_title or k in d_desc or k in d_cat for k in keywords
        ):
            return True
    return False


def _tool_to_gate_key(tool: str) -> str:
    """Map finding tool string to tiered gate key."""
    t = (tool or "").lower()
    if "pashov" in t:
        return "pashov"
    if "slither" in t:
        return "slither"
    if "mythril" in t:
        return "mythril"
    if "echidna" in t:
        return "echidna"
    if "scrubd" in t:
        return "scrubd"
    return "unknown"


def _finding_blocks_deploy(
    finding: dict,
    all_findings: list[dict],
    echidna_harness_available: bool = False,
) -> bool:
    """Apply tiered gate: return True if this finding blocks deploy."""
    tool = (finding.get("tool") or "").lower()
    severity = (finding.get("severity") or "info").lower()
    gate_key = _tool_to_gate_key(tool)
    deploy_rule = get_tool_deploy_rule(gate_key)

    if "slither" in tool or "mythril" in tool:
        if deploy_rule == "block_on_high_critical" and severity in ("high", "critical"):
            return True

    if "echidna" in tool:
        if deploy_rule == "block_when_harness_fails":
            if echidna_harness_available and severity in ("medium", "high", "critical"):
                return True
            if not echidna_harness_available:
                return False

    if "pashov" in tool:
        if deploy_rule == "block_only_when_corroborated":
            if _is_pashov_corroborated(
                finding, [f for f in all_findings if f != finding]
            ):
                return severity in ("high", "critical")
            return False

    if "scrubd" in tool or finding.get("scrubd_matched"):
        if deploy_rule == "block_on_matched_patterns":
            return severity in ("medium", "high", "critical")

    return False


def compute_audit_deploy_blocked(
    findings: list[dict],
    echidna_harness_available: bool = False,
) -> tuple[bool, list[dict]]:
    """Apply tiered gate model. Returns (deploy_blocked, blocking_findings)."""
    blocking: list[dict] = []
    for f in findings:
        if _finding_blocks_deploy(f, findings, echidna_harness_available):
            blocking.append(f)
    return len(blocking) > 0, blocking


async def _run_audit_via_execution_backend(
    contract_name: str,
    code: str,
    run_id: str,
) -> tuple[list[dict], bool]:
    """Run audit via ExecutionBackend (OpenSandbox when enabled).
    When OPENSANDBOX_ENABLED, uses run_multi_engine_audit (3 parallel sandboxes: Slither, Mythril, Echidna).
    Returns (findings, success)."""
    try:
        from execution_backend import get_execution_backend

        backend = get_execution_backend()
        on_log = None
        if is_configured() and run_id:
            from db import insert_agent_log

            def _on_log(tool: str, line: str) -> None:
                insert_agent_log(run_id, tool, "audit", line[:4096], log_level="info")

            on_log = _on_log
        if OPENSANDBOX_ENABLED and hasattr(backend, "run_multi_engine_audit"):
            result = await backend.run_multi_engine_audit(
                code, contract_name, on_log=on_log
            )
        else:
            result = await backend.run_audit(
                code, contract_name, tools=list(AUDIT_TOOLS), on_log=on_log
            )
        tool_label = ",".join(result.tools_run) or "audit"
        findings = []
        for f in result.findings:
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
        return (
            findings,
            len(result.tools_failed) < len(result.tools_run)
            or len(result.findings) > 0,
        )
    except ImportError:
        logger.warning("[audit] execution_backend not installed, falling back to HTTP")
        return [], False
    except Exception as e:
        logger.warning("[audit] execution_backend failed: %s", e)
        return [], False


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
        if OPENSANDBOX_ENABLED:
            exec_findings, exec_ok = await _run_audit_via_execution_backend(
                contract_name, code, run_id
            )
            if exec_ok or exec_findings:
                findings.extend(exec_findings)
                audit_succeeded_count += 1
            continue
        breaker = get_breaker(_AUDIT_BREAKER_NAME)
        try:
            if not breaker.can_execute():
                raise CircuitOpenError(f"Circuit {_AUDIT_BREAKER_NAME} is open")
            headers = get_trace_headers()
            async with httpx.AsyncClient(timeout=get_timeout("audit")) as client:
                r = await client.post(
                    f"{AUDIT_SERVICE_URL.rstrip('/')}/audit",
                    params={"tool": ",".join(AUDIT_TOOLS)},
                    json={"contractCode": code, "contractName": contract_name},
                    headers=headers,
                )
                if r.status_code != 200:
                    breaker.record_failure()
                    logger.warning(
                        "[audit] %s returned %s: %s",
                        contract_name,
                        r.status_code,
                        r.text[:200],
                    )
                    continue
                breaker.record_success()
                audit_succeeded_count += 1
                data = r.json()
                raw_findings = (
                    data.get("findings", [])
                    if isinstance(data, dict)
                    else data if isinstance(data, list) else []
                )
                tool_label = (
                    ",".join(data.get("tools_run", AUDIT_TOOLS))
                    if isinstance(data, dict)
                    else "audit"
                )
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
        except CircuitOpenError as e:
            logger.warning("[audit] %s circuit open, skipping: %s", contract_name, e)
            continue
        except Exception as e:
            breaker.record_failure()
            logger.warning("[audit] %s failed: %s", contract_name, e)
            continue

    if audit_succeeded_count == 0 and contracts_to_audit:
        logger.error(
            "[audit] All %d contract(s) failed to audit (service unreachable or error)",
            len(contracts_to_audit),
        )
        findings.append(
            {
                "tool": "audit",
                "severity": "high",
                "title": "Audit service unavailable",
                "description": "All contracts failed to reach the audit service. Check AUDIT_SERVICE_URL and that Slither/Mythril are installed.",
                "location": None,
                "category": "service",
            }
        )

    if len(findings) > 1:
        findings = _resolve_consensus(findings)
        logger.info("[audit] consensus resolution applied: %d findings", len(findings))
    return findings
