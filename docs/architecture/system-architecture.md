# System architecture

HyperAgent is a mixed-language monorepo built around a service-oriented control plane for AI-assisted smart contract workflows.

## High-level shape

The production path is centered on three layers:

1. Client surfaces
2. Control plane and agent orchestration
3. Specialized execution and persistence services

## Client surfaces

- `apps/studio` is the main user-facing Next.js application
- `apps/api-gateway` is the public API edge that handles auth, rate limiting, metering, and proxying

## Control plane

- `services/orchestrator` is the Python/FastAPI control plane
- It owns workflow creation, run state, pipeline routing, approvals, persistence hooks, and policy enforcement
- It calls specialized services rather than embedding every concern locally

## Specialized services

Current service families include:

- Agent execution: `services/agent-runtime`
- Compilation: `services/compile`
- Security auditing: `services/audit`
- Deployment, simulation, and storage services
- Context and vector services for memory and retrieval paths

Some services are more production-ready than others today, so capability claims should always be read alongside the [capability truth table](../control-plane/capability-truth-table.md).

## Shared libraries

Shared TypeScript packages under `packages/` provide:

- runtime command contracts
- environment parsing
- frontend state helpers
- workflow state models
- web3 utilities

## Config-as-data

Registries under `infra/registries/` define:

- chains and capabilities
- pipeline presets
- model routing
- token and x402 settings
- security policy

## Persistence

The primary production persistence plane is:

- Supabase/PostgreSQL for relational state
- Redis for queue/checkpointer scenarios
- IPFS/Pinata for artifact storage and trace references where enabled

## Site map

Use these pages next:

- [Architecture overview](README.md)
- [Network architecture](networks.md)
- [Core workflow pipeline](core-workflow-pipeline.md)
- [x402 payment system](x402-payment-system.md)
- [Frontend application](../product/frontend-application.md)
