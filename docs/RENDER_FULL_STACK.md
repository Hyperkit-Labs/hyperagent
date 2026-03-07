# Render Full Stack Deployment

Blueprint deploys the entire backend to Render. Studio (frontend) runs locally or on Vercel.

## Services

| Service | Runtime | Purpose |
|---------|---------|---------|
| hyperagent-api | Python | Orchestrator: workflows, config, networks, BYOK, credits |
| hyperagent-agent-runtime | Node | Spec/design/codegen agents, Tenderly simulate, Pinata IPFS |
| hyperagent-compile | Python | Solidity compilation |
| hyperagent-audit | Python | Slither, Mythril, MythX |
| hyperagent-tools | Python | Foundry/Hardhat tooling |
| hyperagent-roma | Python | ROMA planner |
| hyperagent-vectordb | Python | RAG: Qdrant indexing, spec/template search |
| hyperagent-gateway | Node | API gateway, auth, rate limit |

## Required env vars (set in Render Dashboard)

### hyperagent-api (orchestrator)
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PASSWORD`, `REDIS_URL`
- `AGENT_RUNTIME_URL`, `ROMA_SERVICE_URL`, `SIMULATION_SERVICE_URL`, `STORAGE_SERVICE_URL`
- `COMPILE_SERVICE_URL`, `AUDIT_SERVICE_URL`, `TOOLS_BASE_URL`
- `VECTORDB_URL` – URL of hyperagent-vectordb (e.g. `https://hyperagent-vectordb.onrender.com`)
- `THIRDWEB_*`, `MERCHANT_WALLET_ADDRESS`, `JWT_SECRET_KEY`, `INTERNAL_SERVICE_TOKEN`, etc.

### hyperagent-vectordb
- `QDRANT_URL` – Qdrant instance (e.g. [Qdrant Cloud](https://cloud.qdrant.io) or self-hosted)
- `OPENAI_API_KEY` – For embeddings (text-embedding-3-small)

### hyperagent-agent-runtime
- `TENDERLY_API_KEY`, `TENDERLY_ACCOUNT`, `TENDERLY_PROJECT` (for simulation)
- `PINATA_JWT` (for IPFS artifact storage)

## Service URLs

After deploy, each service gets a URL (e.g. `https://hyperagent-api.onrender.com`). Set cross-service URLs:

- **ORCHESTRATOR_URL** (gateway) → hyperagent-api
- **AGENT_RUNTIME_URL** (orchestrator, roma) → hyperagent-agent-runtime
- **VECTORDB_URL** (orchestrator) → hyperagent-vectordb
- **SIMULATION_SERVICE_URL**, **STORAGE_SERVICE_URL** → hyperagent-agent-runtime (if it hosts both)

## Qdrant setup

Render does not host Qdrant. Options:

1. **Qdrant Cloud** – Create a cluster at [cloud.qdrant.io](https://cloud.qdrant.io), get the URL and API key. Set `QDRANT_URL` on hyperagent-vectordb.
2. **Self-hosted** – Run Qdrant elsewhere and set `QDRANT_URL` to that instance.

Without Qdrant, RAG and Qdrant/VectorDB integration status will show "Not configured" in Settings.
