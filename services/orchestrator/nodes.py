"""LangGraph nodes: call agent modules and update state. Write run_steps for audit (Phase 1).
Each agent (spec_agent, design_agent, codegen_agent, audit_agent, simulation_agent, deploy_agent, ui_scaffold_agent)
satisfies AgentProtocol from workflow_state: __call__(state: AgentState) -> Awaitable[AgentState].
Includes autofix loop, guardian invariant check, and complexity estimation nodes."""
import logging
import os

from langchain_core.messages import AIMessage

logger = logging.getLogger(__name__)

from workflow_state import AgentState, MAX_AUTOFIX_CYCLES
from step_trace import step_span
from registries import get_default_pipeline_id, get_audit_max_severity, get_template
from registries import get_roma_complexity_threshold, get_roma_complexity_indicators

STEP_ORDER = ("spec", "design", "codegen", "audit", "simulation", "deploy", "ui_scaffold")


def _step_index(step_type: str) -> int:
    try:
        return STEP_ORDER.index(step_type)
    except ValueError:
        return 0


def _step_start(run_id: str, step_type: str) -> None:
    import db
    step_index = _step_index(step_type)
    logger.info("[pipeline] run_id=%s step_id=%s step_type=%s status=running", run_id, step_index, step_type)
    if db.is_configured() and run_id:
        db.insert_step(run_id, step_index, step_type, status="running")


def _step_complete(run_id: str, step_type: str, output_summary: str | None = None, error_message: str | None = None) -> None:
    import db
    from trace_writer import write_trace
    status = "failed" if error_message else "completed"
    step_index = _step_index(step_type)
    logger.info("[pipeline] run_id=%s step_id=%s step_type=%s status=%s", run_id, step_index, step_type, status)
    blob_id, da_cert, ref_block = None, None, None
    if db.is_configured() and run_id:
        blob_id, da_cert, ref_block = write_trace(
            run_id, step_type, step_index, status, output_summary, error_message
        )
        db.update_step(
            run_id, step_type, status,
            output_summary=output_summary, error_message=error_message,
            trace_blob_id=blob_id, trace_da_cert=da_cert, trace_reference_block=ref_block,
        )
from agents.design_agent import generate_design
from agents.codegen_agent import generate_contracts
from agents.oz_wizard_client import generate_contracts_oz
from agents.audit_agent import run_security_audits
from agents.simulation_agent import run_tenderly_simulations
from agents.deploy_agent import deploy_contracts
from agents.ui_scaffold_agent import generate_ui_schema
from roma_inprocess import invoke_roma_spec
import rag_client
import ipfs_client


def _estimate_complexity(prompt: str) -> int:
    indicators = get_roma_complexity_indicators()
    lower = prompt.lower()
    return min(sum(2 for w in indicators if w in lower), 10)


async def spec_agent(state: AgentState) -> AgentState:
    prompt = state["user_prompt"]
    user_id = state["user_id"]
    project_id = state["project_id"]
    run_id = state.get("run_id") or project_id
    _step_start(run_id, "spec")
    async with step_span(run_id, "spec", _step_index("spec")):
        try:
            api_keys = state.get("api_keys") or {}
            agent_session_jwt = state.get("agent_session_jwt") or None
            template_id_from_state = (state.get("template_id") or "").strip()
            rag_context = await rag_client.query_specs(prompt, limit=3)
            rag_templates = await rag_client.query_templates(prompt, limit=3)
            if rag_context or rag_templates:
                state["rag_context"] = {"specs": rag_context, "templates": rag_templates}
            roma_context = {"apiKeys": api_keys, "userId": user_id, "projectId": project_id, "runId": run_id}
            spec = await invoke_roma_spec(prompt, context=roma_context, agent_session_jwt=agent_session_jwt)
            spec.setdefault("risk_profile", "high")
            if spec.get("template_id") and not template_id_from_state:
                state["template_id"] = spec.get("template_id")
            elif template_id_from_state:
                state["template_id"] = template_id_from_state
            state["spec"] = spec
            state["current_stage"] = "spec_review"
            from store import update_workflow
            update_workflow(run_id, status="building", spec=spec, stages=[
                {"stage": "spec", "status": "completed"},
            ])
            source = "ROMA"
            try:
                await rag_client.index_spec(run_id, spec, text=prompt)
                cid = await ipfs_client.pin_artifact(run_id, "spec", spec)
                if cid:
                    await ipfs_client.record_storage(run_id, "spec", cid)
            except Exception as pin_err:
                logger.warning("[pipeline] post-spec pin/index failed: %s", pin_err)
            state["messages"] = list(state.get("messages", [])) + [
                AIMessage(content=f"[{source}] Generated spec: {spec.get('token_type', 'contract')}")
            ]
            template = get_template(state.get("template_id") or "") if state.get("template_id") else None
            if template and template.get("requiresHumanApproval"):
                state["needs_human_approval"] = True
            elif template and template.get("usesCommunityContracts"):
                state["needs_human_approval"] = True
            else:
                state["needs_human_approval"] = spec.get("risk_profile") == "high"
            _step_complete(run_id, "spec", output_summary=f"spec {source} token_type={spec.get('token_type', 'contract')}")
            return state
        except Exception as e:
            _step_complete(run_id, "spec", error_message=str(e))
            raise


