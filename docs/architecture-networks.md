# Network and chain architecture

This document describes how networks are defined, exposed to the frontend, and used for execution and optional Chainlink integration.

---

## Single source of truth: network/chains.yaml

The **only** source of "which networks exist" and their metadata is:

- **File:** `infra/registries/network/chains.yaml`
- **Consumed by:** Backend orchestrator (`services/orchestrator/registries.py`), which loads it and serves `GET /api/v1/networks`.

The API returns for each network: `network` (slug), `name`, `chain_id`, `currency`, `tier`, `category`, `is_mainnet`. The frontend must not maintain a separate list of supported networks; it uses the API (e.g. `useNetworks()` in Studio) for the selectable list.

- **Deploy service:** Should default to the same registry (e.g. `CHAIN_REGISTRY_PATH` pointing at `infra/registries/network/chains.yaml` or `/app/registries/network/chains.yaml` in Docker).
- **Default network:** Frontend uses the first testnet from the API (`is_mainnet === false`) or the fallback slug from the registry. On Render, set `REGISTRIES_PATH` so the registry is found.
- **Testnet default:** Network selectors and deploy flows default to testnets from the registry.

The deprecated `chain_config` table was removed; it was a duplicate source and caused confusion. All chain metadata comes from the YAML via the API.

---

## thirdweb: RPC, wallet, execution only

thirdweb is used for:

- **RPC** and **wallet** connection (connect, sign, deploy).
- **Execution:** resolving a `Chain` for a given `chainId` (e.g. via `lib/chains.ts` and thirdweb/chains).

thirdweb is **not** the source of "supported networks." The list of networks the user can select comes from the API (network/chains.yaml). The frontend restricts selectable networks to that list and uses thirdweb only to execute on the chosen chain (RPC, wallet, transactions).

SIWE and the gateway-issued JWT are used for API auth; thirdweb is used for on-chain identity and execution.

---

## Chainlink (when adding CCIP / oracles)

For Chainlink integration (CCIP, oracles, CRE):

- Use **network/chains.yaml** (or JSON derived from it) as the local "Core + Extended" cache of networks.
- For CCIP/oracle flows, use Chainlink CRE `getNetwork()` or Register `getNetworkDetails()` to resolve router, LINK, wrapped-native, etc.
- Optionally introduce a **NetworkResolver** that: local cache (network/chains.yaml) -> CRE/Register -> ResolvedNetwork, with a policy for read-only use outside Core/Extended.

---

## Per-chain capabilities (including x402)

Each chain in `chains.yaml` has `hyperagent.capabilities`:

| Capability | Meaning |
|------------|---------|
| `x402: true/false` | x402 payments supported on that chain |
| `tenderly: true/false` | Tenderly simulation supported |
| `accountAbstraction.erc4337` | ERC-4337 support |
| `accountAbstraction.eip7702` | EIP-7702 support |
| `verification: true/false` | Block explorer verification |

Chains with `x402: true` can use x402 pay-per-call. USDC/USDT addresses per chain are in `infra/registries/x402/stablecoins.yaml`.

## Adding a new chain

1. Add an entry to `infra/registries/network/chains.yaml` with `chainlist` and `hyperagent` sections.
2. If x402 is supported, add USDC/USDT addresses to `infra/registries/x402/stablecoins.yaml`.
3. Commit and deploy; no code change required (GitOps).

## Summary

| Concern | Source / Tool |
|--------|----------------|
| List of networks (selectable in UI) | `infra/registries/network/chains.yaml` via `GET /api/v1/networks` |
| x402 per chain | `capabilities.x402` in chains.yaml |
| USDC/USDT for x402 | `x402/stablecoins.yaml` |
| Deploy default / registry path | Same network/chains.yaml (repo or env-configured path) |
| RPC, wallet, execution | thirdweb (Chain resolution, connect, sign, deploy) |
| API auth | SIWE -> gateway JWT |
| Chainlink config (CCIP, oracles) | network/chains.yaml as cache; CRE/Register for router/LINK/wrapped-native |
