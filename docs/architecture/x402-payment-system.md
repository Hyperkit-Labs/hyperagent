# x402 payment system

HyperAgent's v0.1.0 product contract is x402-backed billing on supported user flows for SKALE Base Mainnet and SKALE Base Sepolia.

The repo still contains some credits-era language and env-gated enforcement paths. Those should be treated as launch-readiness gaps to close, not as parallel first-class billing models.

## What x402 is used for

x402 is the required payment wall for supported workflow and API access in the current release scope.

## What x402 is not

x402 is not supposed to be framed as an optional add-on for v0.1.0. Any remaining credits-first wording or env-disabled x402 paths are repo gaps, not the intended product contract.

## Main pieces

- gateway and orchestrator middleware
- product and stablecoin registries
- wallet and thirdweb integration
- payment verification routes
- analytics and spending controls

## Related docs

- [Payment and onboarding flow](../product/payment-onboarding-flow.md)
- [Network architecture](networks.md)
- [User guide](../product/user-guide.md)

## Production guidance

Documentation and UI should present x402 as the required payment wall only for the currently supported SKALE Base routes. Any runtime path that still makes x402 optional or disabled by default should be tracked as an enforcement gap until removed.