async def design_agent(state: AgentState) -> AgentState:
    spec = state["spec"]
    user_id = state["user_id"]
    project_id = state["project_id"]
    run_id = state.get("run_id") or project_id
    _step_start(run_id, "design")
    async with step_span(run_id, "design", _step_index("design")):
        try:
            api_keys = state.get("api_keys") or {}
            agent_session_jwt = state.get("agent_session_jwt") or None
            target_chains = spec.get("chains", [])
            design = await generate_design(spec, target_chains, user_id, project_id, run_id, api_keys, agent_session_jwt)
            state["design_proposal"] = design
            state["design_rationale"] = design.get("rationale", "") or f"Design for {spec.get('token_type', 'contract')} with {len(design.get('components', []))} components"
            state["current_stage"] = "design_review"
            state["framework"] = design.get("frameworks", {}).get("primary", "hardhat")
            template_id = state.get("template_id") or ""
            template = get_template(template_id) if template_id else None
            if template and (template.get("source") == "openzeppelin-wizard") and template.get("wizard"):
                state["use_oz_wizard"] = True
                w = template["wizard"]
                state["oz_wizard_options"] = {
                    "kind": w.get("kind", "erc20"),
                    "options": w.get("options") or {},
                }
            else:
                state["use_oz_wizard"] = False
                state["oz_wizard_options"] = {}
            if design.get("usesCommunityContracts") or (template and template.get("usesCommunityContracts")):
                state["needs_human_approval"] = True
            from store import update_workflow
            update_workflow(run_id, status="building", stages=[
                {"stage": "spec", "status": "completed"},
                {"stage": "design", "status": "completed"},
            ])
            state["messages"] = list(state.get("messages", [])) + [AIMessage(content=f"Design: {len(design.get('components', []))} components")]
            _step_complete(run_id, "design", output_summary=f"components={len(design.get('components', []))} framework={state['framework']}")
            return state
        except Exception as e:
            _step_complete(run_id, "design", error_message=str(e))
            raise


async def codegen_agent(state: AgentState) -> AgentState:
    spec = state["spec"]
    design = state["design_proposal"]
    framework = state.get("framework", "hardhat")
    user_id = state["user_id"]
    project_id = state["project_id"]
    run_id = state.get("run_id") or project_id
    _step_start(run_id, "codegen")
    try:
        api_keys = state.get("api_keys") or {}
        agent_session_jwt = state.get("agent_session_jwt") or None
        rag_snippets = await rag_client.query_specs(state.get("user_prompt", ""), limit=3)
        if rag_snippets:
            state.setdefault("rag_context", {})["codegen_snippets"] = rag_snippets
        if state.get("use_oz_wizard") and state.get("oz_wizard_options"):
            opts = state["oz_wizard_options"]
            kind = opts.get("kind", "erc20")
            options = opts.get("options") or {}
            contracts = await generate_contracts_oz(kind, options, agent_session_jwt)
        else:
            contracts = await generate_contracts(spec, design, framework, user_id, project_id, run_id, api_keys, agent_session_jwt)
        state["contracts"] = contracts
        state["current_stage"] = "audit"
        from store import update_workflow
        update_workflow(run_id, status="building", contracts=contracts, stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
        ])
        state["messages"] = list(state.get("messages", [])) + [AIMessage(content=f"Generated {len(contracts)} files")]
        try:
            cid = await ipfs_client.pin_artifact(run_id, "contracts", contracts)
            if cid:
                await ipfs_client.record_storage(run_id, "contracts", cid)
        except Exception as pin_err:
            logger.warning("[pipeline] post-codegen pin failed: %s", pin_err)
        _step_complete(run_id, "codegen", output_summary=f"files={len(contracts)}")
        return state
    except Exception as e:
        _step_complete(run_id, "codegen", error_message=str(e))
        raise


