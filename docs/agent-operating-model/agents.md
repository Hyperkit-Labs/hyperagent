# Agents

Agents are specialized reasoning and execution roles within the agent operating system.

## Definition

An agent is a named entity with a defined role, capabilities, constraints, and delegation rules. Agents process inputs according to their role-specific instructions and produce structured outputs. They do not own persistent state or task lifecycle.

## Responsibilities

- Specialized reasoning within a bounded domain
- Input/output constraint enforcement
- Delegation to subagents when authorized
- Role-specific prompt and instruction management

## Boundaries

Agents must not:

- Mix agent definitions with task execution code
- Own task lifecycle (tasks track agents, not the reverse)
- Bypass permission policies
- Mutate state outside their designated domain

## Agent roles

Each agent role is defined by `AgentRole` in `packages/agent-os/src/agentContract.ts`:

| Field | Type | Required | Description |
|---|---|---|---|
| id | string | yes | Unique agent identifier |
| name | string | yes | Human-readable agent name |
| description | string | yes | What this agent does |
| allowedTools | string[] | yes | Tools this agent may invoke |
| maxTurns | number | yes | Upper bound on conversation turns |
| delegationRules | DelegationRule[] | no | Which agents this agent may delegate to |
| capabilities | AgentCapability[] | no | Fine-grained capability declarations |

## Delegation

Agents may delegate work to other agents under strict rules:

- Only agents listed in `delegationRules.allowedTargets` may receive delegated work
- Delegation depth is bounded by `delegationRules.maxDepth`
- The `canDelegate(from, targetAgentId, currentDepth)` function enforces these limits

## Pipeline agents

The canonical EVM pipeline uses these agents in sequence:

| Agent | Domain | Inputs | Outputs |
|---|---|---|---|
| SpecAgent | Specification | Natural language | Structured spec |
| DesignAgent | Architecture | Spec | Design proposal |
| CodegenAgent | Code generation | Spec + design | Solidity source |
| AuditAgent | Security | Source code | Audit findings |
| TenderlySimAgent | Simulation | Compiled contract | Simulation results |
| DeployAgent | Deployment | Verified contract | Deployment receipt |
| MonitorAgent | Monitoring | Deployed address | Health status |

## Validation

Agent roles are validated at registration using `validateAgentRole()`:

- id, name, description must be non-empty strings
- allowedTools must be a non-empty array
- maxTurns must be a positive integer
- delegationRules targets must reference known agent ids

## Adding an agent

1. Define the AgentRole with all required fields
2. Validate using `validateAgentRole()`
3. Register with the agent orchestrator
4. Document the agent's domain, inputs, outputs, and failure modes

---

**Index:** [Agent operating model](README.md)
