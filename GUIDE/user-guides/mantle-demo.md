# Mantle Demo Runbook (HyperAgent)

This is a live-demo script for generating, auditing, and deploying a Solidity contract to **Mantle Sepolia (chainId 5003)** using HyperAgent.

## What this demo proves
- Multi-network support (network can be a **named key** like `mantle_testnet` or a **chain id** like `5003` / `eip155:5003`).
- Full pipeline: prompt → contract generation → audit/test → deployment.
- Explorer verification links for the resulting deployment.

## Demo prerequisites (5–10 minutes before)
### 1) Required keys
Set these in repo root `.env`:
- `GEMINI_API_KEY` (or another LLM key)
- `THIRDWEB_CLIENT_ID`

For server-side deployment (TS API deploy runner):
- `DEPLOYER_PRIVATE_KEY` (or `PRIVATE_KEY`) — must have Mantle Sepolia test ETH

Optional (only needed if you want to demo paid x402 flows):
- `MERCHANT_WALLET_ADDRESS`

### 2) Recommended x402 settings for a Mantle-only demo
If you want **no payment prompts** during the Mantle demo:
- `X402_ENABLED=true` is OK, but ensure Mantle is not included in `X402_ENABLED_NETWORKS`.
- Suggested: `X402_ENABLED_NETWORKS=avalanche_fuji,avalanche_mainnet`

### 3) Network / RPC
You can use either:
- `MANTLE_TESTNET_RPC=https://rpc.sepolia.mantle.xyz` (or any working Mantle Sepolia RPC)

or rely on Thirdweb RPC fallback:
- `THIRDWEB_CLIENT_ID` set
- network specified by chain id `5003` / `eip155:5003`

## Services to run
For the cleanest demo, run these components:
- Python backend (FastAPI) — handles all API endpoints, workflow orchestration, and WebSocket
- x402 verifier service (TypeScript) — only needed if x402 is enabled
- Frontend (Next.js) — connects to Python backend

You can run with Docker Compose (recommended) OR locally.

## Option A — Docker Compose (recommended)
### 1) Start infra + Python backend + x402 verifier
If your Docker supports the newer CLI, either command works:
```bash
docker compose up -d postgres redis hyperagent x402-verifier
```

### 2) Start the frontend
In a separate terminal:
```bash
cd frontend
npm install  # First time only
npm run dev
```

### 3) Confirm health
- Python backend docs: `http://localhost:8000/docs`
- Python backend health: `http://localhost:8000/api/v1/health`
- Frontend: `http://localhost:3000`

## Option B — Local (no Docker)
### 1) Start database and Redis
```bash
docker compose up -d postgres redis
```

### 2) Python backend
PowerShell:
```bash
cd hyperagent
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn hyperagent.api.main:app --reload --port 8000
```

### 3) x402 verifier (only if x402 enabled)
```bash
cd services/x402-verifier
npm install
npm run dev
```

### 4) Frontend
```bash
cd frontend
npm install
npm run dev
```

## Live demo script (recommended flow)
### Part 1 — Show networks are dynamic (1 minute)
Open in browser:
- `http://localhost:8000/api/v1/networks?search=mantle`
- `http://localhost:8000/api/v1/networks?search=5003`

Point out:
- Search by name returns curated networks
- Search by chain id returns a dynamic entry

### Part 2 — Generate + audit + deploy in the UI (5–8 minutes)
1. Go to: `http://localhost:3000/workflows/create`
2. Connect wallet (any EVM wallet; no need to switch chain for Mantle demo).
3. Select network:
   - Preferred: `mantle_testnet`
   - Alternate: `5003`
4. Prompt suggestion (simple + fast):
   - "Create a minimal storage contract with an owner and a set/get value function. Initialize value to 1. Only owner can set."
5. Submit.
6. Wait for workflow creation and audit/test completion.
7. When deploy UI appears, click **Deploy Contract**.
8. Copy:
   - transaction hash
   - contract address
9. Open explorer links from the UI.

### Part 3 — Sanity check (1–2 minutes)
From the explorer, verify:
- Tx is mined on Mantle Sepolia
- Contract address exists

Optional: if the UI shows an ABI interaction panel, call the read function (e.g. `value()` should be `1`).

## API-only demo (backup plan)
If the UI has issues, use direct API calls.

### 1) Confirm network features
PowerShell (avoid the `curl` alias by using `curl.exe`):
```bash
curl.exe http://localhost:8000/api/v1/networks/mantle_testnet/features
```

### 2) Deploy via Python API directly
PowerShell one-liner:
```bash
curl.exe -X POST http://localhost:8000/api/v1/workflows/generate -H "Content-Type: application/json" -d "{\"prompt\":\"Create a minimal storage contract with an owner and a set/get value function\",\"selected_tasks\":[\"generation\",\"compilation\",\"deployment\"],\"target_chain\":\"mantle_testnet\",\"wallet_address\":\"<YOUR_WALLET_ADDRESS>\"}"
```
Notes:
- Replace `<YOUR_WALLET_ADDRESS>` with a real address (`0x` + 40 hex chars).
- This creates a full workflow: generation → compilation → deployment.
- Server-side deployment uses `PRIVATE_KEY` from environment.

## Troubleshooting (demo day)
### “RPC URL not configured for network”
Fix: set either `MANTLE_TESTNET_RPC` (or `RPC_URL_MANTLE_TESTNET`) OR set `THIRDWEB_CLIENT_ID` and pass chain id `5003`.

### “Deployment is not configured (PRIVATE_KEY not set)”
Fix: set `PRIVATE_KEY` in root `.env`. Must be 0x + 64 hex chars. Wallet must have testnet MNT tokens.

### Tx sent but no contract address
- Wait ~30–90 seconds (testnets can lag)
- Use the tx hash in explorer

### x402 verifier errors during a Mantle demo
If you do NOT intend to demo payments:
- Ensure Mantle is not in `X402_ENABLED_NETWORKS`, or temporarily set `X402_ENABLED=false`.

## Post-demo cleanup
```bash
docker-compose down
```

Or stop local processes (Ctrl+C).