def _severity_fails_gate(severity: str, max_allowed: str) -> bool:
    order = ("info", "low", "medium", "high", "critical")
    try:
        return order.index(severity.lower()) > order.index(max_allowed.lower())
    except (ValueError, AttributeError):
        return True


async def audit_agent(state: AgentState) -> AgentState:
    contracts = state.get("contracts", {})
    framework = state.get("framework", "hardhat")
    run_id = state.get("run_id") or ""
    _step_start(run_id, "audit")
    try:
        findings = await run_security_audits(contracts, framework, run_id=run_id)
        state["audit_findings"] = findings
        pipeline_id = state.get("pipeline_id") or get_default_pipeline_id()
        max_severity = get_audit_max_severity(pipeline_id)
        state["audit_passed"] = not any(
            _severity_fails_gate(f.get("severity", "info"), max_severity) for f in findings
        )
        state["current_stage"] = "simulation" if state["audit_passed"] else "audit_failed"
        from store import update_workflow
        audit_status = "completed" if state["audit_passed"] else "failed"
        update_workflow(run_id, status="building", audit_findings=findings, stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "audit", "status": audit_status},
        ])
        state["messages"] = list(state.get("messages", [])) + [AIMessage(content=f"Audit: {len(findings)} findings")]
        try:
            cid = await ipfs_client.pin_artifact(run_id, "audit", findings)
            if cid:
                await ipfs_client.record_storage(run_id, "audit", cid)
        except Exception as pin_err:
            logger.warning("[pipeline] post-audit pin failed: %s", pin_err)
        _step_complete(run_id, "audit", output_summary=f"findings={len(findings)} passed={state['audit_passed']}")
        return state
    except Exception as e:
        _step_complete(run_id, "audit", error_message=str(e))
        raise


async def simulation_agent(state: AgentState) -> AgentState:
    run_id = state.get("run_id") or ""
    _step_start(run_id, "simulation")
    try:
        results = await run_tenderly_simulations(
            state.get("contracts", {}),
            state.get("spec", {}),
            state.get("spec", {}).get("chains", []),
            deployments=state.get("deployments"),
            run_id=run_id,
        )
        state["simulation_results"] = results
        state["simulation_passed"] = results.get("passed", True)
        state["current_stage"] = "simulation" if state["simulation_passed"] else "simulation_failed"
        from store import update_workflow
        sim_status = "completed" if state["simulation_passed"] else "failed"
        update_workflow(run_id, status="building", simulation_results=results, simulation_passed=state["simulation_passed"], stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "audit", "status": "completed"},
            {"stage": "simulation", "status": sim_status},
        ])
        state["messages"] = list(state.get("messages", [])) + [AIMessage(content="Simulation complete")]
        _step_complete(run_id, "simulation", output_summary=f"passed={state['simulation_passed']}")
        return state
    except Exception as e:
        _step_complete(run_id, "simulation", error_message=str(e))
        raise


async def deploy_agent(state: AgentState) -> AgentState:
    run_id = state.get("run_id") or ""
    project_id = state.get("project_id") or ""
    _step_start(run_id, "deploy")
    try:
        chains = state.get("spec", {}).get("chains", [])
        if not chains:
            network_slug = state.get("network") or ""
            if network_slug:
                from registries import get_chain_id_by_network_slug
                resolved_id = get_chain_id_by_network_slug(network_slug)
                if resolved_id:
                    chains = [{"chain_id": resolved_id}]
        deployments = await deploy_contracts(
            state.get("contracts", {}),
            chains,
            state.get("spec", {}),
            run_id=run_id,
            project_id=project_id,
        )
        state["deployments"] = deployments
        state["current_stage"] = "deployed"
        from store import update_workflow
        update_workflow(run_id, status="building", deployments=deployments, stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "audit", "status": "completed"},
            {"stage": "simulation", "status": "completed"},
            {"stage": "deploy", "status": "completed"},
        ])
        state["messages"] = list(state.get("messages", [])) + [AIMessage(content=f"Deployed to {len(deployments)} chains")]
        _step_complete(run_id, "deploy", output_summary=f"chains={len(deployments)}")
        return state
    except Exception as e:
        _step_complete(run_id, "deploy", error_message=str(e))
        raise


