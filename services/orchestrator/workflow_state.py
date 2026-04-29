"""AgentState for LangGraph and agent protocol."""

import operator
from typing import Annotated, Awaitable, Protocol, Sequence, TypedDict

from langchain_core.messages import BaseMessage

MAX_AUTOFIX_CYCLES = 3

# Canonical pipeline stages. MUST be kept in sync with
# packages/workflow-state/src/pipeline-states.ts (PIPELINE_STAGES).
# A TS-side parity test in apps/api-gateway/src/pipelineStageParity.test.ts
# scans this file's set_current_stage call sites + every `current_stage = "..."`
# write across services/orchestrator/**/*.py and fails CI if a literal is not
# in this set. F-019.
PIPELINE_STAGES: frozenset[str] = frozenset(
    {
        "spec",
        "spec_review",
        "design",
        "design_review",
        "codegen",
        "audit",
        "audit_failed",
        "scrubd_failed",
        "simulation",
        "simulation_failed",
        "exploit_sim",
        "exploit_sim_failed",
        "security_failed",
        "deploy",
        "awaiting_deploy_approval",
        "deployed",
        "ui_scaffold",
        "human_review",
        "failed",
    }
)


def set_current_stage(state: "AgentState", stage: str) -> None:
    """Single canonical writer for AgentState['current_stage'].

    Raises ValueError when `stage` is not in PIPELINE_STAGES so a typo never
    silently strands the UI in `idle`. F-019.
    """
    if stage not in PIPELINE_STAGES:
        raise ValueError(
            f"unknown pipeline stage {stage!r}; expected one of "
            f"{sorted(PIPELINE_STAGES)}"
        )
    state["current_stage"] = stage


class AgentState(TypedDict, total=False):
    request_id: str
    user_prompt: str
    user_id: str
    project_id: str
    run_id: str
    pipeline_id: str
    api_keys: dict
    agent_session_jwt: str
    template_id: str
    use_oz_wizard: bool
    oz_wizard_options: dict
    spec: dict
    spec_approved: bool
    auto_approve: bool
    design_proposal: dict
    design_approved: bool
    design_rationale: str
    contracts: dict
    test_files: dict
    framework: str
    audit_findings: list
    audit_passed: bool
    scrubd_validation_passed: bool
    scrubd_findings: list
    simulation_results: dict
    simulation_passed: bool
    exploit_simulation_passed: bool
    exploit_simulation_findings: list
    deployments: list
    ui_schema: dict
    rag_context: dict
    messages: Annotated[Sequence[BaseMessage], operator.add]
    current_stage: str
    error: str | None
    needs_human_approval: bool
    # Autofix / debate loop state
    autofix_cycle: int
    autofix_history: list
    discussion_trace: list
    debate_converged: bool
    # Guardian invariant checks
    invariants: list
    invariant_violations: list
    # Complexity estimation
    estimated_complexity: str
    estimated_token_cost: int
    # Deploy human gate
    deploy_approved: bool
    needs_deploy_approval: bool


class AgentProtocol(Protocol):
    """Contract for pipeline nodes: async run(state) -> state. spec_agent, design_agent, etc. satisfy this."""

    def __call__(self, state: AgentState) -> Awaitable[AgentState]: ...
