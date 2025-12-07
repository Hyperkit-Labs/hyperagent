# HyperAgent Architecture Structure

**Last Updated**: December 2025  
**Version**: 1.0.0

This document describes the HyperAgent project structure, aligned with modern JavaScript/React and Python best practices, following **12-Factor App** principles and **Separation of Concerns (SoC)**.

---

## Table of Contents

- [High-Level Structure](#high-level-structure)
- [Root Directory](#root-directory)
- [Backend Structure (`hyperagent/`)](#backend-structure-hyperagent)
- [Frontend Structure (`frontend/`)](#frontend-structure-frontend)
- [Configuration Files](#configuration-files)
- [Documentation Structure](#documentation-structure)
- [Development Conventions](#development-conventions)
- [Modern Practices Applied](#modern-practices-applied)

---

## High-Level Structure

```
HyperAgent/
├── hyperagent/          # Backend Python package (application source)
├── frontend/            # Frontend Next.js application (application source)
├── tests/               # Test suite (separated from source)
├── scripts/             # Utility scripts (tooling)
├── docs/                # Documentation (knowledge base)
├── .github/             # CI/CD workflows and templates (infrastructure)
├── config/              # Configuration files (infrastructure)
├── public/              # Static assets (shared resources)
├── templates/           # Contract templates (data)
├── examples/            # Example files (data)
├── reference/           # Reference implementations (data)
│
├── [Root Config Files]  # Build, lint, format, deployment (tooling)
└── [Documentation]     # README, LICENSE, CONTRIBUTING (project metadata)
```

**Principle**: Clear separation between **application code**, **configuration**, **tooling**, and **documentation**.

---

## Root Directory

### Application Code (Not in Root)

Following modern conventions, **all application code lives in dedicated directories**:
- `hyperagent/` - Backend source
- `frontend/` - Frontend source
- `tests/` - Test code

### Root-Level Tooling & Configuration

The root contains **only tooling, config, and project metadata**:

#### Build & Deployment
- `Dockerfile` - Production container
- `docker-compose.yml` - Multi-container orchestration
- `Makefile` - Build automation
- `render.yaml` - Deployment config

#### Package Management
- `requirements.txt` - Python dependencies
- `pyproject.toml` - Python project config (Black, isort, MyPy)
- `package.json` - Root npm scripts (version management)
- `setup.py` - Python package setup

#### Code Quality
- `.pre-commit-config.yaml` - Git hooks (if used)
- `pytest.ini` - Pytest configuration
- `alembic.ini` - Database migration config

#### Environment & Secrets
- `env.example` - Environment variable template
- `.env` - Local environment (gitignored)

#### Documentation & Metadata
- `README.md` - Project overview
- `README.DOCKER.md` - Docker quick start
- `CHANGELOG.md` - Version history
- `SECURITY.md` - Security policy
- `LICENSE` - MIT License
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community standards
- `VERSION` - Current version

#### Database Migrations
- `alembic/` - Database migration scripts

**Principle**: Root stays clean with only essential tooling/config files.

---

## Backend Structure (`hyperagent/`)

### Python Package Organization

```
hyperagent/
├── __init__.py                    # Package initialization
│
├── agents/                        # Agent implementations (business logic)
│   ├── __init__.py
│   ├── coordinator.py            # Workflow orchestration
│   ├── generation.py            # Contract generation agent
│   ├── audit.py                  # Security audit agent
│   ├── testing.py                # Testing agent
│   └── deployment.py             # Deployment agent
│
├── api/                           # API layer (presentation)
│   ├── __init__.py
│   ├── main.py                   # FastAPI application
│   ├── routes/                   # Route handlers
│   ├── middleware/               # Middleware (x402, auth, etc.)
│   ├── models.py                 # Request/response models
│   └── dependencies.py          # Dependency injection
│
├── blockchain/                    # Blockchain integration (infrastructure)
│   ├── __init__.py
│   ├── networks.py               # Network configurations
│   ├── wallet.py                 # Wallet management
│   ├── mantle_sdk.py             # Mantle SDK wrapper
│   ├── alith_client.py           # Alith SDK client
│   ├── eigenda_client.py         # EigenDA client
│   └── [network clients]        # Network-specific clients
│
├── core/                          # Core business logic
│   ├── __init__.py
│   ├── config.py                 # Configuration management
│   ├── exceptions.py              # Custom exceptions
│   ├── services/                 # Business services
│   │   ├── deployment_service.py
│   │   ├── generation_service.py
│   │   └── [other services]
│   └── [core utilities]
│
├── db/                            # Database layer (infrastructure)
│   ├── __init__.py
│   ├── session.py                # Database session management
│   └── base.py                   # Base models
│
├── events/                        # Event system (infrastructure)
│   ├── __init__.py
│   ├── handlers.py               # Event handlers
│   └── publisher.py             # Event publisher
│
├── llm/                           # LLM integration (infrastructure)
│   ├── __init__.py
│   ├── provider.py              # LLM provider abstraction
│   └── acontext_client.py        # Acontext integration
│
├── rag/                           # RAG system (business logic)
│   ├── __init__.py
│   ├── template_retriever.py     # Template retrieval
│   └── [RAG utilities]
│
├── security/                      # Security tools (infrastructure)
│   ├── __init__.py
│   └── [security utilities]
│
├── utils/                         # Utility functions (shared)
│   ├── __init__.py
│   └── [utility modules]
│
└── cli/                           # CLI interface (presentation)
    ├── __init__.py
    ├── main.py                   # CLI entry point
    ├── commands/                 # Command modules
    │   ├── workflow.py
    │   ├── contract.py
    │   ├── deployment.py
    │   ├── system.py
    │   └── template.py
    └── shared.py                 # Shared CLI utilities
```

**Principles**:
- **Layered Architecture**: API → Core → Infrastructure
- **Domain-Driven Design**: Agents, Services, Core logic
- **Dependency Injection**: Clear interfaces between layers
- **Separation of Concerns**: Each module has a single responsibility

---

## Frontend Structure (`frontend/`)

### Next.js App Router Structure

Following **Next.js 16 App Router conventions**:

```
frontend/
├── app/                           # Next.js App Router (application source)
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   ├── globals.css               # Global styles
│   ├── favicon.ico               # Favicon
│   │
│   ├── workflows/                 # Workflow pages
│   │   ├── page.tsx              # List view
│   │   ├── create/               # Create workflow
│   │   └── [id]/                 # Detail view
│   │
│   ├── contracts/                # Contract pages
│   ├── deployments/              # Deployment pages
│   ├── templates/                # Template pages
│   ├── monitoring/               # Monitoring page
│   ├── architecture/             # Architecture visualization
│   └── avax/                     # Avalanche-specific pages
│       ├── analytics/
│       ├── payments/
│       └── studio/
│
├── components/                    # React components (application source)
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── [other UI components]
│   │
│   ├── workflows/                # Workflow-specific components
│   ├── contracts/                # Contract components
│   ├── deployments/              # Deployment components
│   ├── templates/                # Template components
│   ├── analytics/                # Analytics components
│   ├── spending/                 # Spending controls
│   ├── x402/                     # x402 payment components
│   ├── architecture/             # Architecture components
│   ├── layout/                   # Layout components
│   └── providers/                # Context providers
│
├── hooks/                         # Custom React hooks (application source)
│   ├── useWorkflow.ts
│   ├── useWebSocket.ts
│   ├── usePolling.ts
│   └── useHealth.ts
│
├── lib/                           # Utility libraries (application source)
│   ├── api.ts                    # API client
│   ├── types.ts                  # TypeScript types
│   ├── utils.ts                  # Utility functions
│   ├── websocket.ts              # WebSocket client
│   ├── thirdwebClient.ts         # Thirdweb client
│   └── [other lib modules]
│
├── public/                        # Static assets (public resources)
│   ├── *.svg                     # SVG icons
│   └── [other static files]
│
├── __tests__/                     # Test files (testing)
│   └── example.test.tsx
│
├── [Config Files]                 # Build, lint, format (tooling)
│   ├── next.config.ts            # Next.js configuration
│   ├── tsconfig.json             # TypeScript configuration
│   ├── eslint.config.mjs         # ESLint configuration
│   ├── postcss.config.mjs        # PostCSS configuration
│   ├── jest.config.js            # Jest configuration
│   ├── jest.setup.js             # Jest setup
│   ├── package.json               # Dependencies & scripts
│   └── package-lock.json         # Dependency lock file
│
└── Dockerfile.dev                 # Development container
```

**Principles**:
- **Next.js App Router**: File-based routing
- **Component Co-location**: Components near their usage
- **TypeScript First**: Type safety throughout
- **Separation**: `app/`, `components/`, `lib/`, `hooks/` are clearly separated

---

## Configuration Files

### Root-Level Configs

| File | Purpose | Technology |
|------|---------|------------|
| `Dockerfile` | Production container | Docker |
| `docker-compose.yml` | Multi-container setup | Docker Compose |
| `Makefile` | Build automation | Make |
| `requirements.txt` | Python dependencies | pip |
| `pyproject.toml` | Python project config | Python |
| `package.json` | Root npm scripts | npm |
| `pytest.ini` | Test configuration | pytest |
| `alembic.ini` | Migration config | Alembic |

### Frontend Configs

| File | Purpose | Technology |
|------|---------|------------|
| `frontend/next.config.ts` | Next.js config | Next.js |
| `frontend/tsconfig.json` | TypeScript config | TypeScript |
| `frontend/eslint.config.mjs` | Linting rules | ESLint |
| `frontend/postcss.config.mjs` | CSS processing | PostCSS |
| `frontend/jest.config.js` | Test config | Jest |
| `frontend/package.json` | Dependencies | npm |

**Principle**: Configuration files live at the appropriate level (root for project-wide, subdirectory for component-specific).

---

## Documentation Structure

### Documentation Organization

```
docs/
├── TECH_STACK.md                 # Technology stack (this file)
├── ARCHITECTURE_STRUCTURE.md      # Structure guide (this file)
├── ARCHITECTURE_GUIDE.md         # Architecture overview
├── ARCHITECTURE_DIAGRAMS.md      # Visual diagrams
├── ENGINEERING_OVERVIEW.md       # Engineering practices
├── PRODUCTION_READINESS.md        # Production checklist
├── SECURITY_AUDIT.md             # Security documentation
├── DEPLOYMENT.md                 # Deployment guide
├── INTEGRATION.md                # Integration guide
├── TESTING_SETUP_GUIDE.md        # Testing guide
├── TROUBLESHOOTING.md            # Troubleshooting
│
└── Framework/                    # Detailed framework docs
    ├── README.md                 # Framework overview
    ├── 01_system_architecture.md
    ├── 02_api_design.md
    └── [other framework docs]

GUIDE/
├── GETTING_STARTED.md            # Quick start
├── DEVELOPER_GUIDE.md            # Developer onboarding
├── DOCKER.md                     # Docker reference
├── API.md                        # API documentation
└── [other guides]
```

**Principle**: Documentation is comprehensive, organized, and discoverable.

---

## Development Conventions

### Naming Conventions

#### Python (Backend)
- **Packages**: `snake_case` (e.g., `hyperagent/`)
- **Modules**: `snake_case.py` (e.g., `deployment_service.py`)
- **Classes**: `PascalCase` (e.g., `DeploymentService`)
- **Functions/Variables**: `snake_case` (e.g., `deploy_contract`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)

#### TypeScript/React (Frontend)
- **Components**: `PascalCase.tsx` (e.g., `WorkflowCard.tsx`)
- **Hooks**: `camelCase` with `use` prefix (e.g., `useWorkflow.ts`)
- **Utilities**: `camelCase.ts` (e.g., `api.ts`)
- **Types/Interfaces**: `PascalCase` (e.g., `WorkflowStatus`)

#### Files & Directories
- **Directories**: `kebab-case` or `snake_case` (consistent per project)
- **Config Files**: Standard names (`package.json`, `tsconfig.json`, etc.)

### Code Organization Principles

1. **Single Responsibility**: Each module/component has one clear purpose
2. **Dependency Injection**: Dependencies passed explicitly
3. **Interface Segregation**: Small, focused interfaces
4. **DRY (Don't Repeat Yourself)**: Shared utilities in `lib/` or `utils/`
5. **Separation of Concerns**: Clear boundaries between layers

---

## Modern Practices Applied

### 1. Monorepo-Style but Minimal Root

✅ **Applied**: Most code lives in `hyperagent/` and `frontend/`, root contains only tooling/config.

### 2. Clear Separation of Concerns

✅ **Applied**:
- `hyperagent/` → Backend application code
- `frontend/` → Frontend application code
- `tests/` → Test code
- `scripts/` → Utility scripts
- `docs/` → Documentation
- Root → Tooling, config, metadata

### 3. 12-Factor App Principles

✅ **Applied**:
- **Codebase**: Single codebase, multiple deployments
- **Dependencies**: Explicitly declared (`requirements.txt`, `package.json`)
- **Config**: Environment-based (`env.example`, `.env`)
- **Backing Services**: PostgreSQL, Redis as attached resources
- **Build, Release, Run**: Docker for build/release separation
- **Processes**: Stateless processes (FastAPI, Next.js)
- **Port Binding**: Services export via ports
- **Concurrency**: Process model (async Python, Next.js)
- **Disposability**: Fast startup/shutdown (Docker)
- **Dev/Prod Parity**: Docker Compose for local dev
- **Logs**: Structured logging
- **Admin Processes**: CLI tools (`hyperagent/cli/`)

### 4. Root-Level Tooling Config

✅ **Applied**:
- ESLint: `frontend/eslint.config.mjs`
- Prettier: (via ESLint config)
- Black/isort: `pyproject.toml`
- Docker: `Dockerfile`, `docker-compose.yml`
- Make: `Makefile`

### 5. GitHub-Native OSS Conventions

✅ **Applied**:
- `LICENSE` - MIT License
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community standards
- `.github/` - Workflows, templates, CODEOWNERS
- `SECURITY.md` - Security policy
- `CHANGELOG.md` - Version history

### 6. Standard Project Layout

✅ **Applied**:
- **Backend**: Python package structure (`hyperagent/`)
- **Frontend**: Next.js App Router structure (`frontend/app/`)
- **Tests**: Separate test directory (`tests/`)
- **Config**: Root-level and component-level configs
- **Docs**: Comprehensive documentation (`docs/`, `GUIDE/`)

---

## Directory Purpose Summary

| Directory | Purpose | Type |
|-----------|---------|------|
| `hyperagent/` | Backend Python package | Application Code |
| `frontend/` | Frontend Next.js app | Application Code |
| `tests/` | Test suite | Testing |
| `scripts/` | Utility scripts | Tooling |
| `docs/` | Documentation | Knowledge Base |
| `GUIDE/` | User/developer guides | Knowledge Base |
| `.github/` | CI/CD workflows | Infrastructure |
| `config/` | Configuration files | Infrastructure |
| `public/` | Static assets | Resources |
| `templates/` | Contract templates | Data |
| `examples/` | Example files | Data |
| `reference/` | Reference code | Data |
| Root | Tooling & metadata | Tooling |

---

## References

- [Tech Stack Documentation](./TECH_STACK.md)
- [Architecture Guide](./ARCHITECTURE_GUIDE.md)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Python Package Structure](https://packaging.python.org/en/latest/guides/packaging-projects/)
- [12-Factor App](https://12factor.net/)
- [Microsoft Engineering Fundamentals](https://github.com/microsoft/engineering-fundamentals)

---

**Last Updated**: December 2025  
**Maintained By**: HyperAgent Engineering Team

