# Payment and onboarding flow

## Target flow

1. **Connect wallet** – Connect via thirdweb (MetaMask, Coinbase, WalletConnect).
2. **Add keys** – Add LLM API keys in Settings (BYOK).
3. **Add budget** – Open Payments, add USDC or USDT, convert to credits.
4. **Create workflow** – Spend credits per run (metered runs).

---

## Credit conversion

- USDC/USDT is sent from the connected wallet to `MERCHANT_WALLET_ADDRESS`.
- 1 USD = 10 credits by default (configurable via `CREDITS_PER_USD`).
- Example: $10 USDC yields 100 credits, approximately 14 workflow runs at 7 credits per run.
- Thirdweb server wallet can sponsor gas (Paymaster) when configured.
- After transaction confirmation, the backend credits the account.

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

Orchestrator loads networks from `infra/registries/network/chains.yaml`. In production (Contabo/Coolify), set `REGISTRIES_PATH` to a repo-relative path so the registry is found.

---

## x402 vs credits

- **Credits**: Internal prepaid balance (USDC top-up). Consumed per workflow run.
- **x402**: External pay-per-call for API and agent requests. Separate flow.
- Both can be enabled; credits apply to workflow runs; x402 applies to pay-per-call API access.
