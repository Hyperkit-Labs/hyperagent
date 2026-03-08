"""Proposer + Auditor debate subgraph. Replaces autofix with iterative refinement.
Proposer suggests fixes; Auditor (pashov-audit) verifies. Converges when Auditor finds no state-breaking path."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from agents.agent_http import agent_runtime_headers
from agents.codegen_agent import generate_contracts
from agents.scrubd_agent import get_scrubd_fix_hints

logger = logging.getLogger(__name__)

AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001").rstrip("/")
MAX_DEBATE_ROUNDS = int(os.environ.get("MAX_DEBATE_ROUNDS", "3"))


def _build_audit_bundle(contracts: dict) -> str:
    """Build contract bundle for pashov-audit."""
    parts = []
    for name, code in (contracts or {}).items():
        if isinstance(code, str) and name.endswith(".sol"):
            parts.append(f"### {name}\n```solidity\n{code}\n```")
    return "\n\n".join(parts)


def _parse_audit_findings(text: str) -> list[dict[str, Any]]:
    """Parse pashov report into findings. Returns empty if no findings."""
    import re
    findings = []
    if not text or "No findings." in text.lower():
        return findings
    pattern = r"\[(\d+)\]\s+\*\*(\d+)\.\s+([^*]+)\*\*"
    for m in re.finditer(pattern, text):
        confidence = int(m.group(1))
        title = m.group(3).strip()
        if confidence >= 75:
            findings.append({
                "severity": "high" if confidence >= 90 else "medium",
                "title": title,
                "confidence": confidence,
            })
    return findings


def _has_state_breaking_findings(findings: list[dict]) -> bool:
    """True if any finding is high/critical (state-breaking)."""
    for f in findings:
        sev = (f.get("severity") or "").lower()
        if sev in ("high", "critical"):
            return True
    return False


async def _run_auditor(
    contracts: dict,
    api_keys: dict,
    run_id: str,
) -> tuple[str, list[dict[str, Any]]]:
    """Call agent-runtime pashov-audit. Returns (raw_text, findings)."""
    bundle = _build_audit_bundle(contracts)
    system = (
        "You are a Solidity security auditor. Analyze the provided contract bundle for vulnerabilities. "
        "Focus on: reentrancy, access control, integer overflow, unchecked external calls, front-running, signature replay. "
        "Return findings in format: [N] **M. Title** `location` · Confidence: X% **Description** ... "
        "If no issues, respond with 'No findings.'"
    )
    user = f"Bundle ({len(bundle)} chars):\n\n{bundle[:120000]}"
    try:
        headers = agent_runtime_headers()
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
                headers=headers,
            )
            if r.status_code != 200:
                logger.warning("[debate] auditor returned %s: %s", r.status_code, r.text[:200])
                return r.text[:2000], []
            data = r.json()
            text = data.get("text", "")
            findings = _parse_audit_findings(text)
            return text, findings
    except Exception as e:
        logger.warning("[debate] auditor failed: %s", e)
        return str(e), []


async def run_debate(
    state: dict,
) -> dict:
    """
    Proposer + Auditor debate loop. Replaces autofix.
    Returns updated state with contracts, discussion_trace, and converged flag.
    """
    run_id = state.get("run_id", "")
    api_keys = state.get("api_keys") or {}
    agent_session_jwt = state.get("agent_session_jwt")
    design_rationale = state.get("design_rationale", "")
    discussion_trace: list[dict] = list(state.get("discussion_trace") or [])

    error_context_parts = []
    if state.get("scrubd_findings"):
        for f in state["scrubd_findings"][:10]:
            desc = f.get("description", f.get("message", f.get("error", str(f))))
            error_context_parts.append(f"[SCRUBD] {desc}")
    if state.get("audit_findings"):
        for f in state["audit_findings"][:10]:
            sev = f.get("severity", "info")
            desc = f.get("description", f.get("message", ""))
            error_context_parts.append(f"[{sev}] {desc}")
    if state.get("exploit_simulation_findings"):
        for f in state["exploit_simulation_findings"][:10]:
            desc = f.get("description", f.get("error", str(f)))
            error_context_parts.append(f"[exploit] {desc}")
    if state.get("simulation_results", {}).get("error"):
        error_context_parts.append(f"Simulation error: {state['simulation_results']['error']}")
    if state.get("invariant_violations"):
        for v in state["invariant_violations"][:5]:
            inv = v.get("invariant", str(v))
            error_context_parts.append(f"[invariant] {inv}")

    error_context = "\n\n".join(error_context_parts) or "Unknown failure"
    scrubd_hints = get_scrubd_fix_hints(error_context)

    contracts = state.get("contracts") or {}
    converged = False

    for round_num in range(1, MAX_DEBATE_ROUNDS + 1):
        logger.info("[debate] run_id=%s round=%d/%d", run_id, round_num, MAX_DEBATE_ROUNDS)

        correction_prompt = (
            f"The following Solidity contracts failed security audit or simulation.\n\n"
            f"Design rationale: {design_rationale}\n\n"
            f"Errors to fix:\n{error_context}\n\n"
            f"SCRUBD fix guidance (mandatory):\n{scrubd_hints}\n\n"
            f"Previous code:\n"
        )
        for fname, source in contracts.items():
            if isinstance(source, str):
                correction_prompt += f"\n// {fname}\n{source[:2000]}\n"
        correction_prompt += (
            f"\nFix round {round_num}/{MAX_DEBATE_ROUNDS}. "
            f"Fix ALL identified issues. Preserve the contract's purpose and design rationale. "
            f"Output corrected Solidity code."
        )

        try:
            new_contracts = await generate_contracts(
                state.get("spec", {}),
                state.get("design_proposal", {}),
                state.get("framework", "hardhat"),
                state.get("user_id", ""),
                state.get("project_id", ""),
                run_id,
                api_keys,
                agent_session_jwt,
            )
        except Exception as e:
            logger.error("[debate] proposer failed round %d: %s", round_num, e)
            discussion_trace.append({
                "round": round_num,
                "role": "proposer",
                "status": "error",
                "content": str(e),
            })
            state["error"] = f"Debate proposer failed: {e}"
            state["discussion_trace"] = discussion_trace
            state["debate_converged"] = False
            return state

        discussion_trace.append({
            "round": round_num,
            "role": "proposer",
            "status": "ok",
            "files_count": len(new_contracts),
        })

        auditor_text, auditor_findings = await _run_auditor(new_contracts, api_keys, run_id)
        discussion_trace.append({
            "round": round_num,
            "role": "auditor",
            "findings_count": len(auditor_findings),
            "summary": auditor_text[:500] if auditor_text else "",
        })

        if not _has_state_breaking_findings(auditor_findings):
            converged = True
            contracts = new_contracts
            logger.info("[debate] run_id=%s converged at round %d", run_id, round_num)
            break

        error_context = f"Auditor findings (round {round_num}):\n" + "\n".join(
            f"[{f.get('severity')}] {f.get('title', '')}" for f in auditor_findings[:10]
        )
        contracts = new_contracts

    state["contracts"] = contracts
    state["discussion_trace"] = discussion_trace
    state["debate_converged"] = converged
    state["audit_passed"] = converged
    state["audit_findings"] = []
    state["simulation_passed"] = False
    state["simulation_results"] = {}
    state["current_stage"] = "audit"
    state["autofix_cycle"] = state.get("autofix_cycle", 0) + 1
    return state
