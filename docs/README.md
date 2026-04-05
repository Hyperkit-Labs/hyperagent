# HyperAgent Documentation

Index for onboarding, Studio usage, and contributor workflows.

---

## Overview

| Doc | Description |
|-----|-------------|
| [Getting started](introduction/getting-started.md) | First-time setup, local run, environment, and where to find help. |

---

## Studio (product)

| Doc | Description |
|-----|-------------|
| [Studio guide](product/user-guide.md) | HyperAgent Studio: wallet connection, LLM keys (BYOK), workflows, and results. |

---

## Contributors and technical reference

| Doc | Description |
|-----|-------------|
| [Contributor guide](contributing/developer-guide.md) | Local setup, repository layout, running services, and contribution workflow. |
| [Agent operating model](agent-operating-model/README.md) | Architecture map, glossary, high-risk paths, skills, permissions, verification, tasks, plugins, subagent handoff, recovery. |
| [Production hardening roadmap](control-plane/production-hardening-roadmap.md) | Priority workstreams to turn gaps, placeholders, stubs, and partial features into a production-grade Phase 1 system. |
| [Network architecture](architecture/networks.md) | Single source of truth (`network/chains.yaml`), per-chain x402, thirdweb for execution, Chainlink integration. |
| [Control plane: runs and steps](control-plane/runs-and-steps.md) | Phase 1 step audit trail, `run_steps` table, and path to async control plane (Phase 2/3). |
| [Deploy ownership](runbooks/deploy-ownership.md) | Deploy responsibilities: Studio (wallet-signed via Thirdweb) versus orchestrator and deploy service (plans and configuration). |
| [Storage policy](control-plane/storage-policy.md) | Traces, artifacts to IPFS, indexes to Supabase; where `blob_id` and CID are stored. |
| [Payment and onboarding flow](product/payment-onboarding-flow.md) | Credits, USDC/USDT top-up, x402, and environment variables. |

**Runbooks (operations and deployment):**

| Doc | Description |
|-----|-------------|
| [Deployment runbook](runbooks/deployment-runbook.md) | Build history persistence, security feed, SCV sync, and environment setup. |

---
