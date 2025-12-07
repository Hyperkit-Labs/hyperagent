<div align="center">
  <img src="/public/ascii-art-doh-HyperAgent.png" alt="HyperAgent ASCII Art" width="800">
</div>

<div align="center">
  
<!-- Badges: start -->
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Status](https://img.shields.io/badge/status-production%20ready-success)
<!-- Badges: end -->

</div>

<div align="center">
  <h1>HyperAgent</h1>
  <p><strong>AI-powered smart contract development platform</strong></p>
  <p>From natural language to production-ready, audited contracts in minutes</p>
  
  <!-- Link Buttons -->
  <p>
     <a href="https://github.com/HyperionKit/Hyperkit">
      <img src="https://img.shields.io/github/last-commit/HyperionKit/Hyperkit?color=0052FF&style=flat-square" alt="last update" />
    </a>
     <a href="https://github.com/HyperionKit/Hyperkit/blob/master/LICENSE.md" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/npm/l/hyperionkit?style=flat-square&color=0052FF" alt="MIT License" />
    </a>
    <a href="https://x.com/HyperionKit">
      <img src="https://img.shields.io/twitter/follow/HyperionKit.svg?style=social" alt="Follow @HyperionKit" />
    </a>
    <a href="https://discord.gg/invite/hyperionkit">
        <img src="https://img.shields.io/badge/Chat%20on-Discord-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Chat on Discord" />
    </a>
    <a href="https://hyperionkit.xyz">
        <img src="https://img.shields.io/badge/Hyperkit%20App-FF6B6B?style=flat-square&logo=discourse&logoColor=white" alt="Website" />
    </a>
    <a href="https://github.com/HyperionKit/Hyperkit/stargazers">
      <img src="https://img.shields.io/github/stars/HyperionKit/Hyperkit" alt="stars" />
    </a>
    <a href="https://github.com/HyperionKit/Hyperkit/network/members">
      <img src="https://img.shields.io/github/forks/HyperionKit/Hyperkit" alt="forks" />
    </a>
  </p>
</div>

---

<div align="center">
  <p><b>HyperAgent Dashboard - Generate, audit, and deploy smart contracts</b></p>
  <img src="/public/screenshot-dashboard.png" alt="HyperAgent Dashboard" width="800">
</div>

---

## Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL 15+ (or [Supabase](https://supabase.com) - recommended)
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

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

**Option 1: Full Docker Setup (All Services)**
```bash
# Start all services (frontend, backend, DB, Redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Option 2: Hybrid Setup (Recommended for Windows/WSL2)**
```bash
# Start only backend services in Docker (3-5x faster frontend development)
# Unix/Linux/Mac:
./scripts/start-backend.sh

# Windows:
scripts\start-backend.bat

# Then run frontend locally (see below)
```

> **Performance**: Hybrid setup provides **3-5x faster** builds and **10x faster** hot reload on Windows/WSL2. See [Docker Guide](./GUIDE/DOCKER.md#hybrid-development-setup) for details.

### Frontend (Optional)

**If using Hybrid Setup:**
```bash
# Backend services should already be running
cd frontend
npm install  # First time only
npm run dev
# Open http://localhost:3000
```

**If using Full Docker Setup:**
```bash
# Frontend is included in docker-compose, no separate setup needed
# Access at http://localhost:3000
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
  
  [JustineDevs](https://github.com/JustineDevs)
  
</div>