# HyperAgent Project Constitution

## Project Overview

HyperAgent is an AI-powered smart contract development platform that transforms natural language specifications into production-ready, audited contracts deployed across multiple EVM chains in minutes.

## Core Principles

### 1. Agent-First Architecture
- All development follows agent-oriented design patterns
- Services communicate via A2A (Agent-to-Agent) protocol
- ERC-8004 for agent identity and reputation
- Verifiable by design with trace provenance (stub blob IDs in run_steps)

### 2. MVP Scope and Multi-Chain Roadmap
- **Phase 1 (MVP)**: single primary chain and one fully supported, end-to-end pipeline (spec → design/codegen → audit → simulation → deploy) as described in `docs/control-plane-runs-steps.md`.
- Multi-chain support (Mantle, Avalanche, BNB, SKALE, Protocol Labs, and others) is a roadmap goal that is enabled by modular chain adapters, but **must not** expand beyond the MVP chain until the single-chain path is stable and meeting SLOs.
- Chain adapters remain modular and independently deployable, but new chains are added only after the MVP path has clear success metrics and reliable observability.

### 3. Security & Observability First
- Automated security audits (Slither, Mythril, MythX, Echidna)
- Tenderly simulations before deployment
- OpenTelemetry for distributed tracing
- MLflow for model routing experiments
- Dune Analytics for on-chain metrics

### 4. Developer Experience
- Natural language to production in minutes
- TypeScript SDK for programmatic access
- CLI for terminal-based workflows
- Comprehensive documentation and examples

### 5. BYOK (Bring Your Own Keys)
- No LLM keys in `.env` for any environment; `.env` is for other necessary config only
- Users connect (wallet), provide LLM keys via the app (stored in TEE), get approved, then run workflows end-to-end (including Tenderly simulation and report)
- Backend only provides functions; frontend is the web IDE surface
- User-provided keys are stored in an isolated, encrypted TEE; remove config in-app and keys are wiped
- **Phase 1 BYOK surface** is intentionally minimal, as described in `docs/byok-and-run-flow.md`: per-user, per-workspace encrypted keys with a single write path and a single read-for-run path, and short-lived agent-session JWTs where configured. Richer rotation and recovery tooling is a later-phase concern.

### 6. Data Ownership and Storage Policy
- Follow the storage and data-availability policy in `docs/storage-policy.md`: traces (stub blob IDs), artifacts in IPFS/Pinata (or equivalent), indices and metadata in Supabase, and minimal large blobs in Postgres.
- Every stored artifact or trace must have an explicit hash/version and clear source-of-truth.

## Technology Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI 0.100+
- **Orchestration**: LangGraph for agent workflows
- **Queue**: Redis for worker pools
- **Database**: Supabase (PostgreSQL) with RLS
- **Vector DB**: Pinecone for RAG
- **Memory**: Acontext for long-term agent memory
- **Key service (TEE)** for BYOK: user-provided LLM keys stored and used per user; no server-side LLM keys for user workloads

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 3.x, shadcn/ui
- **State**: TanStack Query, Zustand
- **Web3**: ethers.js 6.x, @solana/web3.js, wagmi 2.x

### Smart Contracts
- **Language**: Solidity 0.8.24+
- **Tools**: Hardhat, Foundry
- **Libraries**: OpenZeppelin Contracts
- **Deployment**: Thirdweb, ERC-4337 Account Abstraction

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes with Kustomize
- **GitOps**: ArgoCD for declarative deployments
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana, Datadog

## Development Standards

### Code Quality
- Follow clean code principles
- Use descriptive, intention-revealing names
- Single Responsibility Principle (SRP)
- Write self-documenting code
- Comment "why", not "what"

### Testing
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical workflows
- Contract tests for smart contracts
- Minimum 80% code coverage

### Documentation
- README.md for all modules
- API documentation with examples
- Architecture decision records (ADRs)
- Runbooks for operational procedures
- Inline comments for complex logic

### Git Workflow
- Follow GitFlow branching strategy
- `main`: Production-ready code
- `development`: Integration branch
- `feature/*`: Feature branches
- `release/*`: Release preparation
- `hotfix/*`: Urgent production fixes
- `projects`: GitHub Projects automation

### Commit Messages
- Use conventional commits format
- Prefix with type: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Include issue number if applicable
- Keep messages concise but descriptive

## AI Agent Guidelines

### Mandatory Pre-Action (Global)
**This applies to all agents and all tasks. No exceptions.** Before any implementation, code change, or planning output, the agent MUST perform this check first (see `.cursor/rules/MANDATORY_PRE_ACTION.mdc` and `AGENTS.mdc`):

1. **`.cursor/rules/`** — Review rule files relevant to the task (AGENT.mdc, production.mdc, rules.mdc, etc.).
2. **`.cursor/wiki/`** — Read wiki docs (e.g. robots.txt, scope boundaries).
3. **`.cursor/skills/`** — Identify and read relevant SKILL.md and references.
4. **`.cursor/llm/`** — Review LLM resources (llm.txt, usage constraints).
5. **Then** proceed with the reply or implementation using those resources.

Do not run other tools or write code before completing steps 1–4 for any coding, planning, or project task.

### AI Interaction Structure
- **robots.txt** (`.cursor/wiki/robots.txt`): Defines AI crawler boundaries
- **llms.txt** (root): Content manifest for AI systems
- **skills.md** (`.cursor/skills.md`): Skills index for AI agents
- **CLAUDE.md** (this file): Main project constitution
- **.cursorrules** (root): Cursor editor instructions

## Assignment Distribution

### JustineDevs - Agentic Side
**Areas**: Orchestration, GitOps, DevOps, Documentation, Backend
- Orchestration (orchestration)
- GitOps/DevOps (infra, gitops)
- Documentation (docs)
- Backend (backend, api)
- Storage-RAG (storage-rag)
- Security (security)
- Observability (observability)
- Agents (agents)
- Chain Adapters (chain-adapter)
- Contracts (contracts)

### ArhonJay - SDKs Related
**Areas**: SDKs, CLI, SDK-related features
- SDK-CLI (sdk-cli)
- SDK-related features
- SDK documentation

### Tristan-T-Dev - Frontend Side
**Areas**: Frontend, UI/UX
- Frontend (frontend)
- UI components
- User experience

## Project Structure

```
apps/
  hyperagent-api/    # Python/FastAPI backend
  hyperagent-web/    # Next.js frontend
services/
  orchestrator/      # LangGraph orchestration
  api-gateway/       # HTTP API gateway
  blockchain-gateway/ # Blockchain RPC abstraction
  agent-spec/        # Specification agent
  agent-codegen/     # CodeGenAgent
  agent-audit/       # AuditAgent
  agent-tenderly-sim/ # TenderlySimAgent
  agent-deploy/      # DeployAgent
  agent-verify/      # VerifyAgent
  agent-monitor/     # MonitorAgent
packages/
  sdk-ts/            # TypeScript SDK
  spec-dictionary/   # Spec Lock schemas
  rag-kb/            # RAG knowledge base
  chain-registry/    # Chain registry
  sdk-registry/      # SDK capability registry
  shared-ui/         # Shared UI components
  core-lib/          # Shared core libraries
infra/
  terraform/    # Infrastructure as Code
  github/       # GitHub Actions, workflows
contracts/
  evm/          # EVM contracts
  templates/    # Contract templates
external/       # Git submodules
docs/
  specs/        # Architecture specs
  runbooks/     # Operational runbooks
configs/
  presets/      # Preset registry YAML files
```

## Environment Configuration

### Development
- Use `.env` for environment-specific config; production uses cloud DB (Supabase) and Redis (Redis Cloud or container)
- Docker Compose for backend stack (cloud config via DATABASE_URL, REDIS_URL)
- K8s overlays for development environment

### Staging
- Use `.env.staging` for staging environment
- ArgoCD auto-sync from `development` branch
- Full observability stack enabled

### Production
- Use `.env.production` for production
- ArgoCD manual sync from `main` branch tags
- Canary deployments enabled
- SLO monitoring active

## GitHub Projects Integration

### Project 9 Configuration
- All Phase 1-3 issues linked to GitHub Project 9
- Custom fields: Sprint, Type, Area, Chain, Preset
- Milestones: Phase 1 – Sprint 1/2/3 with exact dates
- Assignment based on team roles

### Issue Creation
- Use `scripts/github/create_phase1_issues.py`
- Configuration in `.env.issue`
- CSV source: `scripts/data/issues.csv`
- All issues include detailed bodies with code examples

## Quality Gates

### Pre-Commit
- Linting (Black, isort, ESLint, Prettier)
- Type checking (mypy, TypeScript strict)
- Security scanning (Snyk, Dependabot)

### Pre-Merge
- All tests passing
- Code coverage above 80%
- No critical security issues
- Documentation updated

### Pre-Release
- Full E2E test suite passing
- Performance benchmarks met
- Security audit completed
- Release notes prepared

## Security Practices

### Secrets Management
- Never commit secrets to repository
- Use environment variables
- Use secret management services
- Rotate credentials regularly

### Code Security
- Prompt-injection guardrails
- Input validation on all endpoints
- Rate limiting per workspace
- Row-level security (RLS) in Supabase

### Smart Contract Security
- Automated audits (Slither, Mythril, MythX, Echidna)
- Tenderly simulations before deployment
- Human review for high-value contracts
- Bug bounty program

## Monitoring & Observability

### Metrics
- OpenTelemetry for distributed tracing
- Prometheus for metrics collection
- Grafana for visualization
- MLflow for model routing experiments

### Logging
- Structured logging (JSON format)
- Log levels: DEBUG, INFO, WARNING, ERROR
- Centralized log aggregation
- Retention policies enforced

### Alerts
- SLO violations
- Error rate spikes
- Security incidents
- Performance degradation

## Documentation Standards

### README Files
- Project overview and purpose
- Quick start guide
- Installation instructions
- Usage examples
- API reference links

### Code Documentation
- Docstrings for all public functions
- Type hints for all parameters
- Inline comments for complex logic
- Architecture diagrams where needed

### API Documentation
- OpenAPI/Swagger specifications
- Request/response examples
- Error codes and handling
- Authentication requirements

## Contributing

### Process
1. Fork the repository
2. Create a feature branch from `development`
3. Make changes following standards
4. Write tests for new features
5. Update documentation
6. Submit pull request
7. Address review feedback
8. Merge after approval

### Code Review
- Minimum 2 approvals required
- All CI checks must pass
- No blocking issues
- Documentation updated

## License

See LICENSE file for details.

## Support

- GitHub Issues for bug reports
- GitHub Discussions for questions
- Security issues: See SECURITY.md

