# Payment and onboarding flow

v0.1.0 product contract: x402 is the mandatory payment wall for supported user flows on SKALE Base Mainnet and SKALE Base Sepolia. Legacy credits wording that still appears in parts of the repo should be treated as an implementation-gap marker, not as a second intended billing model.

## Target flow

1. **Connect wallet** – Connect via thirdweb on SKALE Base Mainnet or SKALE Base Sepolia.
2. **Add keys** – Add LLM API keys in Settings (BYOK).
3. **Fund payment path** – Complete the x402-backed payment setup used by the supported workflow.
4. **Create workflow** – Start the workflow once payment and spending controls are satisfied.

---

## Legacy credits-era surfaces still in repo

- USDC/USDT is sent from the connected wallet to `MERCHANT_WALLET_ADDRESS`.
- 1 USD = 10 credits by default (configurable via `CREDITS_PER_USD`).
- Example: $10 USDC yields 100 credits, approximately 14 workflow runs at 7 credits per run.
- Thirdweb server wallet can sponsor gas (Paymaster) when configured.
- After transaction confirmation, the backend credits the account.

These env vars and UI surfaces still exist in the repo, but they should be read as legacy or transitional implementation details until the payment experience is fully aligned with the x402-first contract.

---

## Environment

| Variable | Purpose |
|----------|---------|
| `MERCHANT_WALLET_ADDRESS` | Receives USDC/USDT |
| `THIRDWEB_SERVER_WALLET_ADDRESS` | Pays gas when using Paymaster |
| `CREDITS_ENABLED` | Set `true` to enable credit system |
| `CREDITS_PER_USD` | Credits granted per 1 USD (default 10) |
| `CREDITS_PER_RUN` | Credits consumed per workflow run (default 7) |
| `REGISTRIES_PATH` | Chain registry for orchestrator (Contabo/Docker) |

---

## Network registry

Orchestrator loads networks from `infra/registries/network/chains.yaml`. For v0.1.0, the supported launch matrix is SKALE Base Mainnet and SKALE Base Sepolia only. In production (Contabo/Coolify), set `REGISTRIES_PATH` to a repo-relative path so the registry is found.

---

## x402 vs credits

- **x402**: Mandatory payment wall for supported v0.1.0 user flows.
- **Credits wording**: Legacy terminology that still appears in parts of the repo and needs alignment.
- If the runtime still allows credits-first or x402-disabled behavior, treat that as a launch-readiness gap, not as an intended product option.
