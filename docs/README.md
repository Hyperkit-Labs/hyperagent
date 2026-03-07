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
| [Network architecture](architecture-networks.md) | Single source of truth (network/chains.yaml), thirdweb for execution, Chainlink integration. |
| [Control plane: runs and steps](control-plane-runs-steps.md) | Phase 1 step audit trail, run_steps table, and path to async control plane (Phase 2/3). |
| [Deploy ownership](deploy-ownership.md) | Who owns deploy: Studio (wallet-signed via Thirdweb) vs orchestrator/deploy service (plans and config). |
| [Storage policy](storage-policy.md) | Traces to EigenDA, artifacts to IPFS, indexes to Supabase; where blob_id/cid are stored. |

**Runbooks (ops / security):**

| Doc | Description |
|-----|-------------|
| [BYOK key lifecycle](runbooks/BYOK-key-lifecycle.md) | Encryption key, rotation, no raw keys after write. |

---

## Quick links

- **Run the app:** [Getting started → Run locally](getting-started.md#run-locally)
- **Use the product:** [User guide → Core flow](user-guide.md#core-flow)
- **Contribute:** [Developer guide → Contributing](developer-guide.md#contributing)
