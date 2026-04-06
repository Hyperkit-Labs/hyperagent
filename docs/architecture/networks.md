# Network architecture

HyperAgent targets **EVM networks** through a **chain registry** and SDK capability metadata, but v0.1.0 launch support is intentionally narrower.

## Registry

Registry files under `infra/registries` and related YAML define chain IDs and feature flags. Studio and orchestrator should read the same source of truth.

For v0.1.0, the only supported launch targets are:

- SKALE Base Mainnet
- SKALE Base Sepolia

Other chain entries in the registry are roadmap or configuration scaffolding and should not be presented as currently supported user-facing networks.

## Execution and payments

Thirdweb is used for wallet flows where integrated. For v0.1.0, x402 is the intended required payment path on supported user flows. If the runtime still treats x402 as optional or env-gated, that is a launch-readiness gap rather than a supported product option.

## Related docs

- [Deploy ownership](../runbooks/deploy-ownership.md)
- [Payment and onboarding flow](../product/payment-onboarding-flow.md)
