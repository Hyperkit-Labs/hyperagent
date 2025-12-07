# HyperAgent Engineering Documentation Overview

This page provides quick navigation to all engineering documentation for the HyperAgent project. Each guide focuses on a specific aspect of our development practices, architecture, and processes.

## Documentation Structure

### [Engineering Standards](./ENGINEERING_STANDARDS.md)
**Coding standards, naming conventions, design patterns, code review, and testing**

Covers Python (snake_case) and TypeScript (camelCase) style guides, code organization, design patterns with practical examples, code review checklists, and testing standards. Each practice is tagged with its adoption status.

**Key Topics**: Python/TypeScript style, SOLID principles, design patterns, code review process, unit/integration testing, coverage targets

### [Architecture Guide](./ARCHITECTURE_GUIDE.md)
**Service-oriented architecture, event-driven patterns, ERC4337/x402 flows**

Documents our SOA implementation with ServiceRegistry and SequentialOrchestrator, Redis Streams event bus, workflow orchestration, and detailed step-by-step flows for ERC4337 Smart Account deployments and x402 payment gating.

**Key Topics**: SOA patterns, event-driven architecture, ERC4337 deployment flow, x402 payment flow, network support

### [DevOps & SRE Guide](./DEVOPS_SRE_GUIDE.md)
**CI/CD pipelines, environments, monitoring, scaling, incident response**

Covers our Docker-based development setup, Prometheus monitoring, environment management (dev/staging/production), database migrations, health checks, and incident response procedures. Status tags indicate what's currently running vs planned.

**Key Topics**: Docker setup, Prometheus monitoring, environment configuration, database management, scaling strategies, health checks

### [Delivery Process](./DELIVERY_PROCESS.md)
**Sprint structure, user stories, technical debt management, release process**

Tailored for our 3-person founder team with high-velocity development. Includes simplified sprint structure, user story format, technical debt tracking, and pre-deployment checklists.

**Key Topics**: Sprint planning, user stories, tech debt policy, pre-deployment checklists, release process

## Quick Status Reference

| Practice | Status | Notes |
|----------|--------|-------|
| Python snake_case | [Adopted] | Enforced via Black/isort in CI |
| TypeScript camelCase | [Adopted] | Enforced via ESLint |
| Prometheus monitoring | [Adopted] | Running in docker-compose |
| GitHub Actions CI | [Adopted] | Fully implemented with tests and quality checks |
| Pre-commit hooks | [Adopted] | Local code quality checks |
| Test coverage thresholds | [Adopted - Review] | Enforced in code review |
| ERC4337 Smart Accounts | [Adopted] | Fully implemented |
| x402 Payment Gating | [Adopted] | Integrated with x402-verifier |
| Blue-green deployments | [Planned] | Future enhancement |

## Getting Started

- **New to the codebase?** Start with [Engineering Standards](./ENGINEERING_STANDARDS.md) for coding conventions
- **Working on architecture?** See [Architecture Guide](./ARCHITECTURE_GUIDE.md) for patterns and flows
- **Setting up infrastructure?** Check [DevOps & SRE Guide](./DEVOPS_SRE_GUIDE.md)
- **Planning a feature?** Review [Delivery Process](./DELIVERY_PROCESS.md) for workflow

## Status Tag Legend

- **[Adopted]** - Currently enforced by CI or automated tooling
- **[Adopted - Review]** - Enforced by code review but not automated
- **[Planned]** - Not yet implemented, on roadmap

