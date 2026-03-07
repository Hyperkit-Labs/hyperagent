# Integrations Configuration

Settings > Integrations shows connection status for Tenderly, Pinata, and Qdrant. Configure these via environment variables on the services that use them.

## Tenderly (Simulation and monitoring)

- **Env vars** (agent-runtime): `TENDERLY_API_KEY`, `TENDERLY_ACCOUNT`, `TENDERLY_PROJECT`, `TENDERLY_API_URL`
- **Where**: `hyperagent-agent-runtime` (Render) or `agent-runtime` (Docker)
- **Docs**: [Tenderly](https://docs.tenderly.co/)

## Pinata / IPFS (Artifact storage and pinning)

- **Env vars** (agent-runtime): `PINATA_JWT` (required), `PINATA_API_URL`, `PINATA_GATEWAY_BASE`
- **Where**: `hyperagent-agent-runtime` (Render) or `agent-runtime` (Docker)
- **Docs**: [Pinata](https://docs.pinata.cloud/)

## Qdrant / VectorDB (RAG embeddings and search)

- **Env vars** (vectordb service): `QDRANT_URL` (default `http://localhost:6333`), `OPENAI_API_KEY` (for embeddings)
- **Where**: `hyperagent-vectordb` (if deployed) or local vectordb service
- **Orchestrator**: Set `VECTORDB_URL` so the config API can report Qdrant status
- **Docs**: [Qdrant](https://qdrant.tech/documentation/)

## How status is determined

The orchestrator fetches `/health` from `AGENT_RUNTIME_URL` and `VECTORDB_URL`. The agent-runtime health endpoint returns `tenderly_configured` and `pinata_configured` based on env vars. The vectordb health endpoint returns `qdrant_configured`.
