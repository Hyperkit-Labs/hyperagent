# GitOps-managed registries

Config-as-data for HyperAgent. Registry YAML files are organized by category. All are the single source of truth for chains, SDKs, LLM models, token templates, pipelines, security policy, and x402. Change them via Git (PR, review, merge); no code change required for new chains, models, or presets.

## Directory layout

```
infra/registries/
├── README.md
├── pipelines.yaml          # PipelineRegistry (stages, gates, default models)
├── security.yaml          # SecurityPolicyRegistry (audit tools, severity thresholds)
├── tokens.yaml            # TokenTemplateRegistry (ERC20/721, governance templates)
├── models.yaml            # ModelRegistry (LLM provider → models, BYOK routing)
├── network/
│   └── chains.yaml        # ChainRegistry (chain IDs, RPCs, capabilities)
├── sdks/
│   └── sdks.yaml          # SdkRegistry (Thirdweb, viem, Hardhat, Foundry)
└── x402/
    ├── settings.yaml      # X402SettingsRegistry (enable/disable x402)
    ├── x402-products.yaml # X402ProductRegistry (metered resources, plans, pricing)
    └── stablecoins.yaml   # StablecoinRegistry (USDC/USDT per chain for x402)
```

## Files by category

| Path | Kind | Purpose |
|------|------|---------|
| `network/chains.yaml` | ChainRegistry | Chain IDs, RPCs, explorers, capabilities (Tenderly, AA, x402), gas/security defaults |
| `sdks/sdks.yaml` | SdkRegistry | Thirdweb, viem, Hardhat, Foundry; blessed chains, features (ERC4337, 7702, x402) |
| `models.yaml` | ModelRegistry | Provider → models, context window, cost, use (spec/audit/quick edit), BYOK mapping |
| `tokens.yaml` | TokenTemplateRegistry | Canonical templates (ERC20/721, governance), flags, audit links |
| `x402/stablecoins.yaml` | StablecoinRegistry | USDC/USDT contract addresses per chain for x402 payments and merchant settlement |
| `x402/x402-products.yaml` | X402ProductRegistry | Metered resource IDs, unit pricing, per-plan limits, SKU → pipelines/features |
| `x402/settings.yaml` | X402SettingsRegistry | x402 service on/off and related settings |
| `pipelines.yaml` | PipelineRegistry | Named pipelines, stages, default models per stage, gating rules |
| `security.yaml` | SecurityPolicyRegistry | Mandatory tools per network/risk, severity thresholds, upgrade patterns |

## How apps consume registries

- **Orchestrator** loads pipelines, network/chains, security, and tokens at startup from `REGISTRIES_PATH` or repo `infra/registries`. Pipeline gates (e.g. audit maxSeverity) drive workflow behavior; `pipeline_id` can be set on POST /run or POST /api/v1/workflows/generate.
- **Load once at service startup** and cache in memory; or read YAML directly and hot-reload on SIGHUP.
- **Version each registry**: record `chains_version`, `models_version`, etc. in pipeline run metadata so every run is reproducible.
- **Deploy service**: set `CHAIN_REGISTRY_PATH` to the chains file (e.g. `$REGISTRIES_PATH/network/chains.yaml` or `/app/registries/network/chains.yaml` in Docker).

## GitOps workflow

- Propose changes via PR. Review and merge; deploy picks up new config on next deploy or reload.
- Rollback via `git revert`. Environment overlays (e.g. dev/stage/prod) can use separate dirs or Kustomize-style patches if needed.

## Schema

All registries use `apiVersion: hyperagent.io/v1` and a `kind` per registry type. Add a `metadata.name` and `spec` with the relevant entries. Extend `spec` as needed; keep structure stable for backward compatibility.
