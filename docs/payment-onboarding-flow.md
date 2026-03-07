# Payment and Onboarding Flow

## Target Flow

1. **Connect wallet** - User connects via thirdweb (MetaMask, Coinbase, WalletConnect)
2. **Add Key** - User adds LLM API keys in Settings (BYOK)
3. **Add budget** - User goes to Payment, adds USDC or USDT, converts to credits
4. **Create workflow** - User consumes credits per run (Cursor-style)

## Credit Conversion

- User sends USDC/USDT from wallet to `MERCHANT_WALLET_ADDRESS`
- 1 USD = 10 credits by default (configurable via `CREDITS_PER_USD`)
- Example: $10 USDC yields 100 credits, ~14 workflow runs at 7 credits/run
- Thirdweb server wallet can sponsor gas (Paymaster) when configured
- Backend credits user after tx confirmation

## Environment

- `MERCHANT_WALLET_ADDRESS` - Receives USDC/USDT
- `THIRDWEB_SERVER_WALLET_ADDRESS` - Pays gas when using Paymaster
- `CREDITS_ENABLED=true` - Enables credit system
- `CREDITS_PER_USD` - Credits granted per 1 USD (default 10)
- `CREDITS_PER_RUN` - Credits consumed per workflow run (default 7)
- `REGISTRIES_PATH` - Chain registry for orchestrator (Render/Docker)

## Network Registry Fix

Orchestrator loads networks from `infra/registries/network/chains.yaml`.
On Render, set `REGISTRIES_PATH` to repo-relative path so registry is found.

## x402 vs Credits

- **Credits**: Internal prepaid balance (USDC top-up). Consumed per workflow run.
- **x402**: External pay-per-call for API/agent requests. Separate flow.
