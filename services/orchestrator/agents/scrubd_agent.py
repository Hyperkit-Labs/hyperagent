"""SCRUBD validation agent: mandatory RE/UX pattern checks against SCRUBD dataset.
Validates generated contracts against known reentrancy and unhandled-exception patterns."""

import csv
import logging
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from agents.audit_agent import run_security_audits

logger = logging.getLogger(__name__)

SCRUBD_PATH = os.environ.get("SCRUBD_PATH", "./data/SCRUBD")
SCRUBD_VERSION = os.environ.get("SCRUBD_VERSION", "V6.0")
SCRUBD_REPO = "https://github.com/sujeetc/SCRUBD"
LABELS_CSV = "SCRUBD-CD/data/labels.csv"


def _ensure_scrubd() -> Path:
    """Clone SCRUBD repo if missing; return path to labels.csv. Fail if clone fails or file missing."""
    base = Path(SCRUBD_PATH).resolve()
    labels_path = base / LABELS_CSV

    if labels_path.exists():
        return labels_path

    base.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--branch",
                SCRUBD_VERSION,
                SCRUBD_REPO,
                str(base),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (
        subprocess.CalledProcessError,
        FileNotFoundError,
        subprocess.TimeoutExpired,
    ) as e:
        logger.error("[scrubd] clone failed: %s", e)
        raise RuntimeError(f"SCRUBD clone failed: {e}") from e

    if not labels_path.exists():
        raise FileNotFoundError(f"SCRUBD labels not found at {labels_path} after clone")

    return labels_path


def _load_scrubd_patterns(path: Path) -> list[dict[str, Any]]:
    """Parse labels.csv; extract RE=1 or UX=1 rows with Comments."""
    patterns: list[dict[str, Any]] = []
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            re_val = str(row.get("RE", "")).strip()
            ux_val = str(row.get("UX", "")).strip()
            if re_val == "1" or ux_val == "1":
                comment = (row.get("Comments") or "").strip()
                patterns.append(
                    {
                        "re": re_val == "1",
                        "ux": ux_val == "1",
                        "comment": comment,
                        "function": row.get("Function Name", ""),
                    }
                )
    return patterns


def _load_scrubd_fix_hints(path: Path) -> list[str]:
    """Load RE=0, UX=0 rows (non-vulnerable) Comments for fix hints."""
    hints: list[str] = []
    seen: set[str] = set()
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            re_val = str(row.get("RE", "")).strip()
            ux_val = str(row.get("UX", "")).strip()
            if re_val == "0" and ux_val == "0":
                comment = (row.get("Comments") or "").strip()
                if comment and comment not in seen:
                    seen.add(comment)
                    hints.append(comment)
    return hints


def _structural_check(code: str) -> list[dict[str, Any]]:
    """Check for external call before state update (reentrancy pattern)."""
    findings: list[dict[str, Any]] = []
    ext_call_patterns = [
        (r"\.call\s*\(", "call()"),
        (r"\.transfer\s*\(", "transfer()"),
        (r"\.send\s*\(", "send()"),
    ]
    state_write_patterns = [
        r"=\s*[^=]",  # assignment
        r"\+\+|--",
        r"\.push\s*\(",
        r"delete\s+",
    ]

    lines = code.split("\n")
    for i, line in enumerate(lines):
        for pat, name in ext_call_patterns:
            if re.search(pat, line):
                for j in range(i + 1, min(i + 20, len(lines))):
                    for sw in state_write_patterns:
                        if re.search(sw, lines[j]):
                            findings.append(
                                {
                                    "type": "structural",
                                    "pattern": f"external {name} before state update",
                                    "line": i + 1,
                                    "description": f"Possible reentrancy: {name} at line {i + 1} followed by state update at line {j + 1}",
                                }
                            )
                            break
                break
    return findings


def _match_finding_to_scrubd(finding: dict, patterns: list[dict]) -> bool:
    """Check if audit finding matches SCRUBD RE/UX patterns."""
    cat = (finding.get("category") or "").lower()
    title = (finding.get("title") or "").lower()
    desc = (finding.get("description") or "").lower()
    text = f"{cat} {title} {desc}"

    re_keywords = [
        "reentrancy",
        "reentrancy-eth",
        "reentrancy-no-eth",
        "reentrancy-benign",
    ]
    ux_keywords = [
        "unchecked-transfer",
        "unchecked-send",
        "unchecked-lowlevel",
        "unhandled",
        "return value",
    ]

    for p in patterns:
        if p.get("re") and any(k in text for k in re_keywords):
            return True
        if p.get("ux") and any(k in text for k in ux_keywords):
            return True
    return False


async def _validate_against_scrubd(
    contracts: dict,
    patterns: list[dict],
    framework: str,
    run_id: str,
) -> tuple[bool, list[dict]]:
    """Run Slither audit, match findings to SCRUBD patterns, run structural check. Return (passed, findings)."""
    all_findings: list[dict] = []

    findings = await run_security_audits(contracts, framework, run_id=run_id)
    for f in findings:
        if _match_finding_to_scrubd(f, patterns):
            f["scrubd_matched"] = True
            all_findings.append(f)

    for fname, code in (contracts or {}).items():
        if isinstance(code, str) and fname.endswith(".sol"):
            structural = _structural_check(code)
            for s in structural:
                s["contract"] = fname
                s["severity"] = "medium"
                all_findings.append(s)

    passed = len(all_findings) == 0
    return passed, all_findings


async def run_scrubd_validation(
    contracts: dict,
    run_id: str,
    framework: str = "hardhat",
) -> tuple[bool, list]:
    """Run SCRUBD validation. Returns (passed, findings).
    SCRUBD dataset must be available (clone during build or set SCRUBD_PATH)."""
    path = _ensure_scrubd()
    patterns = _load_scrubd_patterns(path)
    passed, findings = await _validate_against_scrubd(
        contracts, patterns, framework, run_id
    )
    logger.info(
        "[scrubd] run_id=%s passed=%s findings=%d", run_id, passed, len(findings)
    )
    return passed, findings


def get_scrubd_fix_hints(error_context: str) -> str:
    """Return short fix hints from non-vulnerable SCRUBD Comments."""
    try:
        path = _ensure_scrubd()
        hints = _load_scrubd_fix_hints(path)
    except Exception as e:
        logger.warning("[scrubd] fix hints load failed: %s", e)
        return (
            "Use checks-effects-interactions; update state before external calls; "
            "check return values of call/transfer/send."
        )

    if not hints:
        return (
            "Use checks-effects-interactions; update state before external calls; "
            "check return values of call/transfer/send."
        )

    selected: list[str] = []
    keywords = [
        "no re",
        "no ext",
        "modifier",
        "checks-effects",
        "non-reentrant",
        "nonReentrant",
        "transfer",
    ]
    for h in hints[:20]:
        h_lower = h.lower()
        if any(k in h_lower for k in keywords):
            selected.append(h[:200])
    if not selected:
        selected = [h[:200] for h in hints[:5]]
    return "; ".join(selected[:5])
