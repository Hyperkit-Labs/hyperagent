# x402 payment system

HyperAgent supports two related but distinct billing models:

- internal credits for workflow runs
- x402 for pay-per-call API and agent access

This page is the overview for the x402 side.

## What x402 is used for

x402 is the external request-level payment lane. It is useful for metered API access and specific payment-gated actions without requiring a user to pre-fund a generic workflow balance first.

## What x402 is not

x402 is not the same thing as the internal credit system used for most workflow runs. Both can coexist, but they serve different operational and product needs.

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

x402 capability is configuration-dependent. Documentation and UI should present it as supported only on the networks and routes actually enforced by the current runtime configuration.
