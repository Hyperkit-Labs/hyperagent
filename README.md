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
- 🚀 **On-Chain Deployment** - Deploy contracts to Hyperion and Mantle networks using Alith SDK
- 📚 **RAG-Enhanced Generation** - Retrieve similar contract templates for better code quality
- ⚡ **Parallel Batch Deployment** - Deploy multiple contracts in parallel using Hyperion PEF (10-50x faster)
- 🎯 **MetisVM Optimization** - Generate contracts optimized for MetisVM with floating-point and AI inference support
- 💾 **EigenDA Integration** - Store contract metadata on EigenDA for cost-efficient data availability
- 📊 **Real-Time Progress Tracking** - Monitor workflow progress with live updates
- 🔧 **Constructor Argument Generation** - Automatically extract and generate constructor values from NLP descriptions

## 🚀 Quick Start

### Prerequisites

#### Required Software

1. **Python 3.10 or higher**
   - **Windows**: Download from [python.org/downloads/windows](https://www.python.org/downloads/windows/)
   - **macOS**: Download from [python.org/downloads/mac-osx](https://www.python.org/downloads/mac-osx/) or use Homebrew: `brew install python`
   - **Linux**: Use package manager (e.g., `sudo apt-get install python3` on Ubuntu)
   - Verify installation: `python --version`

2. **PostgreSQL 15+** (or use Supabase cloud)
   - **Windows**: Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   - **macOS**: Download from [postgresql.org/download/macosx](https://www.postgresql.org/download/macosx/) or use Homebrew: `brew install postgresql@15`
   - **Linux**: Use package manager (e.g., `sudo apt-get install postgresql-15` on Ubuntu)
   - **Cloud Alternative**: Use [Supabase](https://supabase.com) (free tier available)

3. **Redis 7+**
   - **Windows**: Download from [github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases) or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`
   - **macOS**: Use Homebrew: `brew install redis`
   - **Linux**: Use package manager (e.g., `sudo apt-get install redis-server` on Ubuntu)
   - **Cloud Alternative**: Use [Redis Cloud](https://redis.com/try-free/) (free tier available)

4. **Git**
   - **Windows**: Download from [git-scm.com/download/win](https://git-scm.com/download/win)
   - **macOS**: Download from [git-scm.com/download/mac](https://git-scm.com/download/mac) or use Homebrew: `brew install git`
   - **Linux**: Use package manager (e.g., `sudo apt-get install git` on Ubuntu)
   - Verify installation: `git --version`

#### Optional but Recommended

| Software | Purpose | Installation |
|----------|---------|--------------|
| **Node.js** | Contract testing (Hardhat/Foundry) | [Download](https://nodejs.org/en/download/) |
| **Docker** | Containerized development | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **GNU Make** | Build automation | [Download](http://gnuwin32.sourceforge.net/packages/make.htm) |
| **VS Code** | Recommended IDE | [Download](https://code.visualstudio.com/download) |

#### Required API Keys

- **Google Gemini API Key** (Required for contract generation)
  - Get from: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **OpenAI API Key** (Optional - fallback LLM provider)
  - Get from: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/JustineDevs/HyperAgent.git
cd HyperAgent
```

#### 2. Create Virtual Environment

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

#### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 4. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env with your API keys and configuration
# Required: GEMINI_API_KEY
# Optional: OPENAI_API_KEY, DATABASE_URL, REDIS_URL
```

#### 5. Initialize Database

```bash
# Run database migrations
alembic upgrade head
```

6. **Start the API server**
   ```bash
   uvicorn hyperagent.api.main:app --reload
   ```

7. **Verify installation**
   ```bash
   # Check system health
   hyperagent system health
   
   # Or via API
   curl http://localhost:8000/api/v1/health/
   ```

For detailed setup instructions, see [Getting Started Guide](./GUIDE/GETTING_STARTED.md).

## Usage

### Basic Workflow

#### Generate and Deploy a Contract

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

#### Interactive Mode

```bash
# Launch interactive CLI
hyperagent workflow create --interactive
```

### Advanced Features

#### MetisVM Optimization

```bash
# Generate contract optimized for MetisVM
hyperagent workflow create \
  --description "Create a financial derivative contract with floating-point pricing" \
  --network hyperion_testnet \
  --optimize-metisvm \
  --enable-fp
```

#### Batch Deployment with PEF

```bash
# Deploy multiple contracts in parallel (10-50x faster)
hyperagent deployment batch \
  --contracts-file examples/batch_deployment_example.json \
  --network hyperion_testnet \
  --use-pef \
  --max-parallel 10
```

#### Export and Share Contracts

```bash
# Export workflow to JSON
hyperagent workflow export --workflow-id <id> -o workflow.json

# Search contract templates
hyperagent template search -q "ERC20"
```

### Python API

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

## 📚 Documentation

### Getting Started
- **[Getting Started Guide](./GUIDE/GETTING_STARTED.md)** - Complete setup and first contract generation
- **[Developer Guide](./GUIDE/DEVELOPER_GUIDE.md)** - Development environment and workflow
- **[API Documentation](./GUIDE/API.md)** - Complete API reference

### How-To Guides
- **[Deployment Guide](./GUIDE/DEPLOYMENT.md)** - Deploy contracts to blockchain
- **[Docker Setup](./GUIDE/DOCKER.md)** - Run HyperAgent with Docker
- **[Hyperion PEF Guide](./docs/HYPERION_PEF_GUIDE.md)** - Parallel batch deployment
- **[MetisVM Optimization](./docs/METISVM_OPTIMIZATION.md)** - MetisVM-specific features
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Technical Documentation
- **[Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS.md)** - System architecture and patterns
- **[Complete Technical Specification](./docs/complete-tech-spec.md)** - Full technical details
- **[Network Compatibility](./docs/NETWORK_COMPATIBILITY.md)** - Supported networks and features
- **[Testing Setup Guide](./docs/TESTING_SETUP_GUIDE.md)** - Testing configuration and examples

## 🏗️ Architecture

HyperAgent follows a **Service-Oriented Architecture (SOA)** with event-driven design principles:

### Architecture Principles

- **Agent-to-Agent (A2A) Protocol** - Decoupled agent communication via event bus
- **Event-Driven Architecture** - Redis Streams for event persistence and real-time updates
- **Service Orchestration** - Sequential and parallel service execution patterns
- **RAG System** - Template retrieval and similarity matching for enhanced generation

### Core Components

```
hyperagent/
├── api/          # FastAPI REST endpoints and WebSocket support
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
7. **Open a Pull Request**

For detailed contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

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

### Test Structure

```
tests/
├── unit/          # Unit tests for individual components
├── integration/   # Integration tests for services
├── performance/   # Performance and SLA tests
└── load/          # Load testing scripts
```

> 📖 **Testing Guide:** See the [Testing](#-testing) section above for testing commands. For comprehensive testing documentation, refer to the [development branch](https://github.com/JustineDevs/HyperAgent/tree/development).

---

## 🤝 Contributing

We welcome contributions from the community! HyperAgent is an open-source project and we appreciate your help.

### How to Contribute

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** following our development workflow (see [CONTRIBUTING.md](./CONTRIBUTING.md))
4. **Write tests** for your changes
5. **Commit** your changes (`git commit -m 'feat: Add amazing feature'`)
6. **Push** to your branch (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Development Guidelines

- Follow the standard development workflow (see [CONTRIBUTING.md](./CONTRIBUTING.md))
- Write tests before implementation (TDD approach)
- Follow code style guidelines (PEP 8, type hints, async/await)
- Update documentation for new features
- Ensure all tests pass before submitting PR

### Code of Conduct

Please note we have a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

> 📖 **Contributing Guide:** See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

---

## 💬 Support

### Getting Help

- 📖 **Documentation** - Check our [documentation](#-documentation) section
- 🐛 **Bug Reports** - Open an issue on [GitHub Issues](https://github.com/JustineDevs/HyperAgent/issues)
- 💡 **Feature Requests** - Submit via [GitHub Issues](https://github.com/JustineDevs/HyperAgent/issues)
- ❓ **Questions** - Check [GitHub Issues](https://github.com/JustineDevs/HyperAgent/issues) or refer to the [development branch](https://github.com/JustineDevs/HyperAgent/tree/development) for troubleshooting guides

### Community

- 🌐 **Website**: [hyperionkit.xyz](https://hyperionkit.xyz/)
- 🔗 **Linktree**: [linktr.ee/Hyperionkit](https://linktr.ee/Hyperionkit)
- 📝 **Blog**: [Medium](https://medium.com/@hyperionkit)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

Contributions to this project are accepted under the same license.

---

## 🔗 Links

### Official Resources

- **Website**: [https://hyperionkit.xyz/](https://hyperionkit.xyz/)
- **GitHub Repository**: [https://github.com/JustineDevs/HyperAgent](https://github.com/JustineDevs/HyperAgent)
- **Organization**: [https://github.com/HyperionKit/Hyperkit](https://github.com/HyperionKit/Hyperkit)
- **Linktree**: [https://linktr.ee/Hyperionkit](https://linktr.ee/Hyperionkit)
- **Medium Blog**: [https://medium.com/@hyperionkit](https://medium.com/@hyperionkit)

---

## 🙏 Acknowledgments

Special thanks to:

- All [contributors](https://github.com/JustineDevs/HyperAgent/graphs/contributors) who have helped improve this project
- The **Hyperion** and **Mantle** communities for network support
- **OpenZeppelin** for contract standards and best practices
- The open-source community for tools and libraries

---

<div align="center">

**Built with ❤️ by the HyperAgent team**
