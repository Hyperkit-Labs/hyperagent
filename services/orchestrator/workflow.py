"""
LangGraph workflow with self-healing autofix loop, guardian invariant checks,
and pre-run complexity estimation.

Flow:
  start -> estimate -> spec -> [human_review | design] -> codegen -> audit
    -> [guardian -> deploy -> simulation -> ui_scaffold -> END]
    or [autofix (up to MAX_AUTOFIX_CYCLES) -> audit -> ...]
    or [END (failed)]
"""


from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from nodes import (
    audit_agent,
    autofix_agent,
    codegen_agent,
    deploy_agent,
    deploy_gate_agent,
    design_agent,
    estimate_agent,
    exploit_simulation_agent,
    guardian_agent,
    human_review_agent,
    scrubd_validation_agent,
    security_gate_agent,
    security_policy_evaluator_agent,
    simulation_agent,
    spec_agent,
    test_generation_agent,
    ui_scaffold_agent,
)
from registries import get_default_pipeline_id
from workflow_state import MAX_AUTOFIX_CYCLES, AgentState


def _start_router(state: AgentState) -> str:
    """Route to design when resuming after spec approval; to deploy when resuming deploy approval (hybrid state); else estimate."""
    if state.get("deploy_approved") and state.get("contracts"):
        return "deploy"
    if state.get("spec_approved") and state.get("spec"):
        return "design"
    return "estimate"


def _should_approve_spec(state: AgentState) -> str:
    if state.get("auto_approve"):
        return "design"
    if state.get("needs_human_approval"):
        return "human_review"
    return "design"


def _after_scrubd(state: AgentState) -> str:
    """Route after SCRUBD: pass -> audit, fail -> autofix (if cycles remain) or END."""
    if state.get("scrubd_validation_passed", True):
        return "audit"
    cycle = state.get("autofix_cycle", 0)
    if cycle < MAX_AUTOFIX_CYCLES:
        return "autofix"
    return "failed"


def _after_audit(state: AgentState) -> str:
    """Route after audit: pass -> guardian, fail -> autofix (if cycles remain) or END."""
    if state.get("audit_passed", True):
        return "guardian"
    cycle = state.get("autofix_cycle", 0)
    if cycle < MAX_AUTOFIX_CYCLES:
        return "autofix"
    return "failed"


def _after_simulation(state: AgentState) -> str:
    """Route after simulation: pass -> security_policy_evaluator, fail -> autofix or END."""
    if state.get("simulation_passed", True):
        return "security_policy_evaluator"
    cycle = state.get("autofix_cycle", 0)
    if cycle < MAX_AUTOFIX_CYCLES:
        return "autofix"
    return "failed"


def _after_security_policy_evaluator(state: AgentState) -> str:
    """Route after security policy evaluator: approved -> exploit_simulation, else failed."""
    if state.get("security_approved_for_deploy", False):
        return "exploit_simulation"
    return "failed"


def _after_exploit_simulation(state: AgentState) -> str:
    """Route after exploit simulation: pass -> ui_scaffold, fail -> autofix (if cycles remain) or END.
    ZSPS: Missing state defaults to failure."""
    if state.get("exploit_simulation_passed", False):
        return "ui_scaffold"
    cycle = state.get("autofix_cycle", 0)
    if cycle < MAX_AUTOFIX_CYCLES:
        return "autofix"
    return "failed"


def _after_guardian(state: AgentState) -> str:
    """Route after guardian: no violations -> deploy, violations -> autofix or END."""
    violations = state.get("invariant_violations") or []
    if not violations:
        return "deploy"
    cycle = state.get("autofix_cycle", 0)
    if cycle < MAX_AUTOFIX_CYCLES:
        return "autofix"
    return "failed"


