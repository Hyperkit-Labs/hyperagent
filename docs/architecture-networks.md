# Network and chain architecture

This document describes how networks are defined, exposed to the frontend, and used for execution and optional Chainlink integration.

---

## Hybrid model: thirdweb + HyperAgent capabilities

HyperAgent uses a **hybrid** chain model:

- **thirdweb** owns chain metadata and execution: RPC URLs, explorers, native currency, `defineChain`, `getChainMetadata`. The SDK works with any EVM chain and maintains a large public chainlist.
- **HyperAgent capabilities** (`infra/registries/network/capabilities.yaml`) owns product policy only: tier, enabled status, simulation support, x402, verification mode, AA factory addresses, and custom overrides for chains where thirdweb metadata is missing.

Do not maintain two full registries. Use one product registry (capabilities) plus thirdweb as the metadata backend.

### Capabilities vs chains.yaml

| Source | Purpose |
|--------|---------|
| `capabilities.yaml` | HyperAgent policy: slug, chainId, enabled, tier, category, capabilities, aa config, defaults. Optional rpcUrl/explorerUrl only when thirdweb lacks them. |
| `chains.yaml` | Legacy fallback when capabilities is empty. Full chainlist-style entries. |
| thirdweb | Chain resolution, RPC, explorer, native currency at runtime (Node/TS). |

The orchestrator and deploy/agent-runtime prefer capabilities when present; otherwise they fall back to chains.yaml.

### Resolution flow

1. **Orchestrator (Python):** Loads `capabilities.yaml` or `chains.yaml` from `REGISTRIES_PATH`. Uses a static chainId metadata map for name/currency when capabilities omit them.
2. **Deploy / agent-runtime (Node):** Use `loadHybridChainRegistry` from `@hyperagent/web3-utils`: capabilities first (with thirdweb for RPC when missing), then chains.yaml fallback.
3. **Studio (Frontend):** Use `resolveNetwork(slug)` from web3-utils for chain-policy-aware smart wallet setup (factoryAddress, bundlerUrl from capabilities).

---

## Single source of truth: capabilities.yaml (preferred) or chains.yaml

The source of "which networks exist" and their policy:

- **Preferred:** `infra/registries/network/capabilities.yaml` (slug-keyed, HyperAgent-only fields)
- **Fallback:** `infra/registries/network/chains.yaml` (legacy chainlist format)

Both are consumed by the backend orchestrator (`services/orchestrator/registries.py`), which serves `GET /api/v1/networks`.

The API returns for each network: `network` (slug), `name`, `chain_id`, `currency`, `tier`, `category`, `is_mainnet`. The frontend must not maintain a separate list of supported networks; it uses the API (e.g. `useNetworks()` in Studio) for the selectable list.

- **Deploy service:** Uses `loadHybridChainRegistry` from web3-utils. Set `REGISTRIES_PATH`, `CAPABILITIES_PATH`, or `CHAIN_REGISTRY_PATH` / `CHAIN_REGISTRY_URL` as needed.
- **Default network:** Frontend uses the first testnet from the API (`is_mainnet === false`) or the fallback slug from the registry. In production (Contabo/Coolify), set `REGISTRIES_PATH` so the registry is found.
- **Testnet default:** Network selectors and deploy flows default to testnets from the registry.

The deprecated `chain_config` table was removed; it was a duplicate source and caused confusion. All chain metadata comes from the YAML via the API.

---

## thirdweb: RPC, wallet, execution

thirdweb is used for:

- **RPC** and **wallet** connection (connect, sign, deploy).
- **Execution:** resolving a `Chain` for a given `chainId` via `defineChain` and `getChainMetadata`.
- **Chain metadata:** When capabilities lacks rpcUrl/explorerUrl, thirdweb supplies them from its built-in chainlist.

Thirdweb is the runtime chain source for RPC and chain objects. The list of networks the user can select comes from the API (capabilities or chains.yaml). The frontend restricts selectable networks to that list and uses thirdweb only to execute on the chosen chain (RPC, wallet, transactions).

SIWE and the gateway-issued JWT are used for API auth; thirdweb is used for on-chain identity and execution.

---

## Chainlink (when adding CCIP / oracles)

For Chainlink integration (CCIP, oracles, CRE):

- Use **network/chains.yaml** (or JSON derived from it) as the local "Core + Extended" cache of networks.
- For CCIP/oracle flows, use Chainlink CRE `getNetwork()` or Register `getNetworkDetails()` to resolve router, LINK, wrapped-native, etc.
- Optionally introduce a **NetworkResolver** that: local cache (network/chains.yaml) -> CRE/Register -> ResolvedNetwork, with a policy for read-only use outside Core/Extended.

---

## Per-chain capabilities (including x402)

Each chain in `capabilities.yaml` (or `chains.yaml` hyperagent section) has `capabilities`:

| Capability | Meaning |
|------------|---------|
| `x402: true/false` | x402 payments supported on that chain |
| `tenderly: true/false` | Tenderly simulation supported |
| `accountAbstraction.erc4337` | ERC-4337 support |
| `accountAbstraction.eip7702` | EIP-7702 support |
| `verification` | Block explorer verification (full, limited, etc.) |

Chains with `x402: true` can use x402 pay-per-call. USDC/USDT addresses per chain are in `infra/registries/x402/stablecoins.yaml`.

## Adding a new chain

1. Add an entry to `infra/registries/network/capabilities.yaml` (preferred) or `infra/registries/network/chains.yaml` with `chainId`, `enabled`, `tier`, `category`, `capabilities`, and optional `rpcUrl`/`explorerUrl` when thirdweb metadata is missing.
2. If x402 is supported, add USDC/USDT addresses to `infra/registries/x402/stablecoins.yaml`.
3. Commit and deploy; no code change required (GitOps).

## Summary

| Concern | Source / Tool |
|--------|----------------|
| List of networks (selectable in UI) | `capabilities.yaml` or `chains.yaml` via `GET /api/v1/networks` |
| x402 per chain | `capabilities.x402` in capabilities.yaml |
| USDC/USDT for x402 | `x402/stablecoins.yaml` |
| Deploy / registry loader | `loadHybridChainRegistry` from web3-utils (capabilities first, chains.yaml fallback) |
| RPC, wallet, execution | thirdweb (Chain resolution, connect, sign, deploy) |
| API auth | SIWE -> gateway JWT |
| Chainlink config (CCIP, oracles) | network/chains.yaml or capabilities as cache; CRE/Register for router/LINK/wrapped-native |
