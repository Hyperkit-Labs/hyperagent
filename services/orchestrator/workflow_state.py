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
    framework: str
    audit_findings: list
    audit_passed: bool
    simulation_results: dict
    simulation_passed: bool
    deployments: list
    ui_schema: dict
    rag_context: dict
    messages: Annotated[Sequence[BaseMessage], operator.add]
    current_stage: str
    error: str | None
    needs_human_approval: bool
    # Autofix loop state
    autofix_cycle: int
    autofix_history: list
    # Guardian invariant checks
    invariants: list
    invariant_violations: list
    # Complexity estimation
    estimated_complexity: str
    estimated_token_cost: int


class AgentProtocol(Protocol):
    """Contract for pipeline nodes: async run(state) -> state. spec_agent, design_agent, etc. satisfy this."""

    def __call__(self, state: AgentState) -> Awaitable[AgentState]: ...
