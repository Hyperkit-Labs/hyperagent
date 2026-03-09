"""Build security context for design and codegen agents.
Aggregates threats, SCV patterns, and OWASP constraints for prompt injection."""
from __future__ import annotations

from typing import Any

import rag_client
from security_feed import fetch_recent_exploits, format_threats_prompt

OWASP_TOP10_2025 = [
    "Access Control Vulnerabilities",
    "Reentrancy",
    "Oracle Manipulation",
    "Unchecked External Calls",
    "Front-Running and MEV",
    "Signature Replay",
    "Integer Overflow/Underflow",
    "Denial of Service",
    "Weak Randomness",
    "Upgradeable Contract Risks",
]


async def build_security_context(prompt: str, user_id: str | None = None) -> dict[str, Any]:
    """Build security context for design and codegen prompts.
    Returns threatsSummary, scvPatterns, owaspConstraints.
    When user_id is set, RAG queries may prioritize tenant-scoped advisories."""
    threats_summary = ""
    scv_patterns = ""
    owasp_constraints = "; ".join(OWASP_TOP10_2025)

    try:
        exploits = await fetch_recent_exploits()
        threats_summary = format_threats_prompt(exploits)
    except Exception:
        pass

    try:
        advisories = await rag_client.query_security_advisories(prompt, limit=5, user_id=user_id)
        if advisories and not threats_summary:
            parts = []
            for r in advisories[:5]:
                payload = r.get("payload") or {}
                spec = payload.get("spec") or payload
                title = spec.get("title", spec.get("text_preview", ""))[:100]
                if title:
                    parts.append(f"- {title}")
            if parts:
                threats_summary = "Recent advisories:\n" + "\n".join(parts)
    except Exception:
        pass

    try:
        scv_results = await rag_client.query_scv_patterns(prompt, limit=5, user_id=user_id)
        if scv_results:
            parts = []
            for r in scv_results[:5]:
                payload = r.get("payload") or {}
                spec = payload.get("spec") or payload
                cat = spec.get("category", spec.get("title", ""))
                sev = spec.get("severity", "")
                if cat:
                    parts.append(f"- [{sev}] {cat}")
            if parts:
                scv_patterns = "\n".join(parts)
    except Exception:
        pass

    return {
        "threatsSummary": threats_summary or "No recent threats loaded.",
        "scvPatterns": scv_patterns or "No SCV patterns loaded. Run scv_sync to index.",
        "owaspConstraints": owasp_constraints,
    }
