# Frontend application

HyperAgent Studio is the main user-facing surface for the platform.

## Stack

- Next.js App Router
- React
- TypeScript
- TanStack Query
- Zustand
- Thirdweb

## Main responsibilities

- wallet connection and session handling
- BYOK configuration
- workflow creation and run inspection
- payment and credits UI
- contract and deployment views
- network, settings, and operational visibility

## Main routes

The application includes routes for:

- dashboard
- workflows
- deployments
- contracts
- payments
- analytics
- settings
- docs
- agents
- monitoring

## Integration model

Studio talks to the API gateway, which proxies to the orchestrator. It also consumes shared workspace packages for API contracts, frontend data utilities, workflow state, and UI composition.

## Related docs

- [User guide](user-guide.md)
- [Getting started](../introduction/getting-started.md)
- [Payment and onboarding flow](payment-onboarding-flow.md)
- [Key concepts](../introduction/key-concepts.md)
