# Deploy ownership: Studio vs orchestrator

This doc clarifies where deploy logic lives and how it aligns with the "thin Studio, capability services" vision.

---

## Current state (intentionally split)

| Flow | Owner | Where | Purpose |
|------|--------|--------|---------|
| **Deploy plan (RPC/explorer URLs, bytecode, ABI)** | Orchestrator / deploy service | `services/deploy`, `services/orchestrator` | Server builds deploy plan; Studio receives it via API. |
| **Wallet-signed deploy (user signs in browser)** | Studio | `apps/studio/lib/eoaDeploy.ts`, `lib/smartWalletDeploy.ts` | User connects wallet; Studio uses Thirdweb SDK to prepare and send the transaction. |

So:

- **Orchestrator** (and deploy service) own: pipeline, deploy plan generation, chain config, RPC/explorer URLs.
- **Studio** owns: triggering deploy from the connected wallet, signing with MetaMask/Thirdweb, and showing deploy status.

Backend access is centralized in `lib/api.ts`; workflows, runs, BYOK, and networks go through the api-gateway. Deploy-from-wallet is the one flow that stays in the frontend so the user's wallet can sign the transaction.

---

## Option A: Orchestrator-only (future)

If you later want "all deploy through the API":

- Studio would only call orchestrator (e.g. `POST /deploy/prepare`, `POST /deploy/complete`).
- Signing would move to a backend signer or a different UX (e.g. relay, session keys). Wallet-signed deploy would then be driven by the API, not by the Studio app directly.

---

## Option B: Keep current split (default)

- **Orchestrator / deploy service**: single source of truth for chains, deploy plans, and server-side deploy flows.
- **Studio**: uses `lib/api.ts` for all backend; uses Thirdweb only for wallet connect and for sending the deploy transaction the backend prepared.

This keeps a single deploy contract (shared types in `packages/core-types`, deploy service API) while leaving wallet signing in the client.

---

## Summary

- **Registries and deploy plan**: single source of truth in orchestrator + deploy service; shared types in `packages/core-types`.
- **Who does what**: Orchestrator/deploy service = plan and config; Studio = API for data + Thirdweb for wallet-signed deploy only.
- **Documented here** so future changes (e.g. moving wallet deploy behind the API) are explicit.
