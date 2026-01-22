# HyperAgent TypeScript Workspace

This directory contains the TypeScript implementation of the HyperAgent orchestrator, following the DNA blueprint specification.

## Structure

```
ts/
├── orchestrator/    # Core spec-locked orchestrator engine
└── api/            # HTTP API exposing orchestrator
```

## Quick Start

### Prerequisites

- Node.js 20.x LTS
- npm 9.x or pnpm 8.x

### Development

```bash
# Install dependencies
cd ts/orchestrator
npm install
cd ../api
npm install

# Build orchestrator
cd ../orchestrator
npm run build

# Run API in dev mode
cd ../api
npm run dev
```

### Using Docker

```bash
# Build and start TS orchestrator service
docker-compose up ts-orchestrator

# API will be available at http://localhost:4000
```

## Architecture

### Orchestrator (`ts/orchestrator`)

Implements the DNA blueprint specification:

- **Core Spec**: NodeType, VALID_TRANSITIONS, HyperAgentState (7 fields)
- **Graph Engine**: Simple state machine enforcing blueprint transitions
- **Nodes**: 7 nodes (policy, generate, audit, validate, deploy, eigenda, monitor)
- **Validation**: State shape validation, transition validation, memory operation validation

### API (`ts/api`)

HTTP API exposing the orchestrator:

- **Routes**: `/api/v2/workflows` (POST, GET)
- **Health**: `/healthz`, `/readyz`
- **Clients**: Python backend adapter, x402 verifier client

## API Endpoints

### POST /api/v2/workflows

Create a new workflow from user intent.

**Request:**
```json
{
  "intent": "Create an ERC20 token with minting and burning"
}
```

**Response:**
```json
{
  "intent": "Create an ERC20 token with minting and burning",
  "status": "success",
  "contract": "pragma solidity ^0.8.0; ...",
  "deploymentAddress": "0x...",
  "txHash": "0x...",
  "auditResults": {
    "passed": true,
    "findings": []
  },
  "logs": ["[POLICY] ✓ Intent valid...", "..."]
}
```

### GET /healthz

Liveness probe.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /readyz

Readiness probe (checks dependencies).

**Response:**
```json
{
  "status": "ready"
}
```

## Integration with Python Backend

During migration, the TS orchestrator can call the existing Python FastAPI backend for features not yet ported:

- Legacy workflow inspection
- Existing x402 analytics
- Database-heavy queries
- MLflow data

Set `PYTHON_BACKEND_URL` environment variable to point to your Python backend.

## Next Steps

1. **Implement LLM calls** in `generateNode` and `auditNode` using APPROVED_MODELS
2. **Add memory integration** (Chroma, Pinata) in generate, eigenda, monitor nodes
3. **Implement deployment** using thirdweb SDK in `deployNode`
4. **Add persistence layer** for workflow state
5. **Port remaining features** from Python backend

## Blueprint Compliance

This implementation strictly follows the DNA blueprint:

- ✅ 7-field HyperAgentState (no extra fields)
- ✅ VALID_TRANSITIONS enforced at runtime
- ✅ Node implementations match blueprint specs
- ✅ Memory operations only where allowed
- ✅ Error codes and retry policy from blueprint

See `Hyperagent Refactor/BLUEPRINT_PLAYBOOK_COMBINED.md` for full specification.

