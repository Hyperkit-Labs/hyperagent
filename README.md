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
  <p><strong>AI-powered smart contract development platform</strong></p>
  <p>From natural language to production-ready, audited contracts in minutes</p>
  
  <!-- Link Buttons -->
   <p>
    <a href="https://x.com/HyperionKit">
      <img src="https://img.shields.io/twitter/follow/HyperionKit.svg?style=social" alt="Follow @HyperionKit" />
    </a>
    <a href="https://discord.gg/invite/hyperionkit">
        <img src="https://img.shields.io/badge/Chat%20on-Discord-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Chat on Discord" />
    </a>
    <a href="https://hyperionkit.xyz">
        <img src="https://img.shields.io/badge/Hyperkit%20Website-FF6B6B?style=flat-square&logo=discourse&logoColor=white" alt="Website" />
    </a>
    <a href="https://github.com/HyperionKit/Hyperkit/stargazers">
      <img src="https://img.shields.io/github/stars/HyperionKit/Hyperkit" alt="stars" />
    </a>
    <a href="https://github.com/HyperionKit/Hyperkit/network/members">
      <img src="https://img.shields.io/github/forks/HyperionKit/Hyperkit" alt="forks" />
      <a href="https://github.com/HyperionKit/Hyperkit/blob/master/LICENSE.md" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/npm/l/hyperionkit?style=flat-square&color=0052FF" alt="MIT License" />
    </a>
    </a>
  </p>
</div>

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

- **Test AVAX** - For Avalanche Fuji testnet ([Faucet](https://core.app/tools/testnet-faucet/))
- **Test USDC** - For x402 payments on testnets
- **Wallet** - MetaMask, Core, or any Web3 wallet

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

### Quick Install

```bash
# Clone repository
git clone https://github.com/JustineDevs/HyperAgent.git
cd Hyperkit_agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Initialize database
alembic upgrade head

# Run development server
uvicorn hyperagent.api.main:app --reload
```

### Docker

```bash
# Start all services (frontend, backend, DB, Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Frontend (Optional)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Documentation

- **[📖 Full Documentation](https://hyperionkit.xyz/docs)** - Complete guides and API reference
- **[🚀 Getting Started Guide](./GUIDE/GETTING_STARTED.md)** - Detailed setup and first contract
- **[🏗️ Architecture Guide](./docs/ARCHITECTURE_GUIDE.md)** - System design and patterns
- **[💳 x402 Payment Guide](./docs/X402_AVALANCHE_INTEGRATION.md)** - Pay-per-use setup
- **[⚡ Hyperion PEF Guide](./docs/HYPERION_PEF_GUIDE.md)** - Parallel batch deployment
- **[🔧 API Reference](./GUIDE/API.md)** - Complete API documentation

---

## Features

- 🤖 **AI-Powered Generation** - Natural language → Solidity contracts
- 🛡️ **Automated Auditing** - Security analysis with Slither, Mythril, Echidna
- 🚀 **Multi-Chain Deployment** - Hyperion, Mantle, Avalanche
- 💳 **x402 Payments** - Pay-per-use on Avalanche networks
- ⚡ **Parallel Deployment** - 10-50x faster with Hyperion PEF
- 🎯 **MetisVM Optimized** - Floating-point and AI inference support

**[View all features →](https://hyperionkit.xyz/features)**

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

<a href="https://github.com/HyperionKit/HyperAgent/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=HyperionKit/HyperAgent" />
</a>

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Links

- **Website**: [hyperionkit.xyz](https://hyperionkit.xyz/)
- **GitHub**: [github.com/Hyperionkit/HyperAgent](https://github.com/Hyperionkit/HyperAgent)
- **Organization**: [github.com/HyperionKit/Hyperkit](https://github.com/HyperionKit/Hyperkit)
- **Linktree**: [linktr.ee/Hyperionkit](https://linktr.ee/Hyperionkit)

---

<div align="center">
  <p>Built with ❤️ by the HyperAgent team</p>
</div>