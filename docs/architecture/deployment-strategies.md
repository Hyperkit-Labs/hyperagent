# Deployment strategies

HyperAgent supports multiple deployment patterns conceptually, but production support depends on chain capabilities, runtime configuration, and the active Phase 1 scope.

## Main strategy families

### Standard deployment

The user or configured execution path signs and submits deployment transactions using the appropriate chain tooling and wallet flow.

### Gas-sponsored or assisted deployment

Where supported, a sponsored-gas or account-abstraction flow can reduce end-user friction.

### x402-gated deployment paths

Some API paths may be protected by x402 payment checks where that product model is enabled.

### Batch or orchestrated deployment

Multiple contracts or steps can be coordinated as part of a deployment plan rather than treated as isolated one-offs.

## How to think about support

Treat deployment strategy support as a matrix of:

- selected chain
- selected wallet model
- registry capabilities
- environment configuration
- current release scope

## Related docs

- [Deploy ownership](../runbooks/deploy-ownership.md)
- [Network architecture](networks.md)
- [Payment and onboarding flow](../product/payment-onboarding-flow.md)
- [Capability truth table](../control-plane/capability-truth-table.md)
