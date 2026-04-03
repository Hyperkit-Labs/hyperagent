# Deploy ownership: Studio vs orchestrator

Where deploy logic lives and how it aligns with a thin Studio layer and dedicated capability services.

---

## Current state (intentionally split)

| Flow | Owner | Where | Purpose |
|------|--------|--------|---------|
| **Deploy plan (RPC/explorer URLs, bytecode, ABI)** | Orchestrator / deploy service | `services/orchestrator`, `services/agent-runtime` | Server builds deploy plan; Studio receives it via API. |
| **Wallet-signed deploy (browser signing)** | Studio | `apps/studio/lib/eoaDeploy.ts`, `lib/smartWalletDeploy.ts` | Connected wallet in the browser; Studio uses Thirdweb SDK to prepare and send the transaction. |

Summary:

- **Orchestrator** (and deploy service) own: pipeline, deploy plan generation, chain configuration, RPC and explorer URLs.
- **Studio** owns: initiating deploy from the connected wallet, signing via MetaMask/Thirdweb, and surfacing deploy status.

Backend access is centralized in `lib/api.ts`; workflows, runs, BYOK, and networks go through the api-gateway. Deploy-from-wallet remains in the frontend so the signing key stays in the wallet flow.

---

## Option A: Orchestrator-only (future)

For an architecture where deploy is entirely API-driven:

- Studio would call only the orchestrator (for example `POST /deploy/prepare`, `POST /deploy/complete`).
- Signing would move to a backend signer or a different flow (relay, session keys). Wallet-signed deploy would then be driven by the API rather than the Studio app directly.

---

## Option B: Keep current split (default)

- **Orchestrator / deploy service**: single source of truth for chains, deploy plans, and server-side deploy flows.
- **Studio**: uses `lib/api.ts` for backend data; uses Thirdweb for wallet connection and for sending the deploy transaction the backend prepared.

This keeps one deploy contract (shared types in `packages/core-types`, deploy service API) while leaving wallet signing in the client.

---

## Summary

- **Registries and deploy plan**: single source of truth in orchestrator and deploy service; shared types in `packages/core-types`.
- **Roles**: Orchestrator and deploy service handle plan and configuration; Studio handles API-backed data and Thirdweb wallet-signed deploy only.
- **Purpose of this doc**: make future changes (for example moving wallet deploy behind the API) explicit and reviewable.