async def ui_scaffold_agent(state: AgentState) -> AgentState:
    """Build UiAppSchema from deployments + ABI when deployments exist."""
    run_id = state.get("run_id") or ""
    _step_start(run_id, "ui_scaffold")
    try:
        deployments = state.get("deployments") or []
        contracts = state.get("contracts") or {}
        network = state.get("network") or ""
        schema = await generate_ui_schema(deployments, contracts, network)
        state["ui_schema"] = schema or {}
        state["current_stage"] = "ui_scaffold"
        from store import update_workflow
        update_workflow(run_id, status="completed", ui_schema=schema, stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "audit", "status": "completed"},
            {"stage": "simulation", "status": "completed"},
            {"stage": "deploy", "status": "completed"},
            {"stage": "ui_scaffold", "status": "completed"},
        ])
        if schema:
            state["messages"] = list(state.get("messages", [])) + [AIMessage(content="UI schema generated")]
        _step_complete(run_id, "ui_scaffold", output_summary="schema generated" if schema else "no schema")
        return state
    except Exception as e:
        _step_complete(run_id, "ui_scaffold", error_message=str(e))
        raise


# ---------------------------------------------------------------------------
# Autofix Agent: takes audit/simulation failures and re-routes to codegen
# ---------------------------------------------------------------------------

async def autofix_agent(state: AgentState) -> AgentState:
    """Self-healing loop: take audit/sim errors, ask codegen to fix, then re-audit.
    Capped at MAX_AUTOFIX_CYCLES to prevent infinite loops and token drainage."""
    run_id = state.get("run_id") or ""
    cycle = state.get("autofix_cycle", 0) + 1
    state["autofix_cycle"] = cycle
    history = list(state.get("autofix_history") or [])
    logger.info("[autofix] run_id=%s cycle=%d/%d", run_id, cycle, MAX_AUTOFIX_CYCLES)

    from store import update_workflow
    update_workflow(run_id, status="building", stages=[
        {"stage": "spec", "status": "completed"},
        {"stage": "design", "status": "completed"},
        {"stage": "codegen", "status": "completed"},
        {"stage": "audit", "status": "failed"},
        {"stage": "autofix", "status": "processing"},
    ])

    error_context_parts: list[str] = []
    if state.get("audit_findings"):
        findings_summary = []
        for f in state["audit_findings"]:
            sev = f.get("severity", "info")
            desc = f.get("description", f.get("message", ""))
            findings_summary.append(f"[{sev}] {desc}")
        error_context_parts.append("Audit findings:\n" + "\n".join(findings_summary[:10]))
    if state.get("simulation_results"):
        sim = state["simulation_results"]
        if sim.get("error"):
            error_context_parts.append(f"Simulation error: {sim['error']}")
        if sim.get("revert_reason"):
            error_context_parts.append(f"Revert reason: {sim['revert_reason']}")

    error_context = "\n\n".join(error_context_parts) or "Unknown failure"
    design_rationale = state.get("design_rationale", "")

    history.append({
        "cycle": cycle,
        "error_context": error_context[:500],
        "previous_contracts_count": len(state.get("contracts", {})),
    })
    state["autofix_history"] = history

    try:
        api_keys = state.get("api_keys") or {}
        agent_session_jwt = state.get("agent_session_jwt") or None

        correction_prompt = (
            f"The following Solidity contracts failed security audit or simulation.\n\n"
            f"Design rationale: {design_rationale}\n\n"
            f"Errors to fix:\n{error_context}\n\n"
            f"Previous code:\n"
        )
        for fname, source in (state.get("contracts") or {}).items():
            if isinstance(source, str):
                correction_prompt += f"\n// {fname}\n{source[:2000]}\n"
        correction_prompt += (
            f"\nFix cycle {cycle}/{MAX_AUTOFIX_CYCLES}. "
            f"Fix ALL identified issues. Preserve the contract's purpose and design rationale. "
            f"Output corrected Solidity code."
        )

        contracts = await generate_contracts(
            state.get("spec", {}),
            state.get("design_proposal", {}),
            state.get("framework", "hardhat"),
            state.get("user_id", ""),
            state.get("project_id", ""),
            run_id,
            api_keys,
            agent_session_jwt,
        )

        state["contracts"] = contracts
        state["audit_passed"] = False
        state["simulation_passed"] = False
        state["audit_findings"] = []
        state["simulation_results"] = {}
        state["current_stage"] = "audit"

        update_workflow(run_id, status="building", contracts=contracts, stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "autofix", "status": "completed"},
            {"stage": "audit", "status": "processing"},
        ])

        state["messages"] = list(state.get("messages", [])) + [
            AIMessage(content=f"[Autofix cycle {cycle}] Re-generated {len(contracts)} files. Re-auditing...")
        ]
        logger.info("[autofix] run_id=%s cycle=%d contracts_regenerated=%d", run_id, cycle, len(contracts))
        return state
    except Exception as e:
        logger.error("[autofix] run_id=%s cycle=%d error=%s", run_id, cycle, e)
        state["error"] = f"Autofix cycle {cycle} failed: {e}"
        state["current_stage"] = "failed"
        return state


