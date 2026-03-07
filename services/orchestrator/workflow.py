"""
LangGraph workflow with self-healing autofix loop, guardian invariant checks,
and pre-run complexity estimation.

Flow:
  start -> estimate -> spec -> [human_review | design] -> codegen -> audit
    -> [guardian -> deploy -> simulation -> ui_scaffold -> END]
    or [autofix (up to MAX_AUTOFIX_CYCLES) -> audit -> ...]
    or [END (failed)]
"""
from typing import Annotated, Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, StateGraph
from langgraph.checkpoint.memory import MemorySaver
import operator

from registries import get_default_pipeline_id
from workflow_state import AgentState, MAX_AUTOFIX_CYCLES
from nodes import (
    spec_agent,
    design_agent,
    codegen_agent,
    audit_agent,
    simulation_agent,
    deploy_agent,
    ui_scaffold_agent,
    autofix_agent,
    guardian_agent,
    estimate_agent,
)


def _start_router(state: AgentState) -> str:
    """Route to design when resuming after spec approval; else to estimate."""
    if state.get("spec_approved") and state.get("spec"):
        return "design"
    return "estimate"


def _should_approve_spec(state: AgentState) -> str:
    if state.get("auto_approve"):
        return "design"
    if state.get("needs_human_approval"):
        return "human_review"
    return "design"


def _after_audit(state: AgentState) -> str:
    """Route after audit: pass -> guardian, fail -> autofix (if cycles remain) or END."""
    if state.get("audit_passed", True):
        return "guardian"
    cycle = state.get("autofix_cycle", 0)
    if cycle < MAX_AUTOFIX_CYCLES:
        return "autofix"
    return "failed"


def _after_simulation(state: AgentState) -> str:
    """Route after simulation: pass -> ui_scaffold, fail -> autofix (if cycles remain) or END."""
    if state.get("simulation_passed", True):
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
    workflow.add_node("design", design_agent)
    workflow.add_node("codegen", codegen_agent)
    workflow.add_node("audit", audit_agent)
    workflow.add_node("autofix", autofix_agent)
    workflow.add_node("guardian", guardian_agent)
    workflow.add_node("simulation", simulation_agent)
    workflow.add_node("deploy", deploy_agent)
    workflow.add_node("ui_scaffold", ui_scaffold_agent)

    workflow.set_entry_point("start")
    workflow.add_conditional_edges("start", _start_router, {
        "estimate": "estimate",
        "design": "design",
    })
    workflow.add_edge("estimate", "spec")
    workflow.add_conditional_edges("spec", _should_approve_spec, {
        "human_review": END,
        "design": "design",
    })
    workflow.add_edge("design", "codegen")
    workflow.add_edge("codegen", "audit")
    workflow.add_conditional_edges("audit", _after_audit, {
        "guardian": "guardian",
        "autofix": "autofix",
        "failed": END,
    })
    workflow.add_edge("autofix", "audit")
    workflow.add_conditional_edges("guardian", _after_guardian, {
        "deploy": "deploy",
        "autofix": "autofix",
        "failed": END,
    })
    workflow.add_edge("deploy", "simulation")
    workflow.add_conditional_edges("simulation", _after_simulation, {
        "ui_scaffold": "ui_scaffold",
        "autofix": "autofix",
        "failed": END,
    })
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
            logging.getLogger(__name__).warning("Redis checkpointer unavailable, falling back to MemorySaver: %s", e)
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
) -> dict:
    import asyncio
    pipeline_id = pipeline_id or get_default_pipeline_id()
    memory = _get_checkpointer()
    graph = create_workflow().compile(checkpointer=memory)
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
            "invariants": [],
            "invariant_violations": [],
            "estimated_complexity": "",
            "estimated_token_cost": 0,
        }
    if initial_state_override:
        initial.update(initial_state_override)
    config = {"configurable": {"thread_id": run_id}}
    try:
        if checkpoint_id:
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
