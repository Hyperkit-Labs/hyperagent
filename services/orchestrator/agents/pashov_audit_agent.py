"""Pashov solidity-auditor integration: AI-driven security review using attack vectors.
Uses pashov/skills solidity-auditor references for pre-deployment safety gates.
Set PASHOV_AUDIT_ENABLED=true to enable. Requires packages/pashov-skills submodule."""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

PASHOV_AUDIT_ENABLED = os.environ.get("PASHOV_AUDIT_ENABLED", "false").strip().lower() in ("1", "true", "yes")
AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001").rstrip("/")
PASHOV_SKILLS_PATH = os.environ.get(
    "PASHOV_SKILLS_PATH",
    str(Path(__file__).resolve().parent.parent.parent.parent / "packages" / "pashov-skills" / "solidity-auditor"),
)


def _load_pashov_refs() -> tuple[str, str, str, str] | None:
    """Load vector-scan-agent, judging, report-formatting, attack-vectors-1. Returns None if path missing."""
    base = Path(PASHOV_SKILLS_PATH)
    refs = base / "references"
    if not refs.exists():
        logger.warning("[pashov] references not found at %s", refs)
        return None

    files = [
        refs / "agents" / "vector-scan-agent.md",
        refs / "judging.md",
        refs / "report-formatting.md",
        refs / "attack-vectors" / "attack-vectors-1.md",
    ]
    parts: list[str] = []
    for f in files:
        if not f.exists():
            logger.warning("[pashov] missing %s", f)
            return None
        parts.append(f.read_text(encoding="utf-8", errors="replace"))
    return tuple(parts)


def _build_bundle(contracts: dict, vector_agent: str, judging: str, report_fmt: str, attack_vectors: str) -> str:
    """Build the audit bundle: contracts + judging + report-formatting + attack vectors."""
    contracts_section = []
    for name, code in (contracts or {}).items():
        if isinstance(code, str) and name.endswith(".sol"):
            contracts_section.append(f"### {name}\n```solidity\n{code}\n```")
    bundle = "\n\n".join(contracts_section)
    bundle += f"\n\n---\n\n# Judging\n{judging}\n\n---\n\n# Report Formatting\n{report_fmt}\n\n---\n\n# Attack Vectors\n{attack_vectors}"
    return bundle


def _parse_findings(text: str) -> list[dict[str, Any]]:
    """Parse pashov report output into findings list."""
    findings: list[dict[str, Any]] = []
    if not text or "No findings." in text:
        return findings

    # Match [95] **1. Title** and **Description** / **Fix** blocks
    pattern = r"\[(\d+)\]\s+\*\*(\d+)\.\s+([^*]+)\*\*\s*\n+`([^`]+)`\s*·\s*Confidence:\s*\d+.*?\*\*Description\*\*\s*\n+([^*\n]+)"
    for m in re.finditer(pattern, text, re.DOTALL):
        confidence = int(m.group(1))
        title = m.group(3).strip()
        location = m.group(4).strip()
        description = m.group(5).strip()
        if confidence >= 75:
            findings.append({
                "tool": "pashov-auditor",
                "severity": "high" if confidence >= 90 else "medium",
                "title": title,
                "description": description,
                "location": location,
                "category": "pashov",
                "confidence": confidence,
            })
    return findings


async def run_pashov_audit(
    contracts: dict,
    api_keys: dict,
    run_id: str = "",
) -> tuple[list[dict[str, Any]], bool]:
    """Run Pashov AI audit. Returns (findings, success). Success=False if disabled or refs missing."""
    if not PASHOV_AUDIT_ENABLED:
        return [], True

    refs = _load_pashov_refs()
    if not refs:
        return [], True

    vector_agent, judging, report_fmt, attack_vectors = refs
    bundle = _build_bundle(contracts, vector_agent, judging, report_fmt, attack_vectors)

    system = (
        f"{vector_agent}\n\n---\n\nYour bundle is provided below. "
        "Analyze it and return your findings in the report format. No file reads needed."
    )
    user = f"Bundle ({len(bundle)} chars):\n\n{bundle[:120000]}"

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(
                f"{AGENT_RUNTIME_URL}/agents/pashov-audit",
                json={
                    "systemPrompt": system,
                    "userPrompt": user,
                    "context": {
                        "userId": "",
                        "projectId": "",
                        "runId": run_id,
                        "apiKeys": api_keys or {},
                    },
                },
            )
            if r.status_code != 200:
                logger.warning("[pashov] agent-runtime returned %s: %s", r.status_code, r.text[:200])
                return [], True
            data = r.json()
            text = data.get("text", "")
    except Exception as e:
        logger.warning("[pashov] audit failed: %s", e)
        return [], True

    findings = _parse_findings(text)
    logger.info("[pashov] run_id=%s findings=%d", run_id, len(findings))
    return findings, True
