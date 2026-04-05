# Key concepts

This page defines the core terms used across HyperAgent documentation so the rest of the site can stay concise and consistent.

## Workflow

A workflow is a full contract-development run initiated by a user prompt and tracked through the orchestrator. A workflow can include specification, design, code generation, test generation, security validation, deployment preparation, simulation, and artifact generation.

Related docs:

- [Control plane: runs and steps](../control-plane/runs-and-steps.md)
- [Workflow state management](../control-plane/workflow-state-management.md)

## Run

A run is a concrete execution instance of a workflow. Runs are persisted in Supabase and broken down into step records so state, failure, and provenance can be inspected later.

## Step

A step is one pipeline stage within a run, such as `spec`, `design`, `codegen`, `audit`, or `simulation`. Step data is written to `run_steps` instead of being treated as ephemeral logs only.

## Contract artifact

A contract artifact is any generated or persisted output from a run, including Solidity source, ABI, bytecode, deployment plans, reports, and UI scaffolds.

## Template

A template is a reusable starting point or schema-backed artifact that helps generation and onboarding. Templates may come from curated contract patterns, OpenZeppelin Wizard output, registries, or future RAG-backed retrieval.

## BYOK

Bring Your Own Keys means users provide their own LLM provider credentials through the application instead of relying on server-owned model keys for user workloads.

Related docs:

- [User guide](../product/user-guide.md)
- [Payment and onboarding flow](../product/payment-onboarding-flow.md)

## x402

x402 is the external pay-per-call payment lane used for some API and agent requests. It is separate from internal prepaid credits used for workflow runs.

## Credits

Credits are the internal prepaid balance model used for workflow execution. Credits are usually topped up via USDC or USDT and then consumed per run.

## Chain registry

The chain registry is the config-as-data source of truth for supported networks, capabilities, explorers, and defaults. The orchestrator and deploy flows should read from the same registry data.

Related docs:

- [Network architecture](../architecture/networks.md)

## Deployment strategy

A deployment strategy is the mechanism used to publish a contract or deployment plan, such as wallet-signed deployment, gas-sponsored flows, x402-gated execution, or batch-style orchestration. Support varies by chain and environment.

## Agent runtime

The agent runtime is the TypeScript service exposing HTTP command endpoints for spec, design, code generation, test generation, autofix, and related agent actions. The orchestrator calls it as part of the broader workflow.

## Orchestrator

The orchestrator is the Python/FastAPI control plane that owns workflow state, routing, persistence, billing hooks, approval boundaries, and pipeline execution.
