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

x402 is the intended payment wall for supported v0.1.0 user flows on SKALE Base Mainnet and SKALE Base Sepolia. If the repo still exposes credits-first or env-disabled x402 behavior, that is an implementation gap rather than an intended product mode.

## Credits

Credits are legacy prepaid terminology that still appears in parts of the repo. Until billing surfaces are fully aligned, treat credits copy as transitional implementation residue rather than as a separate supported billing contract for v0.1.0.

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
