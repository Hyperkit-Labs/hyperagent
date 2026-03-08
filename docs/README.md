# HyperAgent Documentation

Documentation for onboarding, users, and developers. Use this index to find the right guide.

---

## For everyone

| Doc | Description |
|-----|--------------|
| [Getting started](getting-started.md) | First-time setup: what you need, how to run the app, and how to get help. |

---

## For users

| Doc | Description |
|-----|--------------|
| [User guide](user-guide.md) | How to use HyperAgent Studio: connect wallet, add LLM keys (BYOK), run workflows, and view results. |

---

## For developers

| Doc | Description |
|-----|--------------|
| [Developer guide](developer-guide.md) | Local setup, repo structure, running the frontend and backend, and contributing. |
| [Network architecture](architecture-networks.md) | Single source of truth (network/chains.yaml), per-chain x402, thirdweb for execution, Chainlink integration. |
| [Control plane: runs and steps](control-plane-runs-steps.md) | Phase 1 step audit trail, run_steps table, and path to async control plane (Phase 2/3). |
| [Deploy ownership](deploy-ownership.md) | Who owns deploy: Studio (wallet-signed via Thirdweb) vs orchestrator/deploy service (plans and config). |
| [Storage policy](storage-policy.md) | Traces, artifacts to IPFS, indexes to Supabase; where blob_id/cid are stored. |
| [Payment and onboarding flow](payment-onboarding-flow.md) | Credits, USDC/USDT top-up, x402, and environment variables. |

**Runbooks (ops / deployment):**

| Doc | Description |
|-----|-------------|
| [Deployment runbook](runbooks/deployment-runbook.md) | Build history persistence, security feed, SCV sync, and environment setup. |

---