def create_workflow():
    workflow = StateGraph(AgentState)

    workflow.add_node("start", lambda s: s)
    workflow.add_node("estimate", estimate_agent)
    workflow.add_node("spec", spec_agent)
    workflow.add_node("human_review", human_review_agent)
    workflow.add_node("design", design_agent)
    workflow.add_node("codegen", codegen_agent)
    workflow.add_node("test_generation", test_generation_agent)
    workflow.add_node("scrubd_validation", scrubd_validation_agent)
    workflow.add_node("audit", audit_agent)
    workflow.add_node("autofix", autofix_agent)
    workflow.add_node("guardian", guardian_agent)
    workflow.add_node("security_gate", security_gate_agent)
    workflow.add_node("deploy_gate", deploy_gate_agent)
    workflow.add_node("simulation", simulation_agent)
    workflow.add_node("security_policy_evaluator", security_policy_evaluator_agent)
    workflow.add_node("exploit_simulation", exploit_simulation_agent)
    workflow.add_node("deploy", deploy_agent)
    workflow.add_node("ui_scaffold", ui_scaffold_agent)

    workflow.set_entry_point("start")
    workflow.add_conditional_edges(
        "start",
        _start_router,
        {
            "estimate": "estimate",
            "design": "design",
            "deploy": "deploy",
        },
    )
    workflow.add_edge("estimate", "spec")
    workflow.add_conditional_edges(
        "spec",
        _should_approve_spec,
        {
            "human_review": "human_review",
            "design": "design",
        },
    )
    workflow.add_edge("human_review", END)
    workflow.add_edge("design", "codegen")
    workflow.add_edge("codegen", "security_gate")
    workflow.add_edge("security_gate", "test_generation")
    workflow.add_edge("test_generation", "scrubd_validation")
    workflow.add_conditional_edges(
        "scrubd_validation",
        _after_scrubd,
        {
            "audit": "audit",
            "autofix": "autofix",
            "failed": END,
        },
    )
    workflow.add_conditional_edges(
        "audit",
        _after_audit,
        {
            "guardian": "guardian",
            "autofix": "autofix",
            "failed": END,
        },
    )
    workflow.add_edge("autofix", "scrubd_validation")
    workflow.add_conditional_edges(
        "guardian",
        _after_guardian,
        {
            "deploy": "deploy_gate",
            "autofix": "autofix",
            "failed": END,
        },
    )
    workflow.add_edge("deploy_gate", "deploy")
    workflow.add_edge("deploy", "simulation")
    workflow.add_conditional_edges(
        "simulation",
        _after_simulation,
        {
            "security_policy_evaluator": "security_policy_evaluator",
            "autofix": "autofix",
            "failed": END,
        },
    )
    workflow.add_conditional_edges(
        "security_policy_evaluator",
        _after_security_policy_evaluator,
        {
            "exploit_simulation": "exploit_simulation",
            "failed": END,
        },
    )
    workflow.add_conditional_edges(
        "exploit_simulation",
        _after_exploit_simulation,
        {
            "ui_scaffold": "ui_scaffold",
            "autofix": "autofix",
            "failed": END,
        },
    )
    workflow.add_edge("ui_scaffold", END)

    return workflow


def _get_checkpointer():
    """Return Redis-backed checkpointer if REDIS_URL is set, else MemorySaver."""
    import os

    redis_url = (os.environ.get("REDIS_URL") or "").strip()
    if redis_url:
        try:
            from langgraph.checkpoint.redis import RedisSaver

            return RedisSaver(redis_url)
        except (ImportError, Exception) as e:
            import logging

            logging.getLogger(__name__).warning(
                "Redis checkpointer unavailable, falling back to MemorySaver: %s", e
            )
    return MemorySaver()


def run_pipeline(
    user_prompt: str,
    user_id: str,
    project_id: str,
    run_id: str,
    api_keys: dict,
    pipeline_id: str | None = None,
    checkpoint_id: str | None = None,
    agent_session_jwt: str | None = None,
    template_id: str | None = None,
    request_id: str | None = None,
    initial_state: dict | None = None,
    initial_state_override: dict | None = None,
    resume_update: dict | None = None,
) -> dict:
    import asyncio

    pipeline_id = pipeline_id or get_default_pipeline_id()
    memory = _get_checkpointer()
    graph = create_workflow().compile(checkpointer=memory, interrupt_before=["deploy"])
    if initial_state is not None:
        initial = initial_state
    else:
        initial = {
            "request_id": request_id or "",
            "user_prompt": user_prompt,
            "user_id": user_id,
            "project_id": project_id,
            "run_id": run_id,
            "pipeline_id": pipeline_id,
            "api_keys": api_keys or {},
            "agent_session_jwt": agent_session_jwt or "",
            "template_id": template_id or "",
            "network": "",
            "use_oz_wizard": False,
            "oz_wizard_options": {},
            "spec": {},
            "spec_approved": False,
            "auto_approve": False,
            "design_proposal": {},
            "design_approved": False,
            "design_rationale": "",
            "contracts": {},
            "test_files": {},
            "framework": "hardhat",
            "audit_findings": [],
            "audit_passed": False,
            "simulation_results": {},
            "simulation_passed": False,
            "deployments": [],
            "ui_schema": {},
            "rag_context": {},
            "messages": [HumanMessage(content=user_prompt)],
            "current_stage": "spec",
            "error": None,
            "needs_human_approval": False,
            "autofix_cycle": 0,
            "autofix_history": [],
            "discussion_trace": [],
            "debate_converged": False,
            "invariants": [],
            "invariant_violations": [],
            "estimated_complexity": "",
            "estimated_token_cost": 0,
            "deploy_approved": False,
            "needs_deploy_approval": False,
        }
    if initial_state_override:
        initial.update(initial_state_override)
    import logging

    logging.getLogger(__name__).info(
        "[pipeline] run_pipeline start run_id=%s api_keys_providers=%s agent_session_jwt=%s",
        run_id,
        list(initial.get("api_keys") or {}).keys(),
        "yes" if initial.get("agent_session_jwt") else "no",
    )
    config = {"configurable": {"thread_id": run_id}}
    try:
        if checkpoint_id and resume_update:
            final = asyncio.run(graph.ainvoke(resume_update, config=config))
        elif checkpoint_id:
            final = asyncio.run(graph.ainvoke(None, config=config))
        else:
            final = asyncio.run(graph.ainvoke(initial, config=config))
        return final
    except Exception as e:
        err_msg = str(e)
        failed_state = initial.copy()
        failed_state["error"] = err_msg
        failed_state["current_stage"] = "failed"
        return failed_state
