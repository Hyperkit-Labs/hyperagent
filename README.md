<div align="center">
  <img src="/public/ascii-art-doh-HyperAgent.png" alt="HyperAgent ASCII Art" width="800">
  
<!-- Badges: start -->
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Node.js](https://img.shields.io/badge/node.js-18.18%2B-green)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![Status](https://img.shields.io/badge/status-active-success)
<!-- Badges: end -->
  
</div>


<div align="center">
  <p><strong>Production-Ready AI Smart Contract Development Platform</strong></p>
  <p>Transform natural language into deployed, audited smart contracts in under 2 minutes</p>
  
  <p>
    <a href="https://github.com/JustineDevs/HyperAgent">
      <img src="https://img.shields.io/github/stars/JustineDevs/HyperAgent" alt="stars" />
    </a>
  </p>
  
  <p>
    <strong>x402 Native | Mantle SDK | Thirdweb Wallets | EigenDA | IPFS | Multi-LLM</strong>
  </p>
</div>

---

## Production Integrations

HyperAgent is production-ready with native support for:

| Technology | Purpose | Status |
|-----------|---------|--------|
| **Mantle SDK** | L1-L2 bridging, cross-chain messaging | ✅ Native |
| **Thirdweb x402** | USDC-based micro-payments | ✅ Native |
| **Thirdweb Wallets** | EIP-7702 + ERC-4337 account abstraction | ✅ Native |
| **Supabase** | Production PostgreSQL with pgbouncer | ✅ Native |
| **IPFS/Pinata** | Decentralized metadata storage | ✅ Native |
| **EigenDA** | Data availability for Mantle mainnet | ✅ Native |
| **Multi-LLM Router** | Claude 4.5, GPT-4, Gemini, Llama 3.1 | ✅ Native |
| **100+ Networks** | Mantle, Avalanche, Base, Arbitrum, BNB, SKALE, Filecoin | ✅ Ready |

---

## Screenshot

<div align="center">
  <img src="/public/screenshot-dashboard.png" alt="HyperAgent Dashboard" width="800">
  <p><em>HyperAgent Dashboard - Generate, audit, and deploy smart contracts</em></p>
</div>

---

## Getting Started

### Prerequisites

#### Required Software

| Software | Version | Notes |
|----------|---------|-------|
| **Python** | 3.10+ | Required for backend |
| **Node.js** | 18.18+ | Required for frontend (Next.js 16) |
| **npm** | 9.0+ | Comes with Node.js |
| **Git** | 2.30+ | Version control |
| **PostgreSQL** | 15+ | Database (or use [Supabase](https://supabase.com)) |
| **Redis** | 7.0+ | Caching (optional, can use Redis Cloud) |
| **Docker** | 24.0+ | Optional, for containerized deployment |
| **Docker Compose** | 2.20+ | Optional, comes with Docker Desktop |

#### Required API Keys

| Service | Purpose | Get Key |
|---------|---------|---------|
| **Google Gemini** | AI contract generation | [Get API Key](https://aistudio.google.com/app/apikey) |
| **Thirdweb** | x402 payments & wallet | [Get Client ID](https://thirdweb.com/dashboard) |
| **OpenAI** (optional) | Alternative AI provider | [Get API Key](https://platform.openai.com/api-keys) |

#### Blockchain Requirements (for deployment)

- **Test AVAX** - For Avalanche Fuji testnet ([Faucet](https://build.avax.network/console/primary-network/faucet))
- **Test USDC** - For x402 payments on testnets ([Facuet](https://faucet.circle.com/))
- **Wallet** - MetaMask, Core(Recommended), or any Web3 wallet

#### Verify Installation

```bash
# Check versions
python --version    # Should be 3.10+
node --version      # Should be 18.18+
npm --version       # Should be 9.0+
git --version       # Should be 2.30+
docker --version    # Should be 24.0+ (optional)
```

### Hardware Requirements

#### Development Machine

| Resource | Minimum | Recommended | Optimal |
|----------|---------|-------------|---------|
| **RAM** | 8 GB | 16 GB | 32 GB |
| **CPU** | 2 cores | 4 cores | 6+ cores |
| **Storage** | 30 GB free | 50 GB free | 100 GB free (SSD) |

> 💡 **Tip**: Use cloud services (Supabase, Redis Cloud) to reduce local requirements.
> See [GUIDE/SIMPLIFIED_SETUP.md](./GUIDE/SIMPLIFIED_SETUP.md) for cloud-based setup.

#### Storage Breakdown

| Component | Size | Notes |
|-----------|------|-------|
| Docker Images | ~5-8 GB | Can be cleaned periodically |
| Docker Volumes | ~5-15 GB | Grows with usage |
| Python venv | ~1 GB | One-time setup |
| Frontend node_modules | ~500 MB | One-time setup |

#### Storage Over Time

- **Fresh Install**: ~10-12 GB
- **After 1 Month**: ~15-18 GB
- **After 3 Months**: ~22-28 GB

<details>
<summary>💾 Storage Optimization Tips</summary>

- Use **Supabase** instead of local PostgreSQL (saves ~5-15 GB)
- Clean Docker regularly: `docker system prune` (saves ~2-5 GB)
- Limit Prometheus retention (saves ~1-2 GB)
- Rotate logs (saves ~500 MB - 1 GB)
- **Total potential savings**: ~8-23 GB

</details>

### Build Performance

| Build Type | Time | Notes |
|------------|------|-------|
| **First build** | ~25-45 min | Full setup |
| **Rebuild (cached)** | ~5-15 min | Layer caching enabled |
| **Frontend only** | ~3-5 min | `npm run build` |
| **Backend only** | ~20-35 min | Python deps + Solidity |

> Multi-stage builds and layer caching optimize rebuild times. Most time is spent installing Python dependencies and Solidity compilers.

### Quick Production Setup

#### Step 1: Clone and Configure

```bash
# Clone repository
git clone https://github.com/<username>/HyperAgent.git
cd Hyperkit_agent

# Copy environment template
cp ENV_CONFIGURATION_GUIDE.md .env.template
# Configure .env with your credentials (see guide below)
```

#### Step 2: Environment Configuration

Create `.env` with required variables (see `ENV_CONFIGURATION_GUIDE.md`):

```bash
# REQUIRED - Supabase Database
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_PASSWORD=your_password
SUPABASE_ANON_KEY=your_anon_key

# REQUIRED - Thirdweb x402 & Wallets
THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key
THIRDWEB_SERVER_WALLET_ADDRESS=0x...
MERCHANT_WALLET_ADDRESS=0x...

# REQUIRED - IPFS/Pinata
PINATA_JWT=your_jwt
PINATA_API_KEY=your_api_key
PINATA_API_SECRET=your_api_secret

# REQUIRED - LLM (at least one)
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key

# REQUIRED - x402 Native
X402_ENABLED=true
X402_ENABLED_NETWORKS=mantle_testnet,mantle_mainnet
```

Full guide: `ENV_CONFIGURATION_GUIDE.md`

#### Step 3: Start Services (Docker - Recommended)

```bash
# Start all services (backend, frontend, database, Redis, x402, Mantle bridge)
docker compose up -d --build

# Verify services are healthy
docker compose ps

# View logs
docker compose logs -f hyperagent
```

#### Step 4: Initialize Database

```bash
# Run migrations
docker compose exec hyperagent alembic upgrade head

# Verify connection
docker compose exec hyperagent python -c "from hyperagent.db.session import engine; print('Connected')"
```

#### Step 5: Start Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

#### Step 6: Verify Setup

```bash
# Check API health
curl http://localhost:8000/api/v1/health

# Check x402 verifier
curl http://localhost:3002/health

# Check Mantle bridge
curl http://localhost:3003/health

# Check networks
curl http://localhost:8000/api/v1/networks
```

### Alternative: Local Development (No Docker)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
alembic upgrade head

# Run development server
uvicorn hyperagent.api.main:app --reload
```

### Using Make (Optional)

```bash
# Start all services
make up

# View logs
make logs

# Run migrations
make migrate

# Run tests
make test

# Stop services
make down
```

---

## Quick Start: Deploy Your First Contract

### Using the Frontend (Recommended)

1. **Navigate to Dashboard**
   ```
   http://localhost:3000
   ```

2. **Create Workflow**
   - Click "Create Workflow"
   - Enter NLP prompt:
     ```
     Create an ERC20 token called "HyperToken" with symbol "HYPER" 
     and total supply of 1 million tokens
     ```
   - Select network: **Mantle Sepolia** (testnet)
   - Choose workflow steps:
     - ✅ Generation
     - ✅ Compilation
     - ✅ Audit
     - ✅ Testing
     - ✅ Deployment
   - Enter your wallet address
   - Click "Start Workflow"

3. **Watch Real-Time Progress**
   - Generation: 15-30 seconds
   - Compilation: 10-20 seconds
   - Audit: 15-25 seconds
   - Testing: 10-15 seconds
   - Deployment: 15-30 seconds
   - **Total: ~60-120 seconds**

4. **View Results**
   - Contract address on Mantle explorer
   - Source code and ABI
   - Security audit report
   - Test coverage results
   - IPFS metadata link
   - EigenDA commitment (if mainnet)

### Using the API

```bash
# Create workflow
curl -X POST http://localhost:8000/api/v1/workflows/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nlp_input": "Create ERC20 token with name HyperToken",
    "network": "mantle_testnet",
    "wallet_address": "0x...",
    "selected_tasks": ["generation", "compilation", "audit", "testing", "deployment"]
  }'

# Response
{
  "workflow_id": "wf_abc123",
  "status": "processing",
  "estimated_time": 90
}

# Check status
curl http://localhost:8000/api/v1/workflows/wf_abc123/status

# WebSocket for real-time updates
ws://localhost:8000/ws/workflow/wf_abc123
```

### Using the CLI

```bash
# Create workflow
hyperagent workflow create \
  --prompt "Create ERC20 token with name HyperToken" \
  --network mantle_testnet \
  --wallet 0x...

# Check status
hyperagent workflow status wf_abc123

# List workflows
hyperagent workflow list

# Deploy existing contract
hyperagent deploy \
  --contract-path ./contracts/Token.sol \
  --network mantle_testnet \
  --wallet 0x...
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[🎬 Demo Day Guide](./DEMO_DAY_GUIDE.md)** | Complete production demo script |
| **[⚙️ Environment Configuration](./ENV_CONFIGURATION_GUIDE.md)** | All environment variables explained |
| **[📖 Documentation](./docs)** | Architecture and API notes |
| **[🚀 Getting Started Guide](./GUIDE/GETTING_STARTED.md)** | Detailed setup and first contract |
| **[🏗️ Architecture Guide](./docs/ARCHITECTURE_SIMPLIFIED.md)** | System design and patterns |
| **[💳 x402 Payment Guide](./docs/billing/x402_integration.md)** | Native x402 payment protocol |
| **[🔧 API Reference](./GUIDE/API.md)** | Complete API documentation |
| **[🧪 Mantle Demo Script](./GUIDE/user-guides/mantle-demo.md)** | Mantle testnet deployment guide |
| **[🛠️ LLM Stack](./llm.txt)** | Full technology stack overview |

---

## Core Features

### AI-Powered Contract Generation
- Multi-LLM routing with Claude 4.5 Opus, GPT-4 Turbo, Gemini 1.5 Pro, Llama 3.1 405B
- Automatic fallback and load balancing across models
- OpenZeppelin library integration for security best practices
- Template-based generation with customization
- Natural language to Solidity in 15-30 seconds

### Security & Auditing
- Static analysis with Slither (300+ vulnerability patterns)
- Dynamic testing with Foundry and Hardhat
- Automated test generation with 80%+ coverage
- Security scoring and risk assessment
- TEE attestation integration (roadmap)

### Multi-Chain Deployment
- Native support for 100+ EVM networks
- Mantle SDK integration for L1-L2 bridging
- Single workflow deploys to multiple chains
- Network-specific gas optimization
- Custom RPC endpoint support

### x402 Payment Protocol (Native)
- USDC-based micro-payments
- ERC-20 permit signature flow
- Pay-per-use: $0.01 generation, $0.02 workflow, $0.10 deployment
- Automatic settlement with Thirdweb facilitator
- Payment history and analytics dashboard

### Account Abstraction
- EIP-7702 smart accounts with session keys
- ERC-4337 UserOperation support
- Gasless deployments via Thirdweb Gas Sponsorship
- Batch transactions and multi-call
- Social recovery and spending limits

### Data Availability & Storage
- EigenDA integration for Mantle mainnet (KZG commitments)
- IPFS/Pinata for contract metadata
- Decentralized proof storage with content addressing
- Automatic blob padding and encoding (BN254)
- Immutable deployment records

### Developer Experience
- WebSocket real-time progress updates
- REST API + TypeScript API (dual-version)
- CLI for batch operations and automation
- Next.js dashboard with modern UI/UX
- Comprehensive documentation and guides


---

## Supported Networks

### Mantle Network
| Network | Chain ID | RPC | Explorer | EigenDA | Mantle SDK |
|---------|----------|-----|----------|---------|------------|
| **Mantle Testnet** | 5003 | https://rpc.sepolia.mantle.xyz | https://sepolia.mantlescan.xyz | ❌ | ✅ |
| **Mantle Mainnet** | 5000 | https://rpc.mantle.xyz | https://mantlescan.xyz | ✅ | ✅ |

### Avalanche Network
| Network | Chain ID | RPC | Explorer | x402 | Batch Deploy |
|---------|----------|-----|----------|------|--------------|
| **Avalanche Fuji** | 43113 | https://api.avax-test.network/ext/bc/C/rpc | https://testnet.snowscan.xyz | ✅ | ✅ |
| **Avalanche C-Chain** | 43114 | https://api.avax.network/ext/bc/C/rpc | https://snowscan.xyz | ✅ | ✅ |

### Other Supported Networks
- **Base Sepolia** (Chain ID: 84532) - Testnet with native USDC
- **Base Mainnet** (Chain ID: 8453) - Production ready
- **Arbitrum Sepolia** (Chain ID: 421614) - L2 testnet
- **Arbitrum One** (Chain ID: 42161) - Production L2
- **BNB Testnet** (Chain ID: 97) - BSC testnet
- **BNB Mainnet** (Chain ID: 56) - BSC production
- **SKALE Chaos Testnet** (Chain ID: 1351057110) - Zero gas fees
- **Filecoin Calibration** (Chain ID: 314159) - FVM testnet
- **Filecoin Mainnet** (Chain ID: 314) - FVM production

See `config/networks.yaml` for complete network configurations and features.

---

## Contributing

We welcome contributions from the community. Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details on:

- Development workflow and setup
- Code style and standards
- Testing requirements
- Pull request process
- Code of conduct

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Ensure all tests pass (`npm test` and `pytest`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for complete guidelines.


---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

Contributions to this project are accepted under the same license.

---

## Support

- **Documentation**: [docs/](./docs/) - Complete architecture and API documentation
- **Issues**: [GitHub Issues](https://github.com/JustineDevs/HyperAgent/issues) - Report bugs or request features
- **Discussions**: [GitHub Discussions](https://github.com/JustineDevs/HyperAgent/discussions) - Ask questions and share ideas

## Acknowledgments

### Core Technologies
- **[FastAPI](https://fastapi.tiangolo.com/)** - Python backend framework
- **[Next.js](https://nextjs.org/)** - React frontend framework
- **[Supabase](https://supabase.com/)** - PostgreSQL database and auth

### Web3 Infrastructure
- **[Thirdweb](https://thirdweb.com/)** - x402 payments, wallet SDK, gas sponsorship
- **[Mantle Network](https://www.mantle.xyz/)** - L2 scaling, Mantle SDK, cross-chain messaging
- **[EigenDA](https://www.eigenlayer.xyz/)** - Data availability layer
- **[Pinata](https://www.pinata.cloud/)** - IPFS gateway and API

### AI & LLM Providers
- **[Anthropic Claude](https://www.anthropic.com/)** - Primary AI generation (Claude 4.5 Opus)
- **[OpenAI](https://openai.com/)** - GPT-4 Turbo fallback
- **[Google Gemini](https://deepmind.google/technologies/gemini/)** - Gemini 1.5 Pro integration
- **[Meta Llama](https://ai.meta.com/llama/)** - Llama 3.1 405B open-source option

### Development Tools
- **[Foundry](https://getfoundry.sh/)** - Solidity compilation and testing
- **[Slither](https://github.com/crytic/slither)** - Static security analysis
- **[OpenZeppelin](https://www.openzeppelin.com/)** - Secure contract libraries
- **[Web3.py](https://web3py.readthedocs.io/)** - Python Ethereum library

### Infrastructure & DevOps
- **[Docker](https://www.docker.com/)** - Containerization
- **[Redis](https://redis.io/)** - Caching and event streaming
- **[MLflow](https://mlflow.org/)** - ML experiment tracking
- **[Prometheus](https://prometheus.io/)** - Metrics and monitoring

---

<div align="center">
  <p>Built with ❤️ by the HyperAgent team</p>
</div>