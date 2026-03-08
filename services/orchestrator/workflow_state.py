"""AgentState for LangGraph and agent protocol."""
from typing import Annotated, Awaitable, Protocol, Sequence, TypedDict
from langchain_core.messages import BaseMessage
import operator


MAX_AUTOFIX_CYCLES = 3


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
