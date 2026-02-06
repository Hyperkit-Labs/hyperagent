<div align="center">
  <img src="/public/ascii-art-doh-HyperAgent.png" alt="HyperAgent ASCII Art" width="800">
  
<!-- Badges: start -->
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![Status](https://img.shields.io/badge/status-active-success)
<!-- Badges: end -->

HyperAgent is an AI-powered smart contract development platform that transforms natural language specifications into production-ready, audited contracts deployed across multiple EVM chains in minutes.

</div>

## Table of Contents

- [Overview](#overview)
- [Project Status](#project-status)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start](#quick-start)
- [Features](#features)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

HyperAgent enables developers to build production-grade smart contracts in under 2 minutes by leveraging AI-powered code generation, automated security auditing, and multi-chain deployment capabilities.

**Key Capabilities:**
- Natural language to Solidity contract generation
- Automated security auditing with static analysis
- Multi-chain deployment across 100+ EVM networks
- Native x402 payment protocol integration
- Account abstraction with EIP-7702 and ERC-4337
- Real-time monitoring and analytics

## Project Status

**Current Phase:** Phase 1 - Foundation (In Progress)

**Monorepo Migration:** ✅ Complete
- All code migrated to monorepo structure
- pnpm workspace configured
- Turbo build system integrated
- Services organized and operational

**Active Development:**
- Core orchestration and data model
- Agent implementations
- Frontend shell and run view
- Multi-tenant workspaces
- CI/CD and quality gates

**Production Ready:**
- Mantle SDK integration
- Thirdweb x402 payments
- Supabase database
- IPFS/Pinata storage
- Multi-LLM routing

## Monorepo Structure

HyperAgent uses a monorepo architecture managed with pnpm workspaces and Turbo:

```
hyperagent/
├── apps/                          # Applications
│   ├── hyperagent-api/           # Python/FastAPI backend
│   ├── hyperagent-web/           # Next.js frontend
│   ├── issue-automation/         # GitHub Projects automation
│   └── worker/                   # Background jobs
│
├── services/                      # Microservices
│   ├── orchestrator/             # LangGraph orchestration
│   ├── api-gateway/              # HTTP API gateway
│   ├── mantle-bridge/            # Mantle SDK bridge
│   ├── x402-verifier/           # x402 payment verifier
│   └── agents/                   # Agent implementations
│       ├── codegen/              # Code generation agent
│       ├── audit/                # Security audit agent
│       ├── deploy/               # Deployment agent
│       └── monitor/              # Monitoring agent
│
├── packages/                      # Shared packages
│   ├── sdk-ts/                   # TypeScript SDK
│   ├── shared-ui/                # Shared React components
│   ├── config/                   # Configuration utilities
│   ├── core-lib/                 # Core domain logic
│   ├── cli/                      # CLI tool
│   └── env/                      # Environment loader
│
├── contracts/                    # Smart contracts
│   ├── evm/                      # EVM contract projects
│   └── templates/                # Contract templates
│
├── infra/                        # Infrastructure
│   ├── k8s/                      # Kubernetes manifests
│   ├── docker/                   # Docker configurations
│   └── terraform/                # Infrastructure as Code
│
├── docs/                         # Documentation
│   ├── specs/                    # Architecture specs
│   ├── implementation/           # Implementation tracking
│   └── runbooks/                # Operational guides
│
└── tools/                        # Development tools
    └── scripts/                  # Automation scripts
```

## Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **pnpm** 8.0 or higher (package manager)
- **Python** 3.11 or higher
- **PostgreSQL** 15+ (or Supabase)
- **Redis** 7.0+ (optional)
- **Git** 2.30+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hyperkit-Labs/hyperagent.git
   cd hyperagent
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development servers**
   ```bash
   # Start all apps and services
   pnpm turbo dev

   # Or start specific services
   pnpm turbo dev --filter hyperagent-api
   pnpm turbo dev --filter hyperagent-web
   ```

5. **Verify installation**
   - API: http://localhost:8000/api/v1/health
   - Web: http://localhost:3000

### Using Turbo Commands

```bash
# Run lint across all packages
pnpm turbo lint

# Run tests
pnpm turbo test

# Build all packages
pnpm turbo build

# Run for specific package
pnpm turbo lint --filter hyperagent-web
pnpm turbo build --filter @hyperagent/sdk-ts
```

## Features

- **AI-Powered Generation** - Multi-LLM routing with Claude 4.5, GPT-4, Gemini, Llama 3.1
- **Security Auditing** - Automated static analysis with Slither and dynamic testing
- **Multi-Chain Deployment** - Deploy to 100+ EVM networks from a single workflow
- **x402 Payments** - Native USDC-based micro-payments via Thirdweb
- **Account Abstraction** - EIP-7702 and ERC-4337 support for gasless transactions
- **Real-Time Monitoring** - WebSocket updates and comprehensive analytics
- **Developer Experience** - TypeScript SDK, CLI tools, and comprehensive documentation

## Documentation

- **[Architecture Guide](./docs/ARCHITECTURE_SIMPLIFIED.md)** - System design and patterns
- **[API Reference](./GUIDE/API.md)** - Complete API documentation
- **[Environment Configuration](./ENV_CONFIGURATION_GUIDE.md)** - Environment variables guide
- **[Getting Started](./GUIDE/GETTING_STARTED.md)** - Detailed setup instructions
- **[x402 Integration](./docs/billing/x402_integration.md)** - Payment protocol guide
- **[Implementation Tracking](./docs/implementation/)** - Issue tracking and progress

## Contributing

We welcome contributions. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Quick Start for Contributors:**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm turbo test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## Support

- **Documentation**: [docs/](./docs/) - Complete architecture and API documentation
- **Issues**: [GitHub Issues](https://github.com/Hyperkit-Labs/hyperagent/issues) - Report bugs or request features
- **Discussions**: [GitHub Discussions](https://github.com/Hyperkit-Labs/hyperagent/discussions) - Ask questions and share ideas

## Acknowledgments

### Core Technologies
- [FastAPI](https://fastapi.tiangolo.com/) - Python backend framework
- [Next.js](https://nextjs.org/) - React frontend framework
- [Supabase](https://supabase.com/) - PostgreSQL database
- [Turbo](https://turbo.build/) - Monorepo build system
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager

### Web3 Infrastructure
- [Thirdweb](https://thirdweb.com/) - x402 payments and wallet SDK
- [Mantle Network](https://www.mantle.xyz/) - L2 scaling and cross-chain messaging
- [EigenDA](https://www.eigenlayer.xyz/) - Data availability layer
- [Pinata](https://www.pinata.cloud/) - IPFS gateway

### AI & LLM Providers
- [Anthropic Claude](https://www.anthropic.com/) - Primary AI generation
- [OpenAI](https://openai.com/) - GPT-4 Turbo integration
- [Google Gemini](https://deepmind.google/technologies/gemini/) - Gemini 1.5 Pro
- [Meta Llama](https://ai.meta.com/llama/) - Llama 3.1 open-source option

---

Built with ❤️ by the HyperAgent team
