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

# TS API
cd ts/api && npm run build

# Orchestrator
cd ts/orchestrator && npm run build

# Frontend
cd frontend && npm run build
```

### Run Services
```bash
# TS API (port 4000)
cd ts/api && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev

# Python Backend (port 8000) - optional
cd hyperagent && python -m uvicorn main:app --reload
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
# TS API
curl http://localhost:4000/healthz
curl http://localhost:4000/api/v1/health/detailed

# Test networks endpoint
curl "http://localhost:4000/api/v1/networks?search=mantle"
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# LLM APIs
GEMINI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Blockchain
PRIVATE_KEY=your_private_key
THIRDWEB_CLIENT_ID=your_client_id

# API Configuration
TS_API_PORT=4000
PYTHON_BACKEND_URL=http://localhost:8000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_ENABLED=false  # Enable when Python backend is running
```

## 📁 Project Structure
```
hyperkit_agent/
├── packages/
│   ├── cli/              # Hyperkit CLI
│   ├── env/              # Environment utilities
│   └── ...
├── ts/
│   ├── api/              # TS API (Fastify)
│   └── orchestrator/     # LangGraph orchestrator
├── frontend/             # Next.js frontend
├── hyperagent/           # Python backend (optional)
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
- **TS API:** http://localhost:4000
- **Python API:** http://localhost:8000 (optional)
- **Health Check:** http://localhost:4000/healthz

## 📚 Documentation

- [CLI Usage Guide](./CLI_USAGE.md)
- [Global Install Guide](./packages/cli/GLOBAL_INSTALL.md)
- [Alignment Summary](./ALIGNMENT_SUMMARY.md)
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
curl http://localhost:4000/healthz

# Restart API
cd ts/api && npm run dev
```

### Build errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run hyperagent:build
```

### WebSocket not working
```bash
# WebSocket is disabled by default
# Enable in .env:
NEXT_PUBLIC_WS_ENABLED=true

# Requires Python backend running
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
# 1. Start TS API
cd ts/api && npm run dev

# 2. Start Frontend (new terminal)
cd frontend && npm run dev

# 3. Test CLI (new terminal)
npm run hyperagent -- generate "Create a token"
```

### Production Build
```bash
# Build all components
npm run hyperagent:build
cd ts/api && npm run build
cd frontend && npm run build

# Run sanity checks
powershell -ExecutionPolicy Bypass -File scripts/sanity-check.ps1
```

## 💡 Tips

- Use `npm link` for global CLI access during development
- Set `NEXT_PUBLIC_WS_ENABLED=false` to disable WebSocket (default)
- Use `PYTHON_BACKEND_URL` to proxy network searches to Python
- Check `.env.example` for all available configuration options
- Run sanity checks before committing changes

---

For detailed information, see [ALIGNMENT_SUMMARY.md](./ALIGNMENT_SUMMARY.md)