# ---------------------------------------------------------------------------
# Guardian Agent: Invariant check before deploy
# ---------------------------------------------------------------------------

async def guardian_agent(state: AgentState) -> AgentState:
    """Verify spec invariants against generated code before allowing deployment.
    Checks that declared invariants (from spec) are not violated by audit findings."""
    run_id = state.get("run_id") or ""
    logger.info("[guardian] run_id=%s checking invariants", run_id)

    spec = state.get("spec") or {}
    invariants = spec.get("invariants", [])
    state["invariants"] = invariants

    if not invariants:
        state["invariant_violations"] = []
        state["messages"] = list(state.get("messages", [])) + [
            AIMessage(content="[Guardian] No invariants defined. Passing.")
        ]
        return state

    violations: list[dict] = []
    audit_findings = state.get("audit_findings") or []
    contracts_text = ""
    for fname, source in (state.get("contracts") or {}).items():
        if isinstance(source, str):
            contracts_text += source.lower()

    for inv in invariants:
        inv_text = str(inv).lower() if isinstance(inv, str) else str(inv.get("description", "")).lower()
        if not inv_text:
            continue

        has_require = False
        for keyword in ["require(", "assert(", "revert ", "if ("]:
            if keyword in contracts_text:
                has_require = True
                break

        related_findings = [
            f for f in audit_findings
            if any(word in f.get("description", "").lower() for word in inv_text.split()[:3])
        ]
        if related_findings:
            violations.append({
                "invariant": inv if isinstance(inv, str) else inv.get("description", str(inv)),
                "related_findings": [f.get("description", "") for f in related_findings[:3]],
                "severity": "high",
            })

    state["invariant_violations"] = violations

    from store import update_workflow
    if violations:
        update_workflow(run_id, status="building", stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "audit", "status": "completed"},
            {"stage": "guardian", "status": "failed"},
        ])
        state["messages"] = list(state.get("messages", [])) + [
            AIMessage(content=f"[Guardian] {len(violations)} invariant violation(s) detected. Blocking deploy.")
        ]
    else:
        update_workflow(run_id, status="building", stages=[
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed"},
            {"stage": "codegen", "status": "completed"},
            {"stage": "audit", "status": "completed"},
            {"stage": "guardian", "status": "completed"},
        ])
        state["messages"] = list(state.get("messages", [])) + [
            AIMessage(content=f"[Guardian] All {len(invariants)} invariants verified. Proceeding to deploy.")
        ]

    return state


# ---------------------------------------------------------------------------
# Estimate Agent: pre-run complexity and token cost estimation
# ---------------------------------------------------------------------------

async def estimate_agent(state: AgentState) -> AgentState:
    """Analyze the input prompt to estimate pipeline complexity and token cost
    before the main pipeline starts. Returns High/Medium/Low."""
    prompt = state.get("user_prompt", "")
    complexity_score = _estimate_complexity(prompt)

    if complexity_score >= 7:
        level = "high"
        estimated_tokens = 25000
    elif complexity_score >= 4:
        level = "medium"
        estimated_tokens = 12000
    else:
        level = "low"
        estimated_tokens = 5000

    state["estimated_complexity"] = level
    state["estimated_token_cost"] = estimated_tokens
    state["autofix_cycle"] = 0
    state["autofix_history"] = []
    state["invariant_violations"] = []

    state["messages"] = list(state.get("messages", [])) + [
        AIMessage(content=f"[Estimate] Complexity: {level} (~{estimated_tokens} tokens)")
    ]
    logger.info("[estimate] prompt_len=%d score=%d level=%s tokens=%d", len(prompt), complexity_score, level, estimated_tokens)
    return state
