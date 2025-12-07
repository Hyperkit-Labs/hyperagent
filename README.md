<div align="center">
  <img src="/public/ascii-art-doh-HyperAgent.png" alt="HyperAgent ASCII Art" width="800">
</div>

<!-- Badges: start -->
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Status](https://img.shields.io/badge/status-production%20ready-success)
<!-- Badges: end -->

## Overview

HyperAgent is an AI-powered platform that streamlines smart contract development, security auditing, and deployment across multiple blockchain networks. By combining Large Language Models (LLMs), Retrieval-Augmented Generation (RAG), and blockchain technology, HyperAgent automates the entire smart contract lifecycle—from natural language prompts to production-ready, audited, and deployed contracts.

**Key Benefits**:
- Accelerate smart contract development from days to minutes
- Automated security auditing with industry-standard tools
- Multi-chain deployment support (Hyperion, Mantle, and more)
- Production-ready contracts with constructor argument generation
- Real-time progress tracking and workflow monitoring

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

## Features

- 🔍 **AI-Powered Contract Generation** - Convert natural language descriptions into Solidity smart contracts using LLM (Gemini/GPT-4)
- 🛡️ **Automated Security Auditing** - Comprehensive security analysis using Slither, Mythril, and Echidna
- 🧪 **Automated Testing** - Compile contracts and generate unit tests automatically
- 🚀 **On-Chain Deployment** - Deploy contracts to Hyperion, Mantle, and Avalanche networks
- 💳 **x402 Payment Gating** - Pay-per-use smart contract generation on Avalanche networks
- 👛 **User-Wallet-Based Deployments** - Deploy contracts using your own wallet (no server private keys needed)
- ⛽ **Gasless Deployments** - Optional facilitator-sponsored gas for seamless UX
- 📚 **RAG-Enhanced Generation** - Retrieve similar contract templates for better code quality
- ⚡ **Parallel Batch Deployment** - Deploy multiple contracts in parallel using Hyperion PEF (10-50x faster)
- 🎯 **MetisVM Optimization** - Generate contracts optimized for MetisVM with floating-point and AI inference support
- 💾 **EigenDA Integration** - Store contract metadata on EigenDA for cost-efficient data availability
- 📊 **Real-Time Progress Tracking** - Monitor workflow progress with live updates
- 🔧 **Constructor Argument Generation** - Automatically extract and generate constructor values from NLP descriptions

## Quick Start

### Prerequisites

#### Required Software

1. **Python 3.10 or higher**
   - **Windows**: Download from [python.org/downloads/windows](https://www.python.org/downloads/windows/)
   - **macOS**: Download from [python.org/downloads/mac-osx](https://www.python.org/downloads/mac-osx/) or use Homebrew: `brew install python`
   - **Linux**: Use package manager (e.g., `sudo apt-get install python3` on Ubuntu)
   - Verify installation: `python --version`

2. **PostgreSQL 15+** (or use Supabase cloud - **Recommended**)
   - **Recommended**: Use [Supabase](https://supabase.com) (free tier available) - no local setup needed
   - **Local Option**: Download from [postgresql.org/download](https://www.postgresql.org/download/)
   - See [GUIDE/SIMPLIFIED_SETUP.md](./GUIDE/SIMPLIFIED_SETUP.md) for Supabase setup

3. **Redis 7+** (Optional - uses in-memory fallback if not available)
   - **Not Required**: HyperAgent works without Redis for single-instance deployments
   - **Only Needed**: For multiple instances or distributed deployments
   - **Cloud Option**: Use [Redis Cloud](https://redis.com/try-free/) (free tier available)

4. **Git**
   - **Windows**: Download from [git-scm.com/download/win](https://git-scm.com/download/win)
   - **macOS**: Download from [git-scm.com/download/mac](https://git-scm.com/download/mac) or use Homebrew: `brew install git`
   - **Linux**: Use package manager (e.g., `sudo apt-get install git` on Ubuntu)
   - Verify installation: `git --version`

#### Optional but Recommended

5. **Node.js 18+** (for Hardhat/Foundry contract testing)
   - **All Platforms**: Download from [nodejs.org/en/download](https://nodejs.org/en/download/)
   - **macOS**: Use Homebrew: `brew install node`
   - **Linux**: Use package manager (e.g., `sudo apt-get install nodejs npm` on Ubuntu)
   - Verify installation: `node --version`

6. **Docker** (for containerized development)
   - **Windows/macOS**: Download Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   - **Linux**: Follow [Docker installation guide](https://docs.docker.com/engine/install/)
   - Verify installation: `docker --version`

7. **GNU Make** (for build automation)
   - **Windows**: Download GnuWin's Make from [gnuwin32.sourceforge.net/packages/make.htm](http://gnuwin32.sourceforge.net/packages/make.htm)
   - **macOS**: Usually pre-installed. If not: `brew install make`
   - **Linux**: Usually pre-installed. If not: `sudo apt-get install build-essential` (includes make)
   - Verify installation: `make --version`

8. **Visual Studio Code** (recommended IDE)
   - **All Platforms**: Download from [code.visualstudio.com/download](https://code.visualstudio.com/download)
   - **Linux**: Follow [VS Code installation guide](https://code.visualstudio.com/docs/setup/linux)

#### Required API Keys

- **Google Gemini API Key** (Required for contract generation)
  - Get from: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **OpenAI API Key** (Optional - fallback LLM provider)
  - Get from: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Thirdweb Client ID & Secret Key** (Required for x402 payments on Avalanche)
  - Get from: [portal.thirdweb.com](https://portal.thirdweb.com)
  - Create ERC-4337 Smart Account in Server Wallets section

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JustineDevs/HyperAgent.git
   cd Hyperkit_agent
   ```

2. **Create and activate virtual environment**
   ```bash
   # Create virtual environment
   python -m venv venv
   
   # Activate (Windows Git Bash)
   source venv/Scripts/activate
   
   # Activate (Windows Command Prompt)
   venv\Scripts\activate
   
   # Activate (macOS/Linux)
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

5. **Initialize database**
   ```bash
   alembic upgrade head
   ```

6. **Start the services**
   
   **Option A: Simplified Setup (Recommended for Production)**
   ```bash
   # Direct Python execution (no Docker needed)
   # See GUIDE/SIMPLIFIED_SETUP.md for details
   uvicorn hyperagent.api.main:app --reload
   ```
   
   **Option B: Docker Compose (Development Only)**
   ```bash
   # Using Docker Compose (includes x402 service, database, Redis)
   # Note: Docker is for local development only
   # For production, use direct Python deployment (see render.yaml)
   docker-compose up -d
   ```

7. **Verify x402 setup** (if using x402 payments)
   ```bash
   python scripts/verify_x402_setup.py
   ```

7. **Verify installation**
   ```bash
   # Check system health
   hyperagent system health
   
   # Or via API
   curl http://localhost:8000/api/v1/health/
   ```

For detailed setup instructions, see [Getting Started Guide](./GUIDE/GETTING_STARTED.md).

### Frontend (Optional)

HyperAgent includes a Next.js web frontend for non-developers:

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access the frontend**
   - Open [http://localhost:3000](http://localhost:3000) in your browser
   - Create workflows, view contracts, and monitor deployments through the web interface

See [Frontend README](./frontend/README.md) for detailed frontend documentation.

### Monitoring with Prometheus

HyperAgent includes Prometheus for system monitoring:

1. **Start monitoring service** (included in docker-compose)
   ```bash
   docker-compose up -d prometheus
   ```

2. **Access Prometheus**
   - URL: [http://localhost:9090](http://localhost:9090)
   - Metrics endpoint: [http://localhost:9090/metrics](http://localhost:9090/metrics)
   - Pre-configured dashboards:
     - System Health Dashboard
     - Workflow Metrics Dashboard
     - Agent Performance Dashboard

3. **Access Prometheus**
   - URL: [http://localhost:9090](http://localhost:9090)
   - Metrics endpoint: `http://localhost:8000/api/v1/metrics/prometheus`

## Usage

### Basic Workflow: Generate and Deploy Contract

```bash
# Create a workflow with constructor arguments
hyperagent workflow create \
  -d "Create an ERC20 token with name 'HYPERAGENT', symbol 'HYPE', and initial supply of 10000" \
  --network hyperion_testnet \
  --type ERC20 \
  --watch

# Monitor workflow progress
hyperagent workflow status --workflow-id <workflow-id> --watch

# View generated contract
hyperagent contract view <contract-id>
```

### Advanced: MetisVM Optimization

```bash
# Generate contract optimized for MetisVM
hyperagent workflow create \
  --description "Create a financial derivative contract with floating-point pricing" \
  --network hyperion_testnet \
  --optimize-metisvm \
  --enable-fp
```

### Batch Deployment with PEF

```bash
# Deploy multiple contracts in parallel
hyperagent deployment batch \
  --contracts-file examples/batch_deployment_example.json \
  --network hyperion_testnet \
  --use-pef \
  --max-parallel 10
```

### Python API Example

```python
import httpx

# Create workflow
response = httpx.post(
    "http://localhost:8000/api/v1/workflows/generate",
    json={
        "nlp_input": "Create an ERC20 token with 1 million supply",
        "network": "hyperion_testnet",
        "contract_type": "ERC20"
    }
)
workflow = response.json()
workflow_id = workflow["workflow_id"]

# Monitor progress
status = httpx.get(
    f"http://localhost:8000/api/v1/workflows/{workflow_id}"
).json()
print(f"Status: {status['status']}, Progress: {status['progress_percentage']}%")
```

See [Usage Examples](./GUIDE/GETTING_STARTED.md#example-workflows) for more examples.

## x402 Payment Gating

HyperAgent supports pay-per-use smart contract generation on Avalanche networks using the x402 payment protocol. Users pay in USDC for each service (contract generation, deployment, etc.) with full spending controls and payment history tracking.

### What is x402?

x402 is a payment protocol that enables pay-per-use APIs on blockchain networks. When a user requests a service:
1. Backend checks if payment exists
2. If not, returns HTTP 402 "Payment Required"
3. Frontend shows payment modal
4. User approves USDC spend in wallet
5. Payment is processed on-chain
6. Original request proceeds with payment proof

### Architecture Overview

```
┌─────────────┐
│   Frontend  │
│  (Next.js)  │
└──────┬──────┘
       │
       │ 1. Request Service
       │    (e.g., /x402/contracts/generate)
       ▼
┌─────────────────────────────────────┐
│         Backend API                 │
│      (FastAPI)                      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   x402 Middleware            │  │
│  │  - Check spending controls   │  │
│  │  - Verify payment status      │  │
│  │  - Log payments               │  │
│  └──────────────────────────────┘  │
│            │                        │
│            │ 2. Check Payment       │
│            ▼                        │
│  ┌──────────────────────────────┐  │
│  │   x402-Verifier Service       │  │
│  │  (Thirdweb Integration)       │  │
│  │  - Verify USDC approval       │  │
│  │  - Check on-chain payment     │  │
│  └──────────────────────────────┘  │
│            │                        │
│            │ 3. Payment Status      │
│            │    (200 or 402)        │
│            ▼                        │
│  ┌──────────────────────────────┐  │
│  │   Service Handler             │  │
│  │  (Contract Generation, etc.)   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
       │
       │ 4. Payment Logged
       ▼
┌─────────────┐
│  Database   │
│ (PostgreSQL)│
│             │
│ - Payment   │
│   History   │
│ - Spending  │
│   Controls  │
└─────────────┘
```

### Payment Flow

1. **User Request**: Frontend makes API request (e.g., generate contract)
2. **Backend Check**: x402 middleware checks if payment exists
3. **Payment Required**: If not paid, backend returns 402 with JWT token
4. **Frontend Modal**: Payment modal appears with price and details
5. **Wallet Approval**: User approves USDC spend in wallet (Core, MetaMask, etc.)
6. **On-Chain Payment**: Transaction is broadcast to Avalanche
7. **Retry Request**: Frontend retries original request with payment proof
8. **Service Proceeds**: Backend verifies payment and processes request
9. **Payment Logged**: Payment is stored in database for analytics

### Spending Controls

Users can set spending limits to prevent accidental overspending:

- **Daily Limits**: Maximum spending per day
- **Monthly Limits**: Maximum spending per month
- **Merchant Whitelist**: Only allow payments to specific merchants
- **Time Restrictions**: Only allow payments during certain hours

Budget tracking shows:
- Current spending vs. limits
- Remaining budget
- Visual progress bars
- Real-time updates

### Payment History & Analytics

All payments are logged with:
- Transaction hash (clickable to Snowtrace)
- Amount and currency
- Endpoint that triggered payment
- Timestamp and status
- Merchant information

Analytics dashboard shows:
- Daily and monthly totals
- Transaction count and averages
- Top merchants
- Complete payment history

### Quick Start with Avalanche Fuji

1. **Set up Thirdweb Facilitator**:
   - Create account at [Thirdweb Dashboard](https://portal.thirdweb.com)
   - Go to Server Wallets → Enable "Show ERC-4337 Smart Account"
   - Switch to Avalanche Fuji Testnet
   - Copy Smart Account address (this is your `THIRDWEB_SERVER_WALLET_ADDRESS`)
   - Fund the Smart Account with testnet AVAX

2. **Configure Environment**:
   ```bash
   X402_ENABLED=true
   THIRDWEB_CLIENT_ID=your_client_id
   THIRDWEB_SECRET_KEY=your_secret_key
   THIRDWEB_SERVER_WALLET_ADDRESS=0x... # ERC-4337 Smart Account
   MERCHANT_WALLET_ADDRESS=0x... # Receives payments
   USDC_ADDRESS_FUJI=0x5425890298aed601595a70AB815c96711a31Bc65
   ```

3. **Access Avalanche Studio**:
   - Navigate to `/avax/studio` in the frontend
   - Connect your wallet (Core, MetaMask, etc.)
   - Select a contract recipe and generate

4. **View Payment History**:
   - Navigate to `/avax/payments` to see:
     - Spending budget and remaining limits
     - Payment history with transaction links
     - Analytics and summaries

### User-Wallet-Based Deployments

All deployments use your connected wallet:
- No server `PRIVATE_KEY` needed for x402 networks
- Users sign transactions directly in their wallets
- Optional gasless deployment via facilitator
- Full control over deployment transactions

### Error Handling

The system provides clear error messages for:
- **402 Payment Required**: User needs to approve payment
- **403 Forbidden**: Spending limit exceeded or payment not allowed
- **502/503/504**: Payment service temporarily unavailable
- **Wallet Issues**: Connection failures, insufficient balance, etc.

Each error includes actionable instructions for resolution.

### Demo Script

See [Avalanche Demo Script](./docs/AVALANCHE_DEMO_SCRIPT.md) for a complete step-by-step demo flow.

For more details, see:
- [x402 Architecture Guide](docs/X402_ARCHITECTURE.md)
- [x402 Integration Guide](docs/X402_AVALANCHE_INTEGRATION.md)

## Documentation

### Getting Started
- **[Getting Started Guide](./GUIDE/GETTING_STARTED.md)** - Complete setup and first contract generation
- **[Developer Guide](./GUIDE/DEVELOPER_GUIDE.md)** - Development environment and workflow
- **[API Documentation](./GUIDE/API.md)** - Complete API reference

### How-To Guides
- **[Deployment Guide](./GUIDE/DEPLOYMENT.md)** - Deploy contracts to blockchain
- **[Docker Quick Start](./README.DOCKER.md)** - Get started with Docker in minutes (Make commands)
- **[Docker Reference Guide](./GUIDE/DOCKER.md)** - Comprehensive Docker documentation (Dockerfile, production, CI/CD)
- **[x402 Integration Guide](./docs/X402_AVALANCHE_INTEGRATION.md)** - x402 payment setup on Avalanche
- **[x402 Architecture](./docs/X402_ARCHITECTURE.md)** - Technical architecture of x402 payments
- **[Hyperion PEF Guide](./docs/HYPERION_PEF_GUIDE.md)** - Parallel batch deployment
- **[MetisVM Optimization](./docs/METISVM_OPTIMIZATION.md)** - MetisVM-specific features
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Technical Documentation
- **[Technology Stack](./docs/TECH_STACK.md)** - Complete list of all technologies, libraries, and SDKs
- **[Architecture Structure](./docs/ARCHITECTURE_STRUCTURE.md)** - Project structure aligned with modern conventions
- **[Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS.md)** - System architecture and patterns
- **[Complete Technical Specification](./docs/complete-tech-spec.md)** - Full technical details
- **[Network Compatibility](./docs/NETWORK_COMPATIBILITY.md)** - Supported networks and features
- **[Testing Setup Guide](./docs/TESTING_SETUP_GUIDE.md)** - Testing configuration and examples

### Engineering Documentation
- **[Engineering Overview](./docs/ENGINEERING_OVERVIEW.md)** - Quick navigation to all engineering docs
- **[Engineering Standards](./docs/ENGINEERING_STANDARDS.md)** - Coding standards, naming conventions, design patterns, testing
- **[Architecture Guide](./docs/ARCHITECTURE_GUIDE.md)** - SOA patterns, event-driven architecture, ERC4337/x402 flows
- **[DevOps & SRE Guide](./docs/DEVOPS_SRE_GUIDE.md)** - CI/CD, monitoring, scaling, incident response
- **[Delivery Process](./docs/DELIVERY_PROCESS.md)** - Sprint structure, user stories, tech debt management

### Frontend & Monitoring
- **[Frontend README](./frontend/README.md)** - Next.js frontend setup and usage
- **Prometheus Metrics** - Access at `http://localhost:9090`

## Architecture

HyperAgent follows a **Service-Oriented Architecture (SOA)** with:

- **Agent-to-Agent (A2A) Protocol**: Decoupled agent communication via event bus
- **Event-Driven Architecture**: Redis Streams for event persistence and real-time updates
- **Service Orchestration**: Sequential and parallel service execution patterns
- **RAG System**: Template retrieval and similarity matching for enhanced generation

### Core Components

```
hyperagent/
├── api/          # FastAPI REST endpoints
├── agents/       # Agent implementations (Generation, Audit, Testing, Deployment)
├── architecture/ # SOA, A2A patterns and orchestration
├── blockchain/   # Alith SDK, EigenDA, Web3 integration
├── core/         # Core services and configuration
├── events/       # Event bus and event types
├── llm/          # LLM providers (Gemini, OpenAI)
├── rag/          # RAG system for template retrieval
├── security/     # Security audit tools (Slither, Mythril, Echidna)
└── cli/          # Command-line interface
```

For detailed architecture information, see [Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS.md).

## Contributing

We welcome contributions! HyperAgent is an open-source project and we appreciate your help.

### How to Contribute

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** following our [Development Workflow](./.cursor/rules/dev-workflow.mdc)
4. **Write tests** for your changes
5. **Commit** your changes (`git commit -m 'feat: Add amazing feature'`)
6. **Push** to your branch (`git push origin feature/amazing-feature`)
7. **Open a Pull Request** using our [PR template](.github/pull_request_template.md)

For detailed contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Branch Protection & Development Standards

HyperAgent follows Microsoft Engineering Fundamentals standards for repository management:

- **Protected Main Branch**: No direct pushes allowed
- **Pull Request Required**: All changes must go through PRs
- **2+ Reviewers Required**: CODEOWNERS file auto-assigns reviewers
- **CI Checks Must Pass**: All tests, linting, and security scans must pass
- **Squash Merge Only**: Maintains clean, linear commit history
- **80%+ Test Coverage**: Enforced in CI pipeline

**Resources:**
- [Branch Protection Setup](./docs/BRANCH_PROTECTION.md) - Complete setup instructions
- [Pull Request Template](.github/pull_request_template.md) - PR checklist and guidelines
- [CODEOWNERS](.github/CODEOWNERS) - Auto-reviewer assignments
- [Contributing Guide](./CONTRIBUTING.md) - Development workflow and standards

### Development Workflow

- Follow the [Standard Development Workflow](./.cursor/rules/dev-workflow.mdc)
- Write tests before implementation (TDD approach)
- Follow code style guidelines (PEP 8, type hints, async/await)
- Update documentation for new features
- Ensure all tests pass before submitting PR

### Code of Conduct

Please note we have a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Testing

```bash
# Run all tests
pytest

# Run unit tests
pytest tests/unit/ -v

# Run integration tests
pytest tests/integration/ -v

# Run with coverage
pytest --cov=hyperagent --cov-report=html

# Run specific test file
pytest tests/integration/test_end_to_end_workflow.py -v
```

See [Testing Setup Guide](./docs/TESTING_SETUP_GUIDE.md) for complete testing documentation.

## Links

- **Website**: [https://hyperionkit.xyz/](https://hyperionkit.xyz/)
- **GitHub Repository**: [https://github.com/JustineDevs/HyperAgent](https://github.com/JustineDevs/HyperAgent)
- **Organization**: [https://github.com/HyperionKit/Hyperkit](https://github.com/HyperionKit/Hyperkit)
- **Linktree**: [https://linktr.ee/Hyperionkit](https://linktr.ee/Hyperionkit)
- **Medium Blog**: [https://medium.com/@hyperionkit](https://medium.com/@hyperionkit)

## License

This project is licensed under the [MIT License](./LICENSE) - see the LICENSE file for details.

Contributions to this project are accepted under the same license.

## Acknowledgments

Special thanks to:

- All [contributors](https://github.com/JustineDevs/HyperAgent/graphs/contributors) who have helped improve this project
- The Hyperion and Mantle communities for network support
- OpenZeppelin for contract standards and best practices
- The open-source community for tools and libraries

---

**Built with ❤️ by the HyperAgent team**