# HyperAgent Technology Stack & Libraries

**Last Updated**: December 2025  
**Version**: 1.0.0

This document provides a comprehensive overview of all technologies, frameworks, libraries, and SDKs used in the HyperAgent platform, organized by category and purpose.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Backend Stack](#backend-stack)
- [Frontend Stack](#frontend-stack)
- [Blockchain & Web3](#blockchain--web3)
- [AI & LLM](#ai--llm)
- [Database & Storage](#database--storage)
- [DevOps & Infrastructure](#devops--infrastructure)
- [Testing & Quality](#testing--quality)
- [Security](#security)
- [Monitoring & Observability](#monitoring--observability)
- [Development Tools](#development-tools)
- [Version Matrix](#version-matrix)

---

## Architecture Overview

HyperAgent follows a **modern full-stack architecture** with clear separation of concerns:

- **Backend**: Python 3.10+ with FastAPI (async REST API)
- **Frontend**: Next.js 16 with React 19 (TypeScript)
- **Database**: PostgreSQL 15+ with pgvector extension
- **Cache/Events**: Redis 7+ with Streams
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions

**Architecture Pattern**: Service-Oriented Architecture (SOA) with Event-Driven Design

---

## Backend Stack

### Core Framework

| Library | Version | Purpose | Documentation |
|---------|---------|---------|---------------|
| **Python** | 3.10+ | Primary language | [python.org](https://www.python.org/) |
| **FastAPI** | 0.115.0 | Async web framework | [fastapi.tiangolo.com](https://fastapi.tiangolo.com/) |
| **Uvicorn** | 0.32.0 | ASGI server | [uvicorn.org](https://www.uvicorn.org/) |
| **Pydantic** | 2.10.0 | Data validation | [pydantic.dev](https://docs.pydantic.dev/) |
| **Pydantic Settings** | 2.6.0 | Configuration management | [pydantic.dev](https://docs.pydantic.dev/2.0/usage/settings/) |
| **Email Validator** | 2.2.0 | Email validation | [pypi.org/project/email-validator](https://pypi.org/project/email-validator/) |

### Async & Concurrency

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **aiohttp** | 3.12.14 | Async HTTP client/server | Fixed: Multiple CVEs |
| **httpx** | 0.27.2 | Modern HTTP client | Alternative to requests |
| **redis[async]** | 5.2.0 | Async Redis client | Primary cache/event bus |
| **aioredis** | 2.0.1 | Legacy async Redis | Fallback support |

### Database & ORM

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **SQLAlchemy** | 2.0.36 | ORM & database toolkit | Async support |
| **Alembic** | 1.14.0 | Database migrations | Schema versioning |
| **asyncpg** | 0.30.0 | Async PostgreSQL driver | High performance |
| **psycopg2-binary** | 2.9.10 | PostgreSQL adapter | Sync fallback |
| **pgvector** | 0.3.0 | Vector similarity search | RAG system |

### CLI & Terminal

| Library | Version | Purpose |
|---------|---------|---------|
| **Click** | 8.1.8 | CLI framework |
| **Rich** | 13.8.0 | Terminal formatting & progress |

---

## Frontend Stack

### Core Framework

| Library | Version | Purpose | Documentation |
|---------|---------|---------|---------------|
| **Next.js** | 16.0.7 | React framework | [nextjs.org](https://nextjs.org/) |
| **React** | 19.2.1 | UI library | [react.dev](https://react.dev/) |
| **React DOM** | 19.2.1 | React renderer | [react.dev](https://react.dev/) |
| **TypeScript** | 5.x | Type safety | [typescriptlang.org](https://www.typescriptlang.org/) |

### UI Components & Styling

| Library | Version | Purpose |
|---------|---------|---------|
| **Tailwind CSS** | 4.x | Utility-first CSS | [tailwindcss.com](https://tailwindcss.com/) |
| **@headlessui/react** | 2.2.9 | Unstyled UI components | [headlessui.com](https://headlessui.com/) |
| **@heroicons/react** | 2.2.0 | Icon library | [heroicons.com](https://heroicons.com/) |
| **lucide-react** | 0.554.0 | Icon library | [lucide.dev](https://lucide.dev/) |
| **framer-motion** | 12.23.25 | Animation library | [framer.com/motion](https://www.framer.com/motion/) |
| **clsx** | 2.1.1 | Conditional class names | [github.com/lukeed/clsx](https://github.com/lukeed/clsx) |
| **tailwind-merge** | 3.4.0 | Merge Tailwind classes | [github.com/dcastil/tailwind-merge](https://github.com/dcastil/tailwind-merge) |

### Data Visualization

| Library | Version | Purpose |
|---------|---------|---------|
| **recharts** | 3.4.1 | Chart library | [recharts.org](https://recharts.org/) |
| **d3-force** | 3.0.0 | Force-directed graphs | [d3js.org](https://d3js.org/) |

### Utilities

| Library | Version | Purpose |
|---------|---------|---------|
| **axios** | 1.13.2 | HTTP client | [axios-http.com](https://axios-http.com/) |
| **date-fns** | 4.1.0 | Date utilities | [date-fns.org](https://date-fns.org/) |
| **react-syntax-highlighter** | 16.1.0 | Code syntax highlighting | [github.com/react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) |

### Testing

| Library | Version | Purpose |
|---------|---------|---------|
| **Jest** | 29.7.0 | Testing framework | [jestjs.io](https://jestjs.io/) |
| **@testing-library/react** | 16.3.0 | React testing utilities | [testing-library.com](https://testing-library.com/) |
| **@testing-library/jest-dom** | 6.1.5 | DOM matchers | [github.com/testing-library/jest-dom](https://github.com/testing-library/jest-dom) |
| **@testing-library/user-event** | 14.5.1 | User interaction simulation | [testing-library.com](https://testing-library.com/docs/user-event/intro) |
| **jest-environment-jsdom** | 29.7.0 | DOM environment for Jest | [jestjs.io](https://jestjs.io/) |

### Code Quality

| Library | Version | Purpose |
|---------|---------|---------|
| **ESLint** | 9.x | Linting | [eslint.org](https://eslint.org/) |
| **eslint-config-next** | 16.0.7 | Next.js ESLint config | [nextjs.org](https://nextjs.org/docs/app/building-your-application/configuring/eslint) |
| **Prettier** | (via config) | Code formatting | [prettier.io](https://prettier.io/) |

---

## Blockchain & Web3

### Core Web3 Libraries

| Library | Version | Purpose | Documentation |
|---------|---------|---------|---------------|
| **web3.py** | 6.20.0 | Ethereum Python library | [web3py.readthedocs.io](https://web3py.readthedocs.io/) |
| **eth-account** | 0.10.0 | Ethereum account management | [eth-account.readthedocs.io](https://eth-account.readthedocs.io/) |
| **eth-keys** | 0.5.0 | Ethereum key operations | [github.com/ethereum/eth-keys](https://github.com/ethereum/eth-keys) |
| **eth-typing** | 5.2.1 | Ethereum type definitions | [github.com/ethereum/eth-typing](https://github.com/ethereum/eth-typing) |

### Blockchain SDKs

| SDK | Version | Purpose | Networks | Documentation |
|-----|---------|---------|----------|---------------|
| **Alith SDK** | ≥0.1.0 | Decentralized AI agent framework | All EVM chains | [alith.lazai.network](https://alith.lazai.network/) |
| **Thirdweb** | 5.112.4 | Web3 development platform | Multi-chain | [thirdweb.com](https://thirdweb.com/) |

### Solidity Compilation

| Library | Version | Purpose |
|---------|---------|---------|
| **py-solc-x** | 2.0.4 | Solidity compiler wrapper |
| **solc-select** | ≥1.1.0 | Solidity version manager |

### Supported Networks

- **Hyperion Testnet** (Chain ID: 133717)
- **Hyperion Mainnet** (Chain ID: 133718)
- **Mantle Testnet** (Chain ID: 5003)
- **Mantle Mainnet** (Chain ID: 5000)
- **Avalanche Fuji** (Chain ID: 43113)
- **Avalanche Mainnet** (Chain ID: 43114)

---

## AI & LLM

### LLM Providers

| Provider | Library | Version | Purpose | Documentation |
|----------|----------|---------|---------|---------------|
| **Google Gemini** | google-generativeai | 0.8.3 | Primary LLM | [ai.google.dev](https://ai.google.dev/) |
| **OpenAI** | openai | 1.54.0 | Fallback LLM | [platform.openai.com](https://platform.openai.com/) |

### LLM Framework

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **LangChain** | 0.3.27 | LLM application framework | Fixed: Multiple CVEs |
| **LangChain Community** | 0.3.27 | Community integrations | Fixed: Multiple CVEs |

### RAG (Retrieval-Augmented Generation)

- **Vector Storage**: PostgreSQL with pgvector extension
- **Embeddings**: Gemini/OpenAI embeddings (1536 dimensions)
- **Template Storage**: IPFS/Pinata (decentralized storage)
- **Similarity Search**: Cosine similarity via pgvector

---

## Database & Storage

### Primary Database

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| **PostgreSQL** | 15+ | Primary database | Recommended: Supabase |
| **pgvector** | 0.3.0 | Vector similarity | Extension for RAG |

### Cache & Event Bus

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| **Redis** | 7+ | Cache & event bus | Optional (in-memory fallback) |
| **Redis Streams** | (built-in) | Event persistence | A2A protocol |

### Decentralized Storage

| Service | Purpose | Implementation |
|---------|---------|-----------------|
| **IPFS/Pinata** | Template storage | JWT authentication |
| **EigenDA** | Data availability | REST API integration |

---

## DevOps & Infrastructure

### Containerization

| Technology | Purpose | Files |
|------------|---------|-------|
| **Docker** | Container runtime | `Dockerfile`, `Dockerfile.dev` |
| **Docker Compose** | Multi-container orchestration | `docker-compose.yml` |

### CI/CD

| Technology | Purpose | Files |
|------------|---------|-------|
| **GitHub Actions** | CI/CD pipelines | `.github/workflows/` |
| **Semantic Release** | Automated versioning | `.github/workflows/release.yml` |

### Build Tools

| Tool | Purpose | Files |
|------|---------|-------|
| **Make** | Build automation | `Makefile` |
| **npm** | Frontend package manager | `package.json`, `package-lock.json` |
| **pip** | Python package manager | `requirements.txt` |
| **Poetry** | Python dependency management | `pyproject.toml` (optional) |

---

## Testing & Quality

### Backend Testing

| Library | Version | Purpose |
|---------|---------|---------|
| **pytest** | 8.3.3 | Testing framework |
| **pytest-asyncio** | 0.24.0 | Async test support |
| **pytest-cov** | 6.0.0 | Coverage reporting |
| **pytest-mock** | 3.14.0 | Mocking utilities |

### Code Quality Tools

| Tool | Version | Purpose | Configuration |
|------|---------|---------|----------------|
| **Black** | 24.1.1 | Code formatter | `pyproject.toml` |
| **isort** | 5.13.2 | Import sorter | `pyproject.toml` |
| **MyPy** | 1.8.0 | Type checker | `pyproject.toml` |
| **Bandit** | 1.7.6 | Security linter | CLI |
| **pre-commit** | 3.6.0 | Git hooks | `.pre-commit-config.yaml` |

### Frontend Testing

See [Frontend Stack - Testing](#testing) section above.

---

## Security

### Security Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Slither** | 0.10.2 | Solidity static analyzer |
| **Mythril** | (via Docker) | Security analysis |
| **Echidna** | (via Docker) | Fuzz testing |

### Security Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **PyJWT** | 2.9.0 | JWT token handling |
| **cryptography** | 43.0.1 | Cryptographic primitives |
| **bcrypt** | 4.2.0 | Password hashing |
| **passlib[bcrypt]** | 1.7.4 | Password utilities |

---

## Monitoring & Observability

### Metrics & Monitoring

| Library | Version | Purpose |
|---------|---------|---------|
| **prometheus-client** | 0.21.0 | Prometheus metrics |
| **opentelemetry-api** | 1.28.0 | OpenTelemetry API |
| **opentelemetry-sdk** | 1.28.0 | OpenTelemetry SDK |

### Monitoring Stack

- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Health Checks**: Built-in endpoints

---

## Development Tools

### Python Development

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **venv** | Virtual environment | Built-in |
| **pip** | Package installer | `requirements.txt` |
| **setuptools** | Build system | `setup.py`, `pyproject.toml` |

### Node.js Development

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **npm** | Package manager | `package.json` |
| **Node.js** | Runtime | 18+ required |

### Version Control

| Tool | Purpose | Files |
|------|---------|-------|
| **Git** | Version control | `.git/` |
| **GitHub** | Hosting & CI/CD | `.github/` |

---

## Version Matrix

### Critical Security Versions

| Component | Minimum Version | Current Version | Reason |
|-----------|----------------|-----------------|--------|
| React | 19.2.1 | 19.2.1 | CVE-2025-55182 |
| Next.js | 16.0.7 | 16.0.7 | CVE-2025-66478 |
| LangChain | 0.3.27 | 0.3.27 | Multiple CVEs |
| FastAPI | 0.109.1+ | 0.115.0 | CVE-2024-24762 |
| aiohttp | 3.12.14 | 3.12.14 | Multiple CVEs |
| cryptography | 43.0.1+ | 43.0.1 | GHSA-h4gh-qq45-vh27 |

### Python Version Support

- **Minimum**: Python 3.10
- **Recommended**: Python 3.12
- **Tested**: Python 3.10, 3.11, 3.12

### Node.js Version Support

- **Minimum**: Node.js 18.0.0
- **Recommended**: Node.js 20.x LTS
- **Tested**: Node.js 18.x, 20.x

---

## Architecture Patterns

### Design Patterns

1. **Service-Oriented Architecture (SOA)**: Decoupled services with clear interfaces
2. **Event-Driven Architecture**: Redis Streams for event persistence
3. **Agent-to-Agent (A2A) Protocol**: Decoupled agent communication
4. **RAG (Retrieval-Augmented Generation)**: Template retrieval and similarity matching
5. **12-Factor App**: Configuration, dependencies, and environment management

### Code Organization

- **Backend**: `hyperagent/` - Modular Python package
- **Frontend**: `frontend/` - Next.js App Router structure
- **Tests**: `tests/` - Separate test directory
- **Scripts**: `scripts/` - Utility scripts
- **Docs**: `docs/` - Comprehensive documentation

---

## References

- [Backend Architecture Guide](./ARCHITECTURE_GUIDE.md)
- [Frontend README](../frontend/README.md)
- [Complete Tech Spec](./Framework/complete-tech-spec.md)
- [Security Policy](../SECURITY.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

**Last Updated**: December 2025  
**Maintained By**: HyperAgent Engineering Team

