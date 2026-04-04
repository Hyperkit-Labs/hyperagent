# Network architecture

HyperAgent targets **EVM networks** through a **chain registry** and SDK capability metadata.

## Registry

Registry files under `infra/registries` and related YAML define chain IDs and feature flags. Studio and orchestrator should read the same source of truth.

## Execution and payments

Thirdweb is used for wallet flows where integrated. **x402** metering is optional and configuration-dependent.

## Related docs

- [Deploy ownership](deploy-ownership.md)
- [Payment and onboarding flow](payment-onboarding-flow.md)
