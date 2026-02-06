# Hyperkit Quick Reference

## 🚀 Quick Start Commands

### CLI Usage (From Project Root)
```bash
# Initialize workspace
npm run hyperagent -- init

# Generate contract
npm run hyperagent -- generate "Create an ERC20 token called MyToken"

# Audit contract
npm run hyperagent -- audit contracts/MyToken.sol

# Deploy contract
npm run hyperagent -- deploy contracts/MyToken.sol --network mantle-testnet

# Get help
npm run hyperagent -- --help
```

### Global CLI (After npm link)
```bash
# Link CLI globally
cd packages/cli && npm run build && npm link

# Use anywhere
hyperagent init
hyperagent generate "Create an NFT collection"
hyperagent audit contracts/NFT.sol
hyperagent deploy contracts/NFT.sol --network avalanche-fuji
```

## 🏗️ Development Commands

### Build Everything
```bash
# CLI
npm run hyperagent:build

# Frontend
cd frontend && npm run build
```

### Run Services
```bash
# Python Backend (port 8000)
cd hyperagent && uvicorn hyperagent.api.main:app --reload

# Frontend (port 3000)
cd frontend && npm run dev

# x402 Verifier (port 3002)
cd services/x402-verifier && npm run dev
```

## 🧪 Testing & Validation

### Sanity Checks
```bash
# Windows
powershell -ExecutionPolicy Bypass -File scripts/sanity-check.ps1

# macOS/Linux
bash scripts/sanity-check.sh
```

### API Health Checks
```bash
# Python Backend
curl http://localhost:8000/api/v1/health/basic

# Test networks endpoint
curl "http://localhost:8000/api/v1/networks?search=mantle"
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# LLM APIs
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Blockchain
PRIVATE_KEY=your_private_key
THIRDWEB_CLIENT_ID=your_client_id

# Database
DATABASE_URL=postgresql://hyperagent_user:secure_password@localhost:5432/hyperagent_db

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## 📁 Project Structure
```
hyperkit_agent/
├── packages/
│   ├── cli/              # Hyperkit CLI
│   └── env/              # Environment utilities
├── hyperagent/           # Python backend (FastAPI)
├── frontend/             # Next.js frontend
├── services/
│   ├── x402-verifier/    # Payment verification
│   └── mantle-bridge/    # Mantle bridge service
└── scripts/              # Utility scripts
```

## 🌐 Supported Networks

| Network | Chain ID | Explorer |
|---------|----------|----------|
| Mantle Testnet | 5003 | https://explorer.testnet.mantle.xyz |
| Mantle Mainnet | 5000 | https://explorer.mantle.xyz |
| Avalanche Fuji | 43113 | https://testnet.snowtrace.io |
| Avalanche Mainnet | 43114 | https://snowtrace.io |

## 🔗 Important URLs

- **Frontend:** http://localhost:3000
- **Python API:** http://localhost:8000
- **x402 Verifier:** http://localhost:3002
- **Health Check:** http://localhost:8000/api/v1/health/basic

## 📚 Documentation

- [CLI Usage Guide](./CLI_USAGE.md)
- [Architecture Overview](./docs/ARCHITECTURE_SIMPLIFIED.md)
- [User Guides](./GUIDE/)
- [Contributing Guide](./CONTRIBUTING.md)

## 🐛 Troubleshooting

### CLI not found
```bash
# Rebuild CLI
npm run hyperagent:build

# Or use npm link
cd packages/cli && npm link
```

### API not responding
```bash
# Check if running
curl http://localhost:8000/api/v1/health/basic

# Restart API
cd hyperagent && uvicorn hyperagent.api.main:app --reload
```

### Build errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run hyperagent:build
```

### Database connection errors
```bash
# Start PostgreSQL
docker compose up postgres -d

# Run migrations
alembic upgrade head
```

## 🎯 Common Workflows

### Generate and Deploy Contract
```bash
# 1. Generate
npm run hyperagent -- generate "Create a staking contract"

# 2. Audit
npm run hyperagent -- audit contracts/StakingContract.sol

# 3. Deploy
npm run hyperagent -- deploy contracts/StakingContract.sol --network mantle-testnet
```

### Development Workflow
```bash
# 1. Start Python Backend
cd hyperagent && uvicorn hyperagent.api.main:app --reload

# 2. Start Frontend (new terminal)
cd frontend && npm run dev

# 3. Test CLI (new terminal)
npm run hyperagent -- generate "Create a token"
```

### Docker Workflow
```bash
# Start all services
docker compose up -d

# Check logs
docker compose logs -f hyperagent

# Stop all services
docker compose down
```

## 💡 Tips

- Use `npm link` for global CLI access during development
- Check `.env.example` for all available configuration options
- Run sanity checks before committing changes
- Use Docker for quick local development setup
- Frontend connects to Python backend on port 8000

---

For detailed architecture, see [docs/ARCHITECTURE_SIMPLIFIED.md](./docs/ARCHITECTURE_SIMPLIFIED.md)
