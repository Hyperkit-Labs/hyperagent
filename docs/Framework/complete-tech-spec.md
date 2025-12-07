# HyperAgent - Complete Technical Architecture & Implementation Guide
## AI Agent Platform for On-Chain Smart Contract Generation via NLP

Generated: 2025-11-13 | Target Networks: Hyperion, Mantle | Tech Stack: Python-First

---

## TABLE OF CONTENTS

1. [System Architecture Overview](#system-architecture-overview)
2. [Complete Tech Stack Breakdown](#complete-tech-stack-breakdown)
3. [Supabase PostgreSQL Schema](#supabase-postgresql-schema)
4. [Logic System & Pipeline](#logic-system--pipeline)
5. [Event Types & Flow](#event-types--flow)
6. [Agent Roles & Responsibilities](#agent-roles--responsibilities)
7. [A2A/SOA/SOP Implementation](#a2asopsop-implementation)
8. [CI/CD GitHub Workflow](#cicd-github-workflow)
9. [Docker Containerization](#docker-containerization)
10. [CLI Design & Commands](#cli-design--commands)
11. [Environment Configuration](#environment-configuration)
12. [Deployment Instructions](#deployment-instructions)

---

## SYSTEM ARCHITECTURE OVERVIEW

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         HyperAgent Platform                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │  CLI Layer   │      │  API Layer   │      │   Web UI     │  │
│  │  (ASCII UI)  │      │  (FastAPI)   │      │  (React TS)  │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                      │           │
│         └─────────────────────┼──────────────────────┘           │
│                               │                                  │
│                    ┌──────────▼──────────┐                       │
│                    │  Event Bus (Redis)  │                       │
│                    │  - Message Queue    │                       │
│                    │  - Cache Layer      │                       │
│                    └──────────┬──────────┘                       │
│                               │                                  │
│         ┌─────────────────────┼─────────────────────┐            │
│         │                     │                     │            │
│    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐       │
│    │ Agent 1 │          │ Agent 2 │          │ Agent 3 │       │
│    │Generate │          │ Audit   │          │ Deploy  │       │
│    └────┬────┘          └────┬────┘          └────┬────┘       │
│         │                    │                    │             │
│    ┌────▼──────────────────────────────────────────▼───┐        │
│    │      Blockchain Interaction Layer (Alith SDK)    │        │
│    │  - Hyperion Testnet & Mainnet (Chain ID: 133717)│        │
│    │  - Mantle Testnet (5003) & Mainnet (5000)       │        │
│    │  - EigenDA Integration (Data Availability)       │        │
│    └────┬──────────────────────────────────────────────┘        │
│         │                                                        │
│    ┌────▼──────────────────────────────────────────────┐        │
│    │     Data Persistence Layer (Supabase)            │        │
│    │  - PostgreSQL (Primary Store)                    │        │
│    │  - Redis (Cache & State)                         │        │
│    │  - IPFS/Pinata (Templates & RAG)                 │        │
│    └─────────────────────────────────────────────────┘        │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │Security Layer  │  │Monitoring      │  │Audit Log       │   │
│  │- Mythril       │  │- Prometheus    │  │- All Actions   │   │
│  │- Slither       │  │- Grafana       │  │- Immutable     │   │
│  │- Echidna       │  │- ELK Stack     │  │- Timestamped   │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Input (NLP)
  │
  ├─→ [*] CLI Parser (ASCII Interface)
  │
  ├─→ [*] Redis Event Bus (Message Queue)
  │
  ├─→ [*] Generation Agent (Gemini/GPT)
  │    ├─ LLM Call → Contract Code
  │    ├─ RAG from Pinata → Templates
  │    ├─ Store in Supabase
  │
  ├─→ [*] Audit Agent (Security Analysis)
  │    ├─ Mythril (Static Analysis)
  │    ├─ Slither (Vulnerability Scan)
  │    ├─ Echidna (Fuzz Testing)
  │    ├─ Store Results
  │
  ├─→ [*] Test Agent (Hardhat/Foundry)
  │    ├─ Compile Contract
  │    ├─ Unit Tests
  │    ├─ Store ABI & Metadata
  │
  ├─→ [*] Deploy Agent (On-Chain)
  │    ├─ Alith SDK Integration
  │    ├─ Hyperion/Mantle RPC
  │    ├─ EigenDA Commitment
  │    ├─ Store Tx Hash & Address
  │
  └─→ [+] Workflow Complete (State in Redis + Postgres)
```

---

## COMPLETE TECH STACK BREAKDOWN

### 1. CORE LANGUAGE & RUNTIME

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Primary Language** | Python | 3.10+ | Agent logic, orchestration |
| **Async Runtime** | asyncio | Built-in | Non-blocking operations |
| **Package Manager** | pip / poetry | Latest | Dependency management |
| **Virtual Environment** | venv | Built-in | Isolated Python environment |

**Setup Commands:**
```bash
# Create virtual environment
python3.10 -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install core dependencies
pip install --upgrade pip setuptools wheel
pip install poetry
poetry install
```

---

### 2. WEB & API FRAMEWORK

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Web Framework** | FastAPI | 0.104+ | Async REST API |
| **ASGI Server** | Uvicorn | 0.24+ | Production server |
| **Validation** | Pydantic | v2 | Data validation |
| **WebSocket** | websockets | 12+ | Real-time updates |

**Installation:**
```bash
pip install fastapi uvicorn pydantic websockets python-multipart
```

**Sample Endpoints:**
```python
# hyperagent/api/main.py
from fastapi import FastAPI, WebSocket
from fastapi.responses import JSONResponse

app = FastAPI(title="HyperAgent", version="1.0.0")

@app.post("/api/v1/workflows/generate")
async def generate_contract(request: ContractGenerationRequest):
    """Generate smart contract from NLP description"""
    return {"workflow_id": "...", "status": "processing"}

@app.websocket("/ws/workflow/{workflow_id}")
async def websocket_workflow(websocket: WebSocket, workflow_id: str):
    """Real-time workflow status updates"""
    await websocket.accept()
    # Stream updates
```

---

### 3. LLM INTEGRATION

| Component | Technology | Purpose | Fallback |
|-----------|-----------|---------|----------|
| **Primary LLM** | Google Gemini | Contract generation | OpenAI GPT-4 |
| **Embedding Model** | Gemini Embeddings | Semantic search | OpenAI Embeddings |
| **Context Window** | 32K tokens | Contract context | Sliding window |

**Installation:**
```bash
pip install google-generativeai openai langchain langchain-community
```

**Configuration:**
```python
# hyperagent/llm/provider.py
import os
from google.generativeai import GenerativeModel

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

async def call_llm(prompt: str, fallback: bool = False):
    try:
        model = GenerativeModel("gemini-2.5-flash")
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        if fallback and OPENAI_API_KEY:
            # Fallback to OpenAI
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            response = await client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        raise
```

---

### 4. RAG & VECTOR STORAGE

| Component | Technology | Purpose | Configuration |
|-----------|-----------|---------|----------------|
| **Storage** | IPFS/Pinata | Decentralized storage | JWT Auth |
| **Vector DB** | Supabase pgvector | Semantic search | PostgreSQL Extension |
| **Embeddings** | Gemini/OpenAI | Vector generation | 1536 dimensions |

**Installation:**
```bash
pip install pypdf langchain-text-splitters psycopg2-binary pgvector
```

**Implementation:**
```python
# hyperagent/rag/pinata_manager.py
import requests

class PinataManager:
    def __init__(self, pinata_jwt: str):
        self.jwt = pinata_jwt
        self.headers = {"Authorization": f"Bearer {pinata_jwt}"}
    
    async def upload_template(self, name: str, content: str):
        """Upload contract template to Pinata"""
        files = {"file": (name, content.encode())}
        response = requests.post(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            files=files,
            headers=self.headers
        )
        return response.json()["IpfsHash"]
    
    async def retrieve_template(self, ipfs_hash: str):
        """Retrieve template from IPFS"""
        response = requests.get(f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}")
        return response.text
```

---

### 5. BLOCKCHAIN INTEGRATION (ALITH SDK)

| Component | Technology | Version | Networks |
|-----------|-----------|---------|----------|
| **Agent Framework** | Alith SDK | Latest | Web3 optimized |
| **Language Support** | Python SDK | Latest | Cross-platform |
| **Gas Estimation** | Alith Tools | Included | Network-aware |
| **Tx Signing** | Eth-keys | Latest | Private key mgmt |

**Installation:**
```bash
pip install alith web3 eth-keys eth-account eth-typing
```

**Network Configuration:**
```python
# hyperagent/blockchain/networks.py
from web3 import Web3

NETWORKS = {
    "hyperion_testnet": {
        "chain_id": 133717,
        "rpc_url": "https://hyperion-testnet.metisdevops.link",
        "explorer": "https://hyperion-testnet-explorer.metisdevops.link",
        "currency": "tMETIS"
    },
    "hyperion_mainnet": {
        "chain_id": 133718,  # Hypothetical
        "rpc_url": "https://hyperion.metisdevops.link",
        "explorer": "https://hyperion-explorer.metisdevops.link",
        "currency": "METIS"
    },
    "mantle_testnet": {
        "chain_id": 5003,
        "rpc_url": "https://rpc.sepolia.mantle.xyz",
        "explorer": "https://sepolia.mantlescan.xyz",
        "currency": "MNT"
    },
    "mantle_mainnet": {
        "chain_id": 5000,
        "rpc_url": "https://rpc.mantle.xyz",
        "explorer": "https://mantlescan.xyz",
        "currency": "MNT"
    }
}

async def get_web3_instance(network: str):
    if network not in NETWORKS:
        raise ValueError(f"Unknown network: {network}")
    
    config = NETWORKS[network]
    w3 = Web3(Web3.HTTPProvider(config["rpc_url"]))
    return w3
```

---

### 6. SECURITY & AUDITING TOOLS

| Tool | Purpose | Integration | Output |
|------|---------|-----------|--------|
| **Mythril** | Static analysis | Docker container | JSON report |
| **Slither** | Vulnerability scan | Direct Python | Detailed findings |
| **Echidna** | Fuzz testing | Docker container | Property failures |

**Installation:**
```bash
pip install slither-analyzer mythril echidna

# Or use Docker
docker pull mythril/myth:latest
docker pull trail-of-bits/echidna:latest
```

**Audit Pipeline:**
```python
# hyperagent/security/audit.py
import subprocess
import json

class SecurityAuditor:
    async def run_slither(self, contract_path: str):
        """Run Slither vulnerability scan"""
        result = subprocess.run(
            ["slither", contract_path, "--json"],
            capture_output=True,
            text=True
        )
        return json.loads(result.stdout)
    
    async def run_mythril(self, contract_bytecode: str):
        """Run Mythril static analysis"""
        process = await asyncio.create_subprocess_exec(
            "myth", "analyze",
            "--bytecode", contract_bytecode,
            "--outform", "json",
            stdout=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        return json.loads(stdout)
    
    async def run_echidna(self, contract_path: str, config_path: str):
        """Run Echidna fuzzing tests"""
        result = subprocess.run(
            ["echidna-test", contract_path, "--config", config_path],
            capture_output=True,
            text=True
        )
        return result.stdout
```

---

### 7. SMART CONTRACT TOOLS

| Component | Technology | Purpose | Configuration |
|-----------|-----------|---------|----------------|
| **Build Tool** | Hardhat | Compilation & testing | TypeScript config |
| **Alternative** | Foundry | Forge for advanced | Rust-based |
| **Compiler** | solc | Solidity compilation | Version 0.8.x |
| **Testing** | Hardhat + Waffle | Unit tests | Mocha/Chai |

**Installation:**
```bash
# Hardhat setup
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Foundry setup (alternative)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

**Hardhat Configuration:**
```javascript
// hyperagent/contracts/hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hyperion_testnet: {
      url: "https://hyperion-testnet.metisdevops.link",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mantle_testnet: {
      url: "https://rpc.sepolia.mantle.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mantle_mainnet: {
      url: "https://rpc.mantle.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      hyperion_testnet: "verify",
      mantle_testnet: process.env.MANTLESCAN_API_KEY,
      mantle_mainnet: process.env.MANTLESCAN_API_KEY
    }
  }
};
```

---

### 8. DATA PERSISTENCE LAYER

#### PostgreSQL (Primary)

| Component | Technology | Purpose | Configuration |
|-----------|-----------|---------|----------------|
| **Database** | PostgreSQL 15+ | Primary data store | Supabase hosted |
| **ORM** | SQLAlchemy | Object mapping | Async support |
| **Migrations** | Alembic | Schema versioning | Auto-tracked |
| **Vector Search** | pgvector | Semantic search | 1536 dims |

**Installation:**
```bash
pip install sqlalchemy alembic asyncpg psycopg2-binary pgvector
```

#### Redis (Cache & State)

| Component | Technology | Purpose | Configuration |
|-----------|-----------|---------|----------------|
| **Cache Store** | Redis 7+ | Session cache | In-memory |
| **Message Queue** | Redis Streams | Event bus | Async queue |
| **Client** | redis-py / aioredis | Python binding | Async support |

**Installation:**
```bash
pip install redis aioredis
```

**Redis Configuration:**
```python
# hyperagent/cache/redis_manager.py
import redis.asyncio as redis

class RedisManager:
    def __init__(self, url: str = "redis://localhost:6379"):
        self.url = url
        self.client = None
    
    async def connect(self):
        self.client = await redis.from_url(self.url, decode_responses=True)
    
    async def set_workflow_state(self, workflow_id: str, state: dict):
        """Cache workflow state"""
        await self.client.set(
            f"workflow:{workflow_id}",
            json.dumps(state),
            ex=86400  # 24h expiry
        )
    
    async def stream_event(self, event_type: str, data: dict):
        """Push event to stream"""
        await self.client.xadd(
            f"events:{event_type}",
            {"data": json.dumps(data)}
        )
```

---

### 9. MESSAGE QUEUE & EVENT BUS

| Component | Technology | Purpose | Pattern |
|-----------|-----------|---------|---------|
| **Queue** | Redis Streams | Event bus | Pub/Sub + Streams |
| **Worker** | Python asyncio | Task processing | Async tasks |
| **Scheduler** | APScheduler | Cron jobs | Periodic tasks |

**Installation:**
```bash
pip install apscheduler
```

---

### 10. CONTAINERIZATION

| Component | Technology | Purpose | Build |
|-----------|-----------|---------|-------|
| **Container Runtime** | Docker | Isolation | Docker Engine |
| **Orchestration** | Docker Compose | Local development | docker-compose.yml |
| **Images** | Multi-stage | Optimization | ~300MB final |

**Dockerfile:**
```dockerfile
# Dockerfile - Multi-stage build
FROM python:3.10-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.10-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application
COPY . .

ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000 6379 5432

CMD ["uvicorn", "hyperagent.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 11. CI/CD & DEVOPS

| Component | Technology | Purpose | Config File |
|-----------|-----------|---------|-------------|
| **VCS** | GitHub | Version control | .git |
| **CI/CD** | GitHub Actions | Automation | .github/workflows/ |
| **Container Registry** | GitHub Container Registry | Image storage | ghcr.io |
| **Artifact Store** | GitHub Artifacts | Build outputs | .github/artifacts |

---

### 12. MONITORING & LOGGING

| Component | Technology | Purpose | Configuration |
|-----------|-----------|---------|----------------|
| **Logging** | Python logging | Structured logs | JSON format |
| **Tracing** | OpenTelemetry | Distributed tracing | Jaeger exporter |
| **Metrics** | Prometheus | Performance metrics | Scrape interval |

**Installation:**
```bash
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-jaeger
```

---

## SUPABASE POSTGRESQL SCHEMA

### Complete Database Schema

```sql
-- ============================================================================
-- HyperAgent Database Schema
-- Database: hyperagent_prod
-- Version: 1.0.0
-- Created: 2025-11-13
-- ============================================================================

-- [*] Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "http";

-- [*] Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS hyperagent;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================================================
-- 1. USER & AUTHENTICATION TABLES
-- ============================================================================

CREATE TABLE hyperagent.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    wallet_address VARCHAR(42) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_wallet CHECK (wallet_address IS NULL OR wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_users_email ON hyperagent.users(email);
CREATE INDEX idx_users_wallet ON hyperagent.users(wallet_address);

-- ============================================================================
-- 2. WORKFLOW MANAGEMENT
-- ============================================================================

CREATE TYPE hyperagent.workflow_status AS ENUM (
    'created',           -- Initial state
    'nlp_parsing',       -- Parsing NLP input
    'generating',        -- LLM generation
    'auditing',          -- Security audit
    'testing',           -- Unit testing
    'deploying',         -- On-chain deployment
    'completed',         -- Success
    'failed',            -- Error state
    'cancelled'          -- User cancelled
);

CREATE TYPE hyperagent.network_type AS ENUM (
    'hyperion_testnet',
    'hyperion_mainnet',
    'mantle_testnet',
    'mantle_mainnet'
);

CREATE TABLE hyperagent.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hyperagent.users(id) ON DELETE CASCADE,
    
    -- Workflow identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type VARCHAR(50) DEFAULT 'contract_generation',  -- contract_generation, audit_only, etc.
    
    -- Status tracking
    status hyperagent.workflow_status DEFAULT 'created',
    progress_percentage INT DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- NLP Input
    nlp_input TEXT NOT NULL,
    nlp_tokens INT,  -- Token count for billing
    
    -- Execution details
    network hyperagent.network_type NOT NULL,
    is_testnet BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Error tracking
    error_message TEXT,
    error_stacktrace TEXT,
    retry_count INT DEFAULT 0,
    
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

CREATE INDEX idx_workflows_user_id ON hyperagent.workflows(user_id);
CREATE INDEX idx_workflows_status ON hyperagent.workflows(status);
CREATE INDEX idx_workflows_created_at ON hyperagent.workflows(created_at DESC);
CREATE INDEX idx_workflows_network ON hyperagent.workflows(network);

-- ============================================================================
-- 3. GENERATED CONTRACTS
-- ============================================================================

CREATE TABLE hyperagent.generated_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES hyperagent.workflows(id) ON DELETE CASCADE,
    
    -- Contract details
    contract_name VARCHAR(255) NOT NULL,
    contract_type VARCHAR(50),  -- ERC20, ERC721, CustomDeFi, etc.
    solidity_version VARCHAR(20) DEFAULT '0.8.27',
    
    -- Source code
    source_code TEXT NOT NULL,
    source_code_hash VARCHAR(66),  -- SHA256 hash for integrity
    
    -- Compilation artifacts
    abi JSONB,
    bytecode VARCHAR(100000),
    deployed_bytecode VARCHAR(100000),
    
    -- Metadata
    line_count INT,
    function_count INT,
    security_flags JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_contracts_workflow_id ON hyperagent.generated_contracts(workflow_id);
CREATE INDEX idx_contracts_name ON hyperagent.generated_contracts(contract_name);
CREATE INDEX idx_contracts_type ON hyperagent.generated_contracts(contract_type);

-- ============================================================================
-- 4. SECURITY AUDIT RESULTS
-- ============================================================================

CREATE TYPE hyperagent.vulnerability_severity AS ENUM (
    'critical',
    'high',
    'medium',
    'low',
    'info',
    'optimized'
);

CREATE TABLE hyperagent.security_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES hyperagent.generated_contracts(id) ON DELETE CASCADE,
    
    -- Audit tools
    tool_used VARCHAR(50) NOT NULL,  -- slither, mythril, echidna
    
    -- Findings
    vulnerabilities JSONB NOT NULL DEFAULT '[]',  -- Array of findings
    total_issues INT DEFAULT 0,
    critical_count INT DEFAULT 0,
    high_count INT DEFAULT 0,
    medium_count INT DEFAULT 0,
    low_count INT DEFAULT 0,
    
    -- Risk assessment
    overall_risk_score FLOAT CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    audit_status VARCHAR(50) DEFAULT 'passed',  -- passed, failed, warnings
    
    -- Audit metadata
    audit_duration_ms INT,
    audit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Full report
    full_report JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_audits_contract_id ON hyperagent.security_audits(contract_id);
CREATE INDEX idx_audits_tool_used ON hyperagent.security_audits(tool_used);
CREATE INDEX idx_audits_risk_score ON hyperagent.security_audits(overall_risk_score DESC);

-- ============================================================================
-- 5. SMART CONTRACT DEPLOYMENT
-- ============================================================================

CREATE TABLE hyperagent.deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES hyperagent.generated_contracts(id) ON DELETE CASCADE,
    
    -- Deployment details
    deployment_network hyperagent.network_type NOT NULL,
    is_testnet BOOLEAN NOT NULL,
    
    -- On-chain information
    contract_address VARCHAR(42) UNIQUE NOT NULL,
    deployer_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    
    -- Gas & Cost
    gas_used BIGINT,
    gas_price BIGINT,  -- Wei
    total_cost_wei BIGINT,  -- Total in Wei
    
    -- Deployment status
    deployment_status VARCHAR(50) DEFAULT 'pending',  -- pending, confirmed, failed
    block_number BIGINT,
    confirmation_blocks INT DEFAULT 0,
    
    -- Timestamps
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- EigenDA integration (Mantle only)
    eigenda_commitment VARCHAR(256),  -- KZG commitment hash
    eigenda_batch_header JSONB,
    
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_deployments_contract_id ON hyperagent.deployments(contract_id);
CREATE INDEX idx_deployments_network ON hyperagent.deployments(deployment_network);
CREATE INDEX idx_deployments_address ON hyperagent.deployments(contract_address);
CREATE INDEX idx_deployments_deployed_at ON hyperagent.deployments(deployed_at DESC);

-- ============================================================================
-- 6. TESTING & QA
-- ============================================================================

CREATE TABLE hyperagent.test_suites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES hyperagent.generated_contracts(id) ON DELETE CASCADE,
    
    -- Test framework
    framework VARCHAR(50) NOT NULL,  -- hardhat, foundry, brownie
    
    -- Test file
    test_code TEXT NOT NULL,
    test_file_path VARCHAR(500),
    
    -- Test execution
    total_tests INT DEFAULT 0,
    passed_tests INT DEFAULT 0,
    failed_tests INT DEFAULT 0,
    skipped_tests INT DEFAULT 0,
    
    -- Coverage metrics
    line_coverage FLOAT,  -- 0-100%
    branch_coverage FLOAT,
    function_coverage FLOAT,
    
    -- Results
    test_results JSONB DEFAULT '{}',
    test_report_url VARCHAR(500),
    
    -- Execution info
    execution_duration_ms INT,
    executed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_tests_contract_id ON hyperagent.test_suites(contract_id);
CREATE INDEX idx_tests_executed_at ON hyperagent.test_suites(executed_at DESC);

-- ============================================================================
-- 7. RAG & VECTOR EMBEDDINGS
-- ============================================================================

CREATE TABLE hyperagent.contract_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template metadata
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    contract_type VARCHAR(50),  -- ERC20, ERC721, etc.
    
    -- Template content
    template_code TEXT NOT NULL,
    ipfs_hash VARCHAR(100) UNIQUE,  -- Pinata IPFS hash
    
    -- Vector embeddings for semantic search
    embedding vector(1536),  -- Gemini embedding dimension
    
    -- Version control
    version VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[],
    
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_templates_active ON hyperagent.contract_templates(is_active);
CREATE INDEX idx_templates_type ON hyperagent.contract_templates(contract_type);
CREATE INDEX idx_templates_embedding ON hyperagent.contract_templates USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- 8. AUDIT & COMPLIANCE LOGGING
-- ============================================================================

CREATE TYPE audit.event_type AS ENUM (
    'contract_generated',
    'audit_started',
    'audit_completed',
    'deployment_initiated',
    'deployment_confirmed',
    'error_occurred',
    'workflow_cancelled',
    'user_login',
    'api_call',
    'configuration_changed'
);

CREATE TABLE audit.event_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES hyperagent.users(id) ON DELETE SET NULL,
    
    -- Event details
    event_type audit.event_type NOT NULL,
    resource_type VARCHAR(50),  -- workflow, contract, deployment
    resource_id UUID,
    
    -- Action details
    action_description TEXT,
    action_result VARCHAR(50) DEFAULT 'success',  -- success, failure, warning
    
    -- Request info
    ip_address INET,
    user_agent TEXT,
    api_endpoint VARCHAR(500),
    
    -- Response info
    http_status_code INT,
    response_time_ms INT,
    
    -- Security
    is_sensitive BOOLEAN DEFAULT false,
    encryption_key_id VARCHAR(100),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit.event_log(user_id);
CREATE INDEX idx_audit_event_type ON audit.event_log(event_type);
CREATE INDEX idx_audit_created_at ON audit.event_log(created_at DESC);
CREATE INDEX idx_audit_resource_id ON audit.event_log(resource_id);

-- ============================================================================
-- 9. SYSTEM CONFIGURATION
-- ============================================================================

CREATE TABLE hyperagent.system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Config keys
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    
    -- Version control
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_config_active ON hyperagent.system_config(is_active);

-- ============================================================================
-- 10. API KEYS & AUTHENTICATION
-- ============================================================================

CREATE TABLE hyperagent.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hyperagent.users(id) ON DELETE CASCADE,
    
    -- Key details
    key_hash VARCHAR(256) NOT NULL UNIQUE,  -- SHA256 hash
    key_name VARCHAR(100),
    
    -- Permissions
    scopes TEXT[] DEFAULT ARRAY['read:workflows', 'write:workflows'],
    
    -- Security
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_api_keys_user_id ON hyperagent.api_keys(user_id);
CREATE INDEX idx_api_keys_active ON hyperagent.api_keys(is_active);

-- ============================================================================
-- 11. VIEWS & MATERIALIZED VIEWS
-- ============================================================================

-- Dashboard summary view
CREATE VIEW hyperagent.dashboard_summary AS
SELECT
    u.id as user_id,
    u.email,
    COUNT(DISTINCT w.id) as total_workflows,
    SUM(CASE WHEN w.status = 'completed' THEN 1 ELSE 0 END) as completed_workflows,
    SUM(CASE WHEN w.status = 'failed' THEN 1 ELSE 0 END) as failed_workflows,
    COUNT(DISTINCT d.id) as total_deployments,
    AVG(a.overall_risk_score) as avg_risk_score,
    MAX(w.created_at) as last_workflow_created
FROM hyperagent.users u
LEFT JOIN hyperagent.workflows w ON u.id = w.user_id
LEFT JOIN hyperagent.deployments d ON d.contract_id IN (
    SELECT id FROM hyperagent.generated_contracts WHERE workflow_id = w.id
)
LEFT JOIN hyperagent.security_audits a ON a.contract_id IN (
    SELECT id FROM hyperagent.generated_contracts WHERE workflow_id = w.id
)
GROUP BY u.id, u.email;

-- Active deployments view
CREATE VIEW hyperagent.active_deployments AS
SELECT
    d.id,
    d.contract_address,
    d.deployment_network,
    gc.contract_name,
    d.deployed_at,
    d.block_number,
    d.confirmation_blocks,
    gc.contract_type,
    u.email as deployed_by
FROM hyperagent.deployments d
JOIN hyperagent.generated_contracts gc ON d.contract_id = gc.id
JOIN hyperagent.workflows w ON gc.workflow_id = w.id
JOIN hyperagent.users u ON w.user_id = u.id
WHERE d.deployment_status = 'confirmed'
ORDER BY d.deployed_at DESC;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE hyperagent.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyperagent.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyperagent.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.event_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY user_isolation_policy ON hyperagent.workflows
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_api_keys_policy ON hyperagent.api_keys
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 13. PERFORMANCE OPTIMIZATION - INDEXES
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_workflows_user_status_created ON hyperagent.workflows(user_id, status, created_at DESC);
CREATE INDEX idx_contracts_workflow_type_created ON hyperagent.generated_contracts(workflow_id, contract_type, created_at DESC);
CREATE INDEX idx_deployments_network_status ON hyperagent.deployments(deployment_network, deployment_status);

-- Partial indexes for common filters
CREATE INDEX idx_workflows_active ON hyperagent.workflows(id) WHERE status NOT IN ('completed', 'failed', 'cancelled');
CREATE INDEX idx_deployments_pending ON hyperagent.deployments(id) WHERE deployment_status = 'pending';

-- ============================================================================
-- 14. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION hyperagent.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON hyperagent.users
FOR EACH ROW EXECUTE FUNCTION hyperagent.update_updated_at();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON hyperagent.workflows
FOR EACH ROW EXECUTE FUNCTION hyperagent.update_updated_at();

-- Workflow status update trigger
CREATE OR REPLACE FUNCTION hyperagent.on_workflow_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        INSERT INTO audit.event_log (user_id, event_type, resource_type, resource_id, action_description)
        VALUES (NEW.user_id, 'workflow_status_changed'::audit.event_type, 'workflow', NEW.id, 
                'Workflow status changed from ' || OLD.status || ' to ' || NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_status_change_trigger AFTER UPDATE ON hyperagent.workflows
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION hyperagent.on_workflow_status_change();

-- ============================================================================
-- 15. GRANTS & PERMISSIONS
-- ============================================================================

-- Create application role
CREATE ROLE hyperagent_app LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
GRANT USAGE ON SCHEMA hyperagent, audit TO hyperagent_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hyperagent TO hyperagent_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO hyperagent_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hyperagent, audit TO hyperagent_app;

-- Create read-only role
CREATE ROLE hyperagent_readonly LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
GRANT USAGE ON SCHEMA hyperagent, audit TO hyperagent_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA hyperagent, audit TO hyperagent_readonly;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
```

### Supabase-Specific Setup

```sql
-- Supabase Auth Integration (PostgreSQL)
-- Run this in Supabase SQL Editor

-- Link users table to Supabase auth
ALTER TABLE hyperagent.users
ADD COLUMN auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create trigger to sync Supabase auth with users table
CREATE OR REPLACE FUNCTION hyperagent.on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO hyperagent.users (auth_id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (auth_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION hyperagent.on_auth_user_created();

-- Enable Realtime on tables for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE hyperagent.workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE hyperagent.deployments;
ALTER PUBLICATION supabase_realtime ADD TABLE audit.event_log;
```

---

## LOGIC SYSTEM & PIPELINE

### Agent Logic Foundation (SOA Pattern)

```python
# hyperagent/core/agent_system.py
from typing import Dict, Any, List
from enum import Enum
import asyncio
import json
from datetime import datetime

class AgentRole(Enum):
    """Agent role definitions"""
    GENERATOR = "generator"      # Contract generation from NLP
    AUDITOR = "auditor"          # Security analysis
    TESTER = "tester"            # Unit testing & coverage
    DEPLOYER = "deployer"        # On-chain deployment
    COORDINATOR = "coordinator"  # Orchestration & state management

class WorkflowStage(Enum):
    """Pipeline stages"""
    PARSING = "nlp_parsing"
    GENERATION = "generating"
    AUDITING = "auditing"
    TESTING = "testing"
    DEPLOYMENT = "deploying"
    COMPLETION = "completed"

class ServiceInterface:
    """Base interface for all agent services (SOA principle)"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input and return output"""
        raise NotImplementedError
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input data"""
        raise NotImplementedError
    
    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        raise NotImplementedError

class GenerationService(ServiceInterface):
    """LLM-based contract generation service"""
    
    def __init__(self, llm_provider):
        self.llm_provider = llm_provider
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate smart contract from NLP description
        
        Input:
            - nlp_description: str
            - contract_type: str (e.g., 'ERC20', 'ERC721')
            - network: str
        
        Output:
            - contract_code: str
            - abi: dict
            - metadata: dict
        """
        nlp_desc = input_data.get("nlp_description")
        contract_type = input_data.get("contract_type", "Custom")
        
        # Construct prompt
        prompt = self._build_generation_prompt(nlp_desc, contract_type)
        
        # Call LLM
        response = await self.llm_provider.call_llm(prompt)
        
        # Parse response
        contract_code = self._extract_solidity_code(response)
        
        return {
            "status": "success",
            "contract_code": contract_code,
            "contract_type": contract_type,
            "generated_at": datetime.now().isoformat()
        }
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate NLP input"""
        if not data.get("nlp_description"):
            return False
        return len(data["nlp_description"]) > 10
    
    def _build_generation_prompt(self, description: str, contract_type: str) -> str:
        """Build optimized prompt for LLM"""
        return f"""Generate a production-ready Solidity smart contract based on this description:

Description: {description}
Contract Type: {contract_type}
Solidity Version: 0.8.27
Network: EVM-compatible

Requirements:
1. Follow OpenZeppelin standards
2. Include security best practices
3. Add comprehensive NatSpec comments
4. Implement ReentrancyGuard if needed
5. Return ONLY the Solidity code without explanations

Contract:"""
    
    def _extract_solidity_code(self, response: str) -> str:
        """Extract Solidity code from LLM response"""
        # Implementation to extract code blocks
        lines = response.split("\n")
        code_lines = []
        in_code_block = False
        
        for line in lines:
            if "```solidity" in line or "```sol" in line:
                in_code_block = True
                continue
            if "```" in line and in_code_block:
                break
            if in_code_block:
                code_lines.append(line)
        
        return "\n".join(code_lines).strip()

class AuditService(ServiceInterface):
    """Security auditing service"""
    
    def __init__(self, security_tools):
        self.security_tools = security_tools
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run security audits on contract
        
        Input:
            - contract_code: str
            - contract_address: str (optional, for deployed)
        
        Output:
            - vulnerabilities: List[dict]
            - overall_risk_score: float
            - audit_status: str
        """
        contract_code = input_data.get("contract_code")
        
        # Run tools in parallel
        tasks = [
            self.security_tools.run_slither(contract_code),
            self.security_tools.run_mythril(contract_code),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Aggregate findings
        all_vulnerabilities = []
        critical_count = 0
        high_count = 0
        
        for result in results:
            if isinstance(result, Exception):
                continue
            all_vulnerabilities.extend(result.get("vulnerabilities", []))
            critical_count += result.get("critical", 0)
            high_count += result.get("high", 0)
        
        # Calculate risk score
        risk_score = min(100, (critical_count * 25 + high_count * 10))
        
        return {
            "status": "success",
            "vulnerabilities": all_vulnerabilities,
            "critical_count": critical_count,
            "high_count": high_count,
            "overall_risk_score": risk_score,
            "audit_status": "passed" if risk_score < 30 else "warning" if risk_score < 70 else "failed",
            "audited_at": datetime.now().isoformat()
        }
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        return bool(data.get("contract_code"))

class DeploymentService(ServiceInterface):
    """On-chain smart contract deployment service"""
    
    def __init__(self, blockchain_client):
        self.blockchain_client = blockchain_client
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deploy contract to blockchain
        
        Input:
            - compiled_contract: dict (abi, bytecode)
            - network: str
            - deployer_key: str
            - constructor_args: list
        
        Output:
            - contract_address: str
            - tx_hash: str
            - block_number: int
        """
        compiled = input_data.get("compiled_contract")
        network = input_data.get("network")
        constructor_args = input_data.get("constructor_args", [])
        
        # Get web3 instance
        w3 = await self.blockchain_client.get_instance(network)
        
        # Prepare contract
        Contract = w3.eth.contract(abi=compiled["abi"], bytecode=compiled["bytecode"])
        
        # Build transaction
        tx = Contract.constructor(*constructor_args).build_transaction({
            "from": input_data.get("deployer_address"),
            "nonce": w3.eth.get_transaction_count(input_data.get("deployer_address")),
            "gasPrice": w3.eth.gas_price
        })
        
        # Sign and send
        tx_hash = await self.blockchain_client.send_transaction(tx, input_data.get("deployer_key"))
        
        # Wait for confirmation
        receipt = await self.blockchain_client.wait_for_receipt(tx_hash, timeout=300)
        
        return {
            "status": "success",
            "contract_address": receipt["contractAddress"],
            "tx_hash": tx_hash.hex(),
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"],
            "deployed_at": datetime.now().isoformat()
        }
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        return bool(data.get("compiled_contract") and data.get("network"))

class WorkflowCoordinator:
    """Orchestrates the complete workflow (SOA Coordinator pattern)"""
    
    def __init__(self, services: Dict[AgentRole, ServiceInterface], event_bus):
        self.services = services
        self.event_bus = event_bus
        self.workflow_id = None
        self.state = {}
    
    async def execute_workflow(self, workflow_id: str, nlp_input: str, network: str) -> Dict[str, Any]:
        """
        Execute complete workflow pipeline
        
        Pipeline Flow:
        1. Parse NLP input
        2. Generate contract (GenerationService)
        3. Audit contract (AuditService)
        4. Test contract (TestingService)
        5. Deploy contract (DeploymentService)
        """
        self.workflow_id = workflow_id
        self.state = {
            "workflow_id": workflow_id,
            "nlp_input": nlp_input,
            "network": network,
            "stages_completed": []
        }
        
        try:
            # Stage 1: Generation
            [+] [WAIT] Generating contract from NLP...
            generation_result = await self.services[AgentRole.GENERATOR].process({
                "nlp_description": nlp_input,
                "network": network
            })
            await self._publish_event("contract_generated", generation_result)
            self.state["contract_code"] = generation_result["contract_code"]
            self.state["stages_completed"].append(WorkflowStage.GENERATION)
            
            # Stage 2: Auditing
            [+] [WAIT] Running security audits...
            audit_result = await self.services[AgentRole.AUDITOR].process({
                "contract_code": self.state["contract_code"]
            })
            await self._publish_event("audit_completed", audit_result)
            self.state["audit_results"] = audit_result
            self.state["stages_completed"].append(WorkflowStage.AUDITING)
            
            # Stage 3: Testing
            [+] [WAIT] Compiling and testing...
            test_result = await self.services[AgentRole.TESTER].process({
                "contract_code": self.state["contract_code"]
            })
            self.state["test_results"] = test_result
            self.state["stages_completed"].append(WorkflowStage.TESTING)
            
            # Stage 4: Deployment
            [+] [WAIT] Deploying to {network}...
            deploy_result = await self.services[AgentRole.DEPLOYER].process({
                "compiled_contract": test_result.get("compiled"),
                "network": network
            })
            await self._publish_event("deployment_confirmed", deploy_result)
            self.state["deployment"] = deploy_result
            self.state["stages_completed"].append(WorkflowStage.DEPLOYMENT)
            
            [+] [OK] Workflow completed successfully!
            return {
                "status": "success",
                "workflow_id": self.workflow_id,
                "contract_address": deploy_result["contract_address"],
                "tx_hash": deploy_result["tx_hash"],
                "stages": self.state["stages_completed"]
            }
        
        except Exception as e:
            await self._publish_event("error_occurred", {"error": str(e)})
            return {
                "status": "failed",
                "workflow_id": self.workflow_id,
                "error": str(e),
                "stages_completed": self.state["stages_completed"]
            }
    
    async def _publish_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish event to message bus"""
        event = {
            "type": event_type,
            "workflow_id": self.workflow_id,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        await self.event_bus.publish(f"workflow:{self.workflow_id}", json.dumps(event))
```

---

## EVENT TYPES & FLOW

### Event System Architecture

```python
# hyperagent/events/event_types.py

from typing import Dict, Any, Callable
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

class EventType(Enum):
    """Complete event catalog"""
    
    # Workflow events
    WORKFLOW_CREATED = "workflow.created"
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_PROGRESSED = "workflow.progressed"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_FAILED = "workflow.failed"
    WORKFLOW_CANCELLED = "workflow.cancelled"
    
    # Generation events
    GENERATION_STARTED = "generation.started"
    GENERATION_COMPLETED = "generation.completed"
    GENERATION_FAILED = "generation.failed"
    
    # Audit events
    AUDIT_STARTED = "audit.started"
    AUDIT_COMPLETED = "audit.completed"
    AUDIT_FAILED = "audit.failed"
    
    # Deployment events
    DEPLOYMENT_STARTED = "deployment.started"
    DEPLOYMENT_PENDING_CONFIRMATION = "deployment.pending_confirmation"
    DEPLOYMENT_CONFIRMED = "deployment.confirmed"
    DEPLOYMENT_FAILED = "deployment.failed"
    
    # System events
    ERROR_OCCURRED = "system.error"
    TASK_QUEUED = "system.task_queued"
    TASK_STARTED = "system.task_started"
    TASK_COMPLETED = "system.task_completed"

@dataclass
class Event:
    """Base event structure"""
    id: str
    type: EventType
    workflow_id: str
    timestamp: datetime
    data: Dict[str, Any]
    source_agent: str
    metadata: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "workflow_id": self.workflow_id,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "source_agent": self.source_agent,
            "metadata": self.metadata or {}
        }

# Event flow diagrams

EVENT_FLOW = """
┌─────────────────────────────────────────────────────────────┐
│               HyperAgent Event Flow (A2A Protocol)           │
└─────────────────────────────────────────────────────────────┘

Timeline:
  T0: workflow.created
      ├─ Event: Workflow initialized
      ├─ Data: NLP input, network, user_id
      └─ Listeners: Logger, State Manager, Event Store

  T1: generation.started
      ├─ Event: Contract generation begins
      ├─ Trigger: After workflow validation
      └─ Listener: GenerationAgent subscribes

  T2: generation.completed
      ├─ Event: Contract generated successfully
      ├─ Data: contract_code, contract_type, abi
      └─ Listeners: AuditAgent, State Manager

  T3: audit.started
      ├─ Event: Security audit begins
      ├─ Trigger: Auto-triggered by generation.completed
      └─ Listener: AuditAgent picks up event

  T4: audit.completed
      ├─ Event: Audit results ready
      ├─ Data: vulnerabilities, risk_score, status
      └─ Listeners: TestAgent, Database Persister

  T5: workflow.progressed
      ├─ Event: Progress update (progress_percentage)
      ├─ Trigger: Sent to UI for real-time updates
      └─ Listener: WebSocket broadcaster

  T6: deployment.started
      ├─ Event: On-chain deployment initiated
      ├─ Data: compiled contract, network, deployer_address
      └─ Listener: DeploymentAgent subscribes

  T7: deployment.pending_confirmation
      ├─ Event: TX submitted, awaiting confirmation
      ├─ Data: tx_hash, contract_address (provisional)
      └─ Listener: BlockListener for confirmation

  T8: deployment.confirmed
      ├─ Event: Deployment confirmed on-chain
      ├─ Data: block_number, gas_used, confirmation_blocks
      └─ Listeners: State Manager, Audit Logger

  T9: workflow.completed
      ├─ Event: Complete workflow success
      ├─ Data: All stage results aggregated
      ├─ Listeners: Database finalization, Notifications
      └─ Actions: Send email, update UI, archive

Error paths:
  - generation.failed → workflow.failed → Retry or Manual Fix
  - audit.completed (high risk) → workflow alert → User decision
  - deployment.failed → Retry mechanism → up to 3 attempts
"""

# Event handlers (A2A pattern)

class EventHandler:
    """Base event handler for decoupled services"""
    
    async def handle(self, event: Event) -> None:
        raise NotImplementedError
    
    async def on_error(self, event: Event, error: Exception) -> None:
        raise NotImplementedError

class StateManagerHandler(EventHandler):
    """Manages workflow state based on events"""
    
    async def handle(self, event: Event) -> None:
        if event.type == EventType.GENERATION_COMPLETED:
            # Update state with generated contract
            await self.update_state(
                event.workflow_id,
                {"contract_code": event.data["contract_code"]}
            )
        elif event.type == EventType.DEPLOYMENT_CONFIRMED:
            # Update state with deployed address
            await self.update_state(
                event.workflow_id,
                {"deployed_address": event.data["contract_address"]}
            )

class WebSocketBroadcasterHandler(EventHandler):
    """Broadcasts events to connected clients via WebSocket"""
    
    async def handle(self, event: Event) -> None:
        await self.broadcast(event.workflow_id, event.to_dict())

class AuditLoggerHandler(EventHandler):
    """Logs all events to audit table"""
    
    async def handle(self, event: Event) -> None:
        await self.log_to_database(event)

# Event bus pattern

class EventBus:
    """Central event hub (SOA Event Broker)"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.handlers: Dict[EventType, List[Callable]] = {}
    
    def subscribe(self, event_type: EventType, handler: EventHandler) -> None:
        """Subscribe handler to event type"""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)
    
    async def publish(self, event: Event) -> None:
        """Publish event to all subscribers"""
        # Store in Redis streams
        await self.redis.xadd(
            f"events:{event.type.value}",
            {"data": json.dumps(event.to_dict())}
        )
        
        # Call local handlers
        if event.type in self.handlers:
            for handler in self.handlers[event.type]:
                try:
                    await handler.handle(event)
                except Exception as e:
                    await handler.on_error(event, e)
```

---

## AGENT ROLES & RESPONSIBILITIES

### Detailed Agent Specifications

```python
# hyperagent/agents/definitions.py

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum

@dataclass
class AgentDefinition:
    """Complete agent specification"""
    name: str
    role: str
    description: str
    inputs: List[Dict[str, Any]]
    outputs: List[Dict[str, Any]]
    dependencies: List[str]
    max_retry_count: int
    timeout_seconds: int
    parallelizable: bool
    requires_human_approval: bool
    performance_sla: Dict[str, int]  # {p99: ms, p95: ms}

# Agent 1: GENERATION AGENT (LLM-based)

GENERATION_AGENT = AgentDefinition(
    name="GenerationAgent",
    role="contract_generator",
    description="Generates Solidity smart contracts from natural language descriptions using LLM (Gemini/GPT-4)",
    
    inputs=[
        {
            "name": "nlp_description",
            "type": "string",
            "required": True,
            "description": "Natural language description of contract functionality",
            "example": "Create an ERC20 token with 1 million supply and burn mechanism"
        },
        {
            "name": "contract_type",
            "type": "enum",
            "enum": ["ERC20", "ERC721", "ERC1155", "Governance", "DEX", "Lending", "Custom"],
            "required": False,
            "default": "Custom"
        },
        {
            "name": "network",
            "type": "enum",
            "enum": ["hyperion_testnet", "hyperion_mainnet", "mantle_testnet", "mantle_mainnet"],
            "required": True
        },
        {
            "name": "advanced_options",
            "type": "object",
            "required": False,
            "fields": {
                "include_reentrancy_guard": "boolean",
                "include_pausable": "boolean",
                "include_upgradeable": "boolean",
                "compiler_optimization": "0-2000"
            }
        }
    ],
    
    outputs=[
        {
            "name": "contract_code",
            "type": "string",
            "description": "Generated Solidity code"
        },
        {
            "name": "contract_type",
            "type": "string",
            "description": "Determined contract type"
        },
        {
            "name": "abi",
            "type": "object",
            "description": "Contract ABI specification"
        },
        {
            "name": "constructor_args",
            "type": "array",
            "description": "Constructor parameters with types"
        }
    ],
    
    dependencies=["llm_provider", "rag_service", "pinata_client"],
    max_retry_count=2,
    timeout_seconds=60,
    parallelizable=True,
    requires_human_approval=False,
    performance_sla={"p99": 45000, "p95": 30000}  # ms
)

# Agent 2: AUDIT AGENT (Security Analysis)

AUDIT_AGENT = AgentDefinition(
    name="AuditAgent",
    role="security_auditor",
    description="Performs comprehensive security audit using Slither, Mythril, and Echidna",
    
    inputs=[
        {
            "name": "contract_code",
            "type": "string",
            "required": True,
            "description": "Solidity source code to audit"
        },
        {
            "name": "audit_level",
            "type": "enum",
            "enum": ["basic", "standard", "comprehensive"],
            "default": "standard",
            "description": "Audit depth level"
        },
        {
            "name": "contract_compiled_bytecode",
            "type": "string",
            "required": False,
            "description": "Compiled bytecode for Mythril analysis"
        }
    ],
    
    outputs=[
        {
            "name": "vulnerabilities",
            "type": "array",
            "description": "List of found vulnerabilities with severity"
        },
        {
            "name": "overall_risk_score",
            "type": "float",
            "range": [0, 100],
            "description": "Aggregate risk score"
        },
        {
            "name": "audit_report",
            "type": "object",
            "description": "Detailed audit findings by tool"
        },
        {
            "name": "recommendations",
            "type": "array",
            "description": "Security improvement recommendations"
        }
    ],
    
    dependencies=["slither_tool", "mythril_tool", "echidna_tool"],
    max_retry_count=1,
    timeout_seconds=120,
    parallelizable=True,
    requires_human_approval=False,
    performance_sla={"p99": 90000, "p95": 60000}
)

# Agent 3: TESTING AGENT (Compilation & Unit Tests)

TESTING_AGENT = AgentDefinition(
    name="TestingAgent",
    role="contract_tester",
    description="Compiles contract, generates and runs unit tests, calculates coverage",
    
    inputs=[
        {
            "name": "contract_code",
            "type": "string",
            "required": True
        },
        {
            "name": "test_framework",
            "type": "enum",
            "enum": ["hardhat", "foundry"],
            "default": "hardhat"
        },
        {
            "name": "solidity_version",
            "type": "string",
            "default": "0.8.27"
        },
        {
            "name": "generate_tests",
            "type": "boolean",
            "default": True,
            "description": "Auto-generate test cases using LLM"
        }
    ],
    
    outputs=[
        {
            "name": "compilation_successful",
            "type": "boolean"
        },
        {
            "name": "abi",
            "type": "object",
            "description": "Contract ABI"
        },
        {
            "name": "bytecode",
            "type": "string"
        },
        {
            "name": "test_results",
            "type": "object",
            "fields": {
                "total": "int",
                "passed": "int",
                "failed": "int"
            }
        },
        {
            "name": "coverage",
            "type": "object",
            "fields": {
                "line_coverage": "float",
                "branch_coverage": "float"
            }
        }
    ],
    
    dependencies=["hardhat", "foundry", "llm_provider"],
    max_retry_count=2,
    timeout_seconds=180,
    parallelizable=False,
    requires_human_approval=False,
    performance_sla={"p99": 150000, "p95": 100000}
)

# Agent 4: DEPLOYMENT AGENT (On-Chain)

DEPLOYMENT_AGENT = AgentDefinition(
    name="DeploymentAgent",
    role="contract_deployer",
    description="Deploys compiled contracts to blockchain networks using Alith SDK",
    
    inputs=[
        {
            "name": "compiled_contract",
            "type": "object",
            "required": True,
            "fields": {
                "abi": "array",
                "bytecode": "string"
            }
        },
        {
            "name": "network",
            "type": "enum",
            "enum": ["hyperion_testnet", "hyperion_mainnet", "mantle_testnet", "mantle_mainnet"],
            "required": True
        },
        {
            "name": "deployer_address",
            "type": "string",
            "required": True
        },
        {
            "name": "constructor_args",
            "type": "array",
            "default": []
        },
        {
            "name": "gas_limit",
            "type": "integer",
            "required": False,
            "description": "Optional custom gas limit"
        }
    ],
    
    outputs=[
        {
            "name": "contract_address",
            "type": "string",
            "description": "Deployed contract address"
        },
        {
            "name": "transaction_hash",
            "type": "string"
        },
        {
            "name": "block_number",
            "type": "integer"
        },
        {
            "name": "gas_used",
            "type": "integer"
        },
        {
            "name": "deployment_cost",
            "type": "object",
            "fields": {
                "wei": "integer",
                "ether": "float",
                "usd": "float"
            }
        },
        {
            "name": "confirmation_status",
            "type": "enum",
            "enum": ["pending", "confirmed", "failed"]
        }
    ],
    
    dependencies=["web3_provider", "alith_sdk", "eigenda_client"],
    max_retry_count=3,
    timeout_seconds=600,
    parallelizable=False,
    requires_human_approval=True,  # Requires user confirmation before spending gas
    performance_sla={"p99": 300000, "p95": 200000}
)

# Agent 5: COORDINATOR AGENT (Orchestration)

COORDINATOR_AGENT = AgentDefinition(
    name="CoordinatorAgent",
    role="workflow_orchestrator",
    description="Orchestrates workflow execution, manages state, handles error recovery",
    
    inputs=[
        {
            "name": "workflow_definition",
            "type": "object",
            "required": True,
            "fields": {
                "workflow_id": "uuid",
                "nlp_input": "string",
                "network": "string"
            }
        }
    ],
    
    outputs=[
        {
            "name": "workflow_status",
            "type": "enum",
            "enum": ["success", "failed", "pending"]
        },
        {
            "name": "execution_report",
            "type": "object"
        }
    ],
    
    dependencies=["event_bus", "state_manager", "database"],
    max_retry_count=0,
    timeout_seconds=900,  # 15 minutes
    parallelizable=False,
    requires_human_approval=False,
    performance_sla={"p99": 800000, "p95": 600000}
)

# Agent interaction matrix (SOA A2A Communication)

AGENT_INTERACTION_MATRIX = """
Source Agent    |  Target Agent(s)    |  Trigger Event              |  Data Passed
─────────────────────────────────────────────────────────────────────────────────────
Coordinator    │  Generation         │  workflow.started           │  NLP input
Generation     │  Audit              │  generation.completed       │  Contract code
Audit          │  Testing            │  audit.completed            │  Contract info
Testing        │  Deployment         │  testing.completed          │  Compiled ABI
Deployment     │  Coordinator        │  deployment.confirmed       │  Deployment info
Deployment     │  Coordinator        │  deployment.failed          │  Error details
Any            │  Coordinator        │  service.error              │  Error context
"""
```

---

## A2A/SOA/SOP IMPLEMENTATION

### Service-Oriented Architecture Pattern

```python
# hyperagent/architecture/soa.py

from typing import Dict, Any, Protocol, List
from abc import ABC, abstractmethod
import asyncio
from dataclasses import dataclass
from enum import Enum

class ServiceContract(Protocol):
    """Service interface contract (SOA principle)"""
    
    async def execute(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Execute service operation"""
        ...
    
    async def validate_request(self, request: Dict[str, Any]) -> bool:
        """Validate input request"""
        ...
    
    async def handle_error(self, error: Exception) -> Dict[str, Any]:
        """Handle service errors"""
        ...

class ServiceRegistry:
    """Service discovery and registration (SOA registry)"""
    
    def __init__(self):
        self._services: Dict[str, ServiceContract] = {}
        self._service_metadata: Dict[str, Dict[str, Any]] = {}
    
    def register(self, service_name: str, service: ServiceContract, metadata: Dict = None):
        """Register a service"""
        self._services[service_name] = service
        self._service_metadata[service_name] = metadata or {}
    
    def get_service(self, service_name: str) -> ServiceContract:
        """Retrieve service by name"""
        if service_name not in self._services:
            raise ValueError(f"Service not found: {service_name}")
        return self._services[service_name]
    
    def list_services(self) -> List[str]:
        """List all registered services"""
        return list(self._services.keys())

class ServiceOrchestratorPattern(ABC):
    """Abstract service orchestrator (Service composition)"""
    
    def __init__(self, registry: ServiceRegistry, event_bus):
        self.registry = registry
        self.event_bus = event_bus
    
    @abstractmethod
    async def orchestrate(self, workflow_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute orchestrated workflow"""
        pass

class SequentialOrchestrator(ServiceOrchestratorPattern):
    """Sequential execution of services (Pipeline pattern)"""
    
    async def orchestrate(self, workflow_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute services sequentially
        Output of one service becomes input to next
        """
        pipeline = workflow_context.get("pipeline", [])
        result = workflow_context.get("initial_data", {})
        
        for stage_index, stage in enumerate(pipeline):
            service_name = stage["service"]
            service = self.registry.get_service(service_name)
            
            try:
                # Prepare request
                request = self._prepare_request(stage, result)
                
                # Validate
                if not await service.validate_request(request):
                    raise ValueError(f"Request validation failed for {service_name}")
                
                # Execute
                result = await service.execute(request)
                
                # Publish progress event
                await self.event_bus.publish({
                    "type": "stage_completed",
                    "stage": stage_index,
                    "service": service_name,
                    "result": result
                })
                
            except Exception as e:
                error_result = await service.handle_error(e)
                await self.event_bus.publish({
                    "type": "stage_failed",
                    "stage": stage_index,
                    "service": service_name,
                    "error": str(e)
                })
                raise
        
        return result
    
    def _prepare_request(self, stage: Dict, previous_output: Dict) -> Dict:
        """Prepare request by mapping previous output to service input"""
        request = {}
        
        # Static inputs
        if "inputs" in stage:
            request.update(stage["inputs"])
        
        # Dynamic inputs from previous stage output
        if "input_mapping" in stage:
            for target_key, source_key in stage["input_mapping"].items():
                if source_key in previous_output:
                    request[target_key] = previous_output[source_key]
        
        return request

class ParallelOrchestrator(ServiceOrchestratorPattern):
    """Parallel execution of independent services"""
    
    async def orchestrate(self, workflow_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute services in parallel when possible"""
        services_to_run = workflow_context.get("services", [])
        
        # Group by dependencies
        independent_tasks = []
        for service_spec in services_to_run:
            service = self.registry.get_service(service_spec["name"])
            task = asyncio.create_task(
                self._execute_service(service, service_spec)
            )
            independent_tasks.append(task)
        
        results = await asyncio.gather(*independent_tasks, return_exceptions=True)
        
        return {
            "parallel_results": results,
            "success": all(not isinstance(r, Exception) for r in results)
        }
    
    async def _execute_service(self, service: ServiceContract, spec: Dict) -> Dict:
        """Execute single service"""
        request = spec.get("request", {})
        return await service.execute(request)

class HybridOrchestrator(ServiceOrchestratorPattern):
    """Hybrid orchestration combining sequential and parallel execution"""
    
    async def orchestrate(self, workflow_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flexible orchestration:
        - Sequential by default
        - Parallel execution for independent stages
        - Conditional branching
        """
        stages = workflow_context.get("stages", [])
        result = {}
        
        for stage in stages:
            if stage.get("type") == "sequential":
                service = self.registry.get_service(stage["service"])
                result = await service.execute(result)
            
            elif stage.get("type") == "parallel":
                tasks = [
                    self._execute_parallel_service(svc)
                    for svc in stage["services"]
                ]
                parallel_results = await asyncio.gather(*tasks)
                result.update({"parallel": parallel_results})
            
            elif stage.get("type") == "conditional":
                if await self._evaluate_condition(stage["condition"], result):
                    service = self.registry.get_service(stage["true_service"])
                else:
                    service = self.registry.get_service(stage["false_service"])
                result = await service.execute(result)
        
        return result

# Agent-to-Agent (A2A) Protocol Implementation

@dataclass
class A2AMessage:
    """Agent-to-Agent protocol message"""
    sender_agent: str
    receiver_agent: str
    message_type: str  # request, response, event
    correlation_id: str
    payload: Dict[str, Any]
    timestamp: str
    retry_count: int = 0
    timeout_ms: int = 5000

class A2AProtocol:
    """Agent-to-Agent communication protocol"""
    
    def __init__(self, event_bus, service_registry: ServiceRegistry):
        self.event_bus = event_bus
        self.registry = service_registry
        self._pending_requests: Dict[str, asyncio.Future] = {}
    
    async def send_request(self, message: A2AMessage) -> Dict[str, Any]:
        """Send request from one agent to another"""
        future = asyncio.Future()
        self._pending_requests[message.correlation_id] = future
        
        try:
            # Route message
            await self.event_bus.publish(f"a2a:{message.receiver_agent}", message.to_dict())
            
            # Wait for response with timeout
            response = await asyncio.wait_for(
                future,
                timeout=message.timeout_ms / 1000
            )
            return response
        
        except asyncio.TimeoutError:
            if message.retry_count < 3:
                # Retry with exponential backoff
                await asyncio.sleep(2 ** message.retry_count)
                message.retry_count += 1
                return await self.send_request(message)
            raise
        
        finally:
            self._pending_requests.pop(message.correlation_id, None)
    
    async def send_response(self, correlation_id: str, response: Dict[str, Any]):
        """Send response back to requesting agent"""
        if correlation_id in self._pending_requests:
            self._pending_requests[correlation_id].set_result(response)

# Example: HyperAgent A2A workflow

class HyperAgentA2AWorkflow:
    """Complete A2A workflow for HyperAgent"""
    
    def __init__(self, a2a_protocol: A2AProtocol):
        self.a2a = a2a_protocol
    
    async def generate_and_audit_workflow(self, nlp_input: str, network: str):
        """
        Workflow showing A2A communication:
        Coordinator → Generation → Audit → Deployment
        """
        import uuid
        
        # Message 1: Coordinator to Generator
        gen_message = A2AMessage(
            sender_agent="coordinator",
            receiver_agent="generator",
            message_type="request",
            correlation_id=str(uuid.uuid4()),
            payload={
                "nlp_description": nlp_input,
                "network": network
            },
            timestamp=datetime.now().isoformat()
        )
        
        gen_response = await self.a2a.send_request(gen_message)
        
        # Message 2: Generator to Auditor
        audit_message = A2AMessage(
            sender_agent="generator",
            receiver_agent="auditor",
            message_type="request",
            correlation_id=str(uuid.uuid4()),
            payload={
                "contract_code": gen_response["contract_code"],
                "audit_level": "standard"
            },
            timestamp=datetime.now().isoformat()
        )
        
        audit_response = await self.a2a.send_request(audit_message)
        
        # Message 3: Auditor to Deployer (if security ok)
        if audit_response["overall_risk_score"] < 50:
            deploy_message = A2AMessage(
                sender_agent="auditor",
                receiver_agent="deployer",
                message_type="request",
                correlation_id=str(uuid.uuid4()),
                payload={
                    "contract_code": gen_response["contract_code"],
                    "network": network
                },
                timestamp=datetime.now().isoformat()
            )
            
            deploy_response = await self.a2a.send_request(deploy_message)
            return deploy_response
        else:
            return {"status": "rejected", "reason": "security_risk"}
```

---

## CI/CD GITHUB WORKFLOW

### Complete GitHub Actions Configuration

```yaml
# .github/workflows/build-test-deploy.yml

name: HyperAgent CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Daily security scan

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}
  PYTHON_VERSION: '3.10'

jobs:
  # ============================================================================
  # STAGE 1: CODE QUALITY & LINTING
  # ============================================================================
  
  lint-and-format:
    name: '[*] Code Quality Checks'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install linting tools
        run: |
          pip install flake8 black isort mypy pylint
      
      - name: Run Black formatter check
        run: black --check hyperagent/
      
      - name: Run isort import check
        run: isort --check-only hyperagent/
      
      - name: Run Flake8 linting
        run: flake8 hyperagent/ --max-line-length=120 --statistics
      
      - name: Run MyPy type checking
        run: mypy hyperagent/ --ignore-missing-imports
  
  # ============================================================================
  # STAGE 2: SECURITY SCANNING
  # ============================================================================
  
  security-scan:
    name: '[*] Security Scan'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Run Bandit security linter
        run: |
          pip install bandit
          bandit -r hyperagent/ -f json -o bandit-report.json || true
  
  # ============================================================================
  # STAGE 3: UNIT TESTS
  # ============================================================================
  
  unit-tests:
    name: '[TEST] Unit Tests'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: hyperagent_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio
      
      - name: Create .env.test
        run: |
          cat > .env.test << EOF
          DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/hyperagent_test
          REDIS_URL=redis://localhost:6379/0
          GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
          OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
          PINATA_JWT=${{ secrets.PINATA_JWT }}
          EOF
      
      - name: Run unit tests with coverage
        run: |
          pytest tests/unit/ \
            --cov=hyperagent \
            --cov-report=xml \
            --cov-report=html \
            --cov-report=term-missing \
            -v
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          fail_ci_if_error: false
  
  # ============================================================================
  # STAGE 4: INTEGRATION TESTS
  # ============================================================================
  
  integration-tests:
    name: '[TEST] Integration Tests'
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: hyperagent_int
          POSTGRES_USER: int_user
          POSTGRES_PASSWORD: int_pass
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio
      
      - name: Run integration tests
        run: |
          pytest tests/integration/ -v --tb=short
        env:
          DATABASE_URL: postgresql://int_user:int_pass@localhost:5432/hyperagent_int
          REDIS_URL: redis://localhost:6379/0
  
  # ============================================================================
  # STAGE 5: SMART CONTRACT SECURITY AUDIT
  # ============================================================================
  
  contract-security-scan:
    name: '[SEC] Smart Contract Audit'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Install security tools
        run: |
          pip install slither-analyzer mythril
          npm install -g hardhat
      
      - name: Scan example contracts with Slither
        run: |
          slither tests/fixtures/contracts/ --json --outfile slither-report.json || true
      
      - name: Generate security report
        run: |
          python scripts/generate_security_report.py
  
  # ============================================================================
  # STAGE 6: BUILD DOCKER IMAGE
  # ============================================================================
  
  build-docker:
    name: '[BUILD] Docker Image'
    runs-on: ubuntu-latest
    needs: [lint-and-format, security-scan, unit-tests]
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  
  # ============================================================================
  # STAGE 7: DEPLOY TO TESTNET
  # ============================================================================
  
  deploy-testnet:
    name: '[DEPLOY] Hyperion Testnet'
    runs-on: ubuntu-latest
    needs: build-docker
    if: github.ref == 'refs/heads/develop' && github.event_name == 'push'
    environment:
      name: hyperion-testnet
      url: https://hyperion-testnet-explorer.metisdevops.link
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Deploy to Hyperion Testnet
        run: |
          pip install -r requirements.txt
          python scripts/deploy_testnet.py
        env:
          PRIVATE_KEY: ${{ secrets.TESTNET_PRIVATE_KEY }}
          RPC_URL: https://hyperion-testnet.metisdevops.link
          NETWORK: hyperion_testnet
      
      - name: Verify deployment
        run: |
          python scripts/verify_deployment.py
        env:
          NETWORK: hyperion_testnet
  
  # ============================================================================
  # STAGE 8: SMOKE TESTS ON LIVE NETWORK
  # ============================================================================
  
  smoke-tests:
    name: '[TEST] Smoke Tests'
    runs-on: ubuntu-latest
    needs: deploy-testnet
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Run smoke tests
        run: |
          pip install -r requirements.txt
          pytest tests/smoke/ -v
        env:
          RPC_URL: https://hyperion-testnet.metisdevops.link
          NETWORK: hyperion_testnet
  
  # ============================================================================
  # STAGE 9: DEPLOY TO MAINNET (Manual approval required)
  # ============================================================================
  
  deploy-mainnet:
    name: '[DEPLOY] Hyperion Mainnet'
    runs-on: ubuntu-latest
    needs: smoke-tests
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: hyperion-mainnet
      url: https://hyperion-explorer.metisdevops.link
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: '[!] Manual approval step'
        run: |
          echo "Deployment to Mainnet requires manual approval"
          echo "Check: https://github.com/${{ github.repository }}/actions"
      
      - name: Deploy to Hyperion Mainnet
        run: |
          pip install -r requirements.txt
          python scripts/deploy_mainnet.py
        env:
          PRIVATE_KEY: ${{ secrets.MAINNET_PRIVATE_KEY }}
          RPC_URL: https://hyperion.metisdevops.link
          NETWORK: hyperion_mainnet
  
  # ============================================================================
  # STAGE 10: NOTIFICATION & REPORTING
  # ============================================================================
  
  notify:
    name: '[*] Notifications'
    runs-on: ubuntu-latest
    if: always()
    needs: [lint-and-format, unit-tests, build-docker]
    
    steps:
      - name: Determine status
        id: status
        run: |
          if [ "${{ needs.unit-tests.result }}" == "success" ]; then
            echo "status=success" >> $GITHUB_OUTPUT
          else
            echo "status=failure" >> $GITHUB_OUTPUT
          fi
      
      - name: Send Slack notification
        if: steps.status.outputs.status == 'failure'
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "HyperAgent CI/CD Pipeline Failed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "[-] *Build Failed*\nRepo: ${{ github.repository }}\nBranch: ${{ github.ref }}\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }
```

---

## DOCKER CONTAINERIZATION

### Multi-Stage Dockerfile & Docker Compose

```dockerfile
# Dockerfile - Production Build

FROM python:3.10-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.10-slim

WORKDIR /app

# Install runtime dependencies (non-build)
RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY hyperagent/ ./hyperagent/
COPY config/ ./config/
COPY scripts/ ./scripts/
COPY .env.example .

# Set environment
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Expose ports
EXPOSE 8000 6379 5432

# Run application
CMD ["uvicorn", "hyperagent.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml - Complete Stack

version: '3.9'

services:
  # ============================================================================
  # MAIN APPLICATION
  # ============================================================================
  
  hyperagent:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hyperagent_app
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://hyperagent_user:secure_password@postgres:5432/hyperagent_db
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - PINATA_JWT=${PINATA_JWT}
      - LOG_LEVEL=INFO
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./hyperagent:/app/hyperagent
      - ./config:/app/config
      - ./logs:/app/logs
    networks:
      - hyperagent_network
    restart: unless-stopped
  
  # ============================================================================
  # DATABASE (POSTGRESQL)
  # ============================================================================
  
  postgres:
    image: postgres:15-alpine
    container_name: hyperagent_postgres
    environment:
      POSTGRES_DB: hyperagent_db
      POSTGRES_USER: hyperagent_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hyperagent_user -d hyperagent_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - hyperagent_network
    restart: unless-stopped
  
  # ============================================================================
  # CACHE (REDIS)
  # ============================================================================
  
  redis:
    image: redis:7-alpine
    container_name: hyperagent_redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass redis_secure_pass
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - hyperagent_network
    restart: unless-stopped
  
  # ============================================================================
  # MONITORING & OBSERVABILITY
  # ============================================================================
  
  prometheus:
    image: prom/prometheus:latest
    container_name: hyperagent_prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
    networks:
      - hyperagent_network
    restart: unless-stopped
  
  grafana:
    image: grafana/grafana:latest
    container_name: hyperagent_grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards
    depends_on:
      - prometheus
    networks:
      - hyperagent_network
    restart: unless-stopped
  
  # ============================================================================
  # LOGGING
  # ============================================================================
  
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
    container_name: hyperagent_elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - hyperagent_network
    restart: unless-stopped
  
  kibana:
    image: docker.elastic.co/kibana/kibana:8.0.0
    container_name: hyperagent_kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    networks:
      - hyperagent_network
    restart: unless-stopped

networks:
  hyperagent_network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  elasticsearch_data:
```

---

## CLI DESIGN & COMMANDS

```python
# hyperagent/cli/main.py
"""
HyperAgent CLI - ASCII-based command interface
All output uses ASCII symbols for terminal compatibility
"""

import click
import json
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress
from hyperagent.core.agent_system import WorkflowCoordinator
from hyperagent.api.client import HyperAgentClient

console = Console()

class CLIStyle:
    """ASCII CLI styling rules"""
    SUCCESS = "[+]"
    ERROR = "[-]"
    WARNING = "[!]"
    INFO = "[*]"
    WAIT = "[...]"
    SEARCH = "[?]"

def print_banner():
    """Display HyperAgent banner"""
    banner = """
    ╔══════════════════════════════════════════════╗
    ║          HyperAgent v1.0.0                  ║
    ║   AI-Powered Smart Contract Generator       ║
    ║   + Security Auditing                        ║
    ║   + Automated Deployment                     ║
    ╚══════════════════════════════════════════════╝
    
    [*] Web3 enabled: Hyperion + Mantle Networks
    [*] LLM Provider: Gemini (OpenAI Fallback)
    [*] Security Tools: Slither, Mythril, Echidna
    """
    console.print(Panel(banner, border_style="blue"))

@click.group()
@click.version_option(version="1.0.0")
def cli():
    """HyperAgent: AI Agent for Smart Contract Generation & Deployment"""
    pass

# ============================================================================
# COMMAND GROUP: WORKFLOW
# ============================================================================

@cli.group()
def workflow():
    """Workflow management commands"""
    pass

@workflow.command()
@click.option('--description', '-d', required=True, help='NLP description of contract')
@click.option('--network', '-n', type=click.Choice(['hyperion_testnet', 'hyperion_mainnet', 'mantle_testnet', 'mantle_mainnet']), default='hyperion_testnet', help='Target blockchain')
@click.option('--type', '-t', type=click.Choice(['ERC20', 'ERC721', 'ERC1155', 'Custom']), default='Custom', help='Contract type')
@click.option('--no-audit', is_flag=True, help='Skip security audit')
@click.option('--no-deploy', is_flag=True, help='Skip deployment')
def generate(description: str, network: str, type: str, no_audit: bool, no_deploy: bool):
    """[>] Generate and deploy smart contract from NLP description"""
    print_banner()
    
    console.print(f"\n{CLIStyle.INFO} Starting workflow generation...")
    console.print(f"{CLIStyle.INFO} Network: {network}")
    console.print(f"{CLIStyle.INFO} Contract Type: {type}")
    console.print(f"{CLIStyle.INFO} Description: {description[:60]}...")
    
    try:
        client = HyperAgentClient()
        
        with Progress() as progress:
            # Task 1: Submit workflow
            task1 = progress.add_task("[*] Submitting workflow...", total=None)
            workflow_response = client.create_workflow(
                nlp_input=description,
                network=network,
                contract_type=type,
                skip_audit=no_audit,
                skip_deployment=no_deploy
            )
            workflow_id = workflow_response["workflow_id"]
            progress.update(task1, completed=True)
            console.print(f"{CLIStyle.SUCCESS} Workflow created: {workflow_id}")
            
            # Task 2: Monitor execution
            task2 = progress.add_task("[*] Executing workflow...", total=100)
            while True:
                status = client.get_workflow_status(workflow_id)
                progress.update(task2, completed=status["progress_percentage"])
                
                if status["status"] == "completed":
                    progress.update(task2, completed=100)
                    break
                elif status["status"] == "failed":
                    console.print(f"{CLIStyle.ERROR} Workflow failed: {status['error_message']}")
                    return
        
        # Display results
        result = client.get_workflow_result(workflow_id)
        
        console.print(f"\n{CLIStyle.SUCCESS} Workflow completed successfully!")
        console.print(f"\n{CLIStyle.INFO} Results:")
        console.print(f"  Contract Address: {result['contract_address']}")
        console.print(f"  Transaction Hash: {result['tx_hash']}")
        console.print(f"  Block Number: {result['block_number']}")
        console.print(f"  Gas Used: {result['gas_used']}")
        
    except Exception as e:
        console.print(f"{CLIStyle.ERROR} Error: {str(e)}")

@workflow.command()
@click.option('--workflow-id', '-w', required=True, help='Workflow ID')
def status(workflow_id: str):
    """[*] Check workflow status"""
    client = HyperAgentClient()
    status_data = client.get_workflow_status(workflow_id)
    
    # Create status table
    table = Table(title=f"Workflow Status: {workflow_id}")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="green")
    
    for key, value in status_data.items():
        table.add_row(key, str(value))
    
    console.print(table)

@workflow.command()
@click.option('--user-id', '-u', help='Filter by user ID')
@click.option('--status', '-s', type=click.Choice(['created', 'generating', 'auditing', 'testing', 'deploying', 'completed', 'failed']), help='Filter by status')
@click.option('--limit', '-l', type=int, default=10, help='Number of workflows to display')
def list(user_id: Optional[str], status: Optional[str], limit: int):
    """[*] List workflows"""
    client = HyperAgentClient()
    workflows = client.list_workflows(user_id=user_id, status=status, limit=limit)
    
    table = Table(title="Workflows")
    table.add_column("ID", style="cyan")
    table.add_column("Status", style="yellow")
    table.add_column("Network", style="green")
    table.add_column("Created", style="blue")
    
    for wf in workflows:
        table.add_row(wf["id"], wf["status"], wf["network"], wf["created_at"])
    
    console.print(table)

@workflow.command()
@click.option('--workflow-id', '-w', required=True, help='Workflow ID to cancel')
def cancel(workflow_id: str):
    """[!] Cancel running workflow"""
    client = HyperAgentClient()
    client.cancel_workflow(workflow_id)
    console.print(f"{CLIStyle.SUCCESS} Workflow cancelled: {workflow_id}")

# ============================================================================
# COMMAND GROUP: CONTRACT
# ============================================================================

@cli.group()
def contract():
    """Contract management commands"""
    pass

@contract.command()
@click.option('--file', '-f', required=True, type=click.File('r'), help='Solidity file to audit')
@click.option('--level', '-l', type=click.Choice(['basic', 'standard', 'comprehensive']), default='standard', help='Audit depth')
def audit(file, level: str):
    """[SEC] Run security audit on contract"""
    console.print(f"{CLIStyle.INFO} Running {level} security audit...")
    
    contract_code = file.read()
    client = HyperAgentClient()
    
    with Progress() as progress:
        task = progress.add_task("[*] Scanning for vulnerabilities...", total=None)
        audit_result = client.audit_contract(contract_code, audit_level=level)
        progress.update(task, completed=True)
    
    # Display audit results
    table = Table(title="Audit Results")
    table.add_column("Severity", style="red")
    table.add_column("Count", style="yellow")
    
    table.add_row("Critical", str(audit_result["critical_count"]))
    table.add_row("High", str(audit_result["high_count"]))
    table.add_row("Medium", str(audit_result["medium_count"]))
    table.add_row("Low", str(audit_result["low_count"]))
    
    risk_score = audit_result["overall_risk_score"]
    risk_level = "CRITICAL" if risk_score > 70 else "WARNING" if risk_score > 30 else "SAFE"
    
    console.print(table)
    console.print(f"\n{CLIStyle.INFO} Overall Risk Score: {risk_score}/100 ({risk_level})")

@contract.command()
@click.option('--file', '-f', required=True, type=click.File('r'), help='Solidity file to compile')
@click.option('--output', '-o', type=click.File('w'), help='Output ABI file')
def compile(file, output):
    """[TOOL] Compile Solidity contract"""
    console.print(f"{CLIStyle.WAIT} Compiling contract...")
    
    contract_code = file.read()
    client = HyperAgentClient()
    compiled = client.compile_contract(contract_code)
    
    if output:
        output.write(json.dumps(compiled["abi"], indent=2))
        console.print(f"{CLIStyle.SUCCESS} ABI written to {output.name}")
    else:
        console.print(f"{CLIStyle.SUCCESS} Compilation successful!")
        console.print(f"  Functions: {len(compiled['abi'])}")

@contract.command()
@click.option('--address', '-a', required=True, help='Contract address')
@click.option('--network', '-n', type=click.Choice(['hyperion_testnet', 'mantle_testnet', 'mantle_mainnet']), default='hyperion_testnet')
def info(address: str, network: str):
    """[*] Get contract information"""
    client = HyperAgentClient()
    info_data = client.get_contract_info(address, network)
    
    console.print(f"\n{CLIStyle.INFO} Contract Information")
    console.print(f"  Address: {info_data['address']}")
    console.print(f"  Network: {network}")
    console.print(f"  Block: {info_data['block_number']}")
    console.print(f"  Deployed: {info_data['deployed_at']}")

# ============================================================================
# COMMAND GROUP: DEPLOYMENT
# ============================================================================

@cli.group()
def deploy():
    """Deployment commands"""
    pass

@deploy.command()
@click.option('--contract', '-c', required=True, type=click.File('r'), help='Contract file')
@click.option('--network', '-n', type=click.Choice(['hyperion_testnet', 'hyperion_mainnet', 'mantle_testnet', 'mantle_mainnet']), default='hyperion_testnet')
@click.option('--key', '-k', envvar='PRIVATE_KEY', help='Private key (from env var PRIVATE_KEY)')
@click.option('--constructor-args', '-args', multiple=True, help='Constructor arguments')
def upload(contract, network: str, key: str, constructor_args: tuple):
    """[>] Deploy contract to blockchain"""
    if not key:
        console.print(f"{CLIStyle.ERROR} Private key required (set PRIVATE_KEY env var)")
        return
    
    console.print(f"{CLIStyle.INFO} Deploying to {network}...")
    
    contract_code = contract.read()
    client = HyperAgentClient()
    
    with Progress() as progress:
        task = progress.add_task("[*] Sending transaction...", total=100)
        
        deployment = client.deploy_contract(
            contract_code,
            network=network,
            private_key=key,
            constructor_args=list(constructor_args)
        )
        
        progress.update(task, completed=50)
        console.print(f"  TX Hash: {deployment['tx_hash']}")
        
        progress.update(task, completed=100)
    
    console.print(f"{CLIStyle.SUCCESS} Deployment successful!")
    console.print(f"  Contract Address: {deployment['contract_address']}")
    console.print(f"  Block: {deployment['block_number']}")
    console.print(f"  Explorer: https://hyperion-testnet-explorer.metisdevops.link/address/{deployment['contract_address']}")

@deploy.command()
@click.option('--tx-hash', '-tx', required=True, help='Transaction hash to verify')
@click.option('--network', '-n', default='hyperion_testnet')
def verify(tx_hash: str, network: str):
    """[*] Verify deployment status"""
    client = HyperAgentClient()
    status = client.verify_deployment(tx_hash, network)
    
    console.print(f"\n{CLIStyle.INFO} Deployment Status")
    console.print(f"  TX Hash: {tx_hash}")
    console.print(f"  Status: {status['status']}")
    console.print(f"  Confirmations: {status['confirmations']}")
    if status.get('contract_address'):
        console.print(f"  Contract: {status['contract_address']}")

# ============================================================================
# COMMAND GROUP: SYSTEM
# ============================================================================

@cli.group()
def system():
    """System commands"""
    pass

@system.command()
def health():
    """[*] Check system health"""
    client = HyperAgentClient()
    health_data = client.get_health()
    
    status_icon = CLIStyle.SUCCESS if health_data["status"] == "healthy" else CLIStyle.ERROR
    
    table = Table(title=f"{status_icon} System Health")
    table.add_column("Component", style="cyan")
    table.add_column("Status", style="green")
    
    for component, comp_status in health_data["components"].items():
        status = "[+] OK" if comp_status else "[-] DOWN"
        table.add_row(component, status)
    
    console.print(table)

@system.command()
def config():
    """[*] Display configuration"""
    client = HyperAgentClient()
    config_data = client.get_config()
    
    console.print(json.dumps(config_data, indent=2))

@system.command()
@click.option('--lines', '-l', type=int, default=50, help='Number of lines to display')
def logs(lines: int):
    """[*] Show recent logs"""
    client = HyperAgentClient()
    log_entries = client.get_logs(limit=lines)
    
    table = Table(title="Recent Logs")
    table.add_column("Timestamp", style="blue")
    table.add_column("Level", style="yellow")
    table.add_column("Message", style="white")
    
    for entry in log_entries:
        table.add_row(entry["timestamp"], entry["level"], entry["message"])
    
    console.print(table)

@system.command()
def version():
    """[*] Display version information"""
    console.print(f"HyperAgent v1.0.0")
    console.print(f"Python: 3.10+")
    console.print(f"Web3: Enabled (Hyperion + Mantle)")
    console.print(f"LLM: Gemini (OpenAI Fallback)")

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    cli()
```

---

## ENVIRONMENT CONFIGURATION

```bash
# .env.example - Complete Environment Template

# ============================================================================
# APPLICATION CONFIG
# ============================================================================

NODE_ENV=development
LOG_LEVEL=INFO
DEBUG=false
APP_NAME=HyperAgent
APP_VERSION=1.0.0

# ============================================================================
# DATABASE (POSTGRESQL / SUPABASE)
# ============================================================================

# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# PostgreSQL Direct
DATABASE_URL=postgresql://user:password@localhost:5432/hyperagent
DB_POOL_SIZE=20
DB_POOL_TIMEOUT=30

# ============================================================================
# CACHE (REDIS)
# ============================================================================

REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=redis_secure_password
REDIS_DB=0
REDIS_CACHE_TTL=3600

# ============================================================================
# LLM PROVIDERS
# ============================================================================

# Gemini (Primary)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro
GEMINI_MAX_TOKENS=8000

# OpenAI (Fallback)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=8000

# ============================================================================
# RAG & VECTOR STORAGE
# ============================================================================

# Pinata (IPFS)
PINATA_API_KEY=your_pinata_api_key
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=gateway.pinata.cloud

# Vector DB (Supabase pgvector)
VECTOR_DB_DIMENSION=1536

# ============================================================================
# BLOCKCHAIN NETWORKS
# ============================================================================

# Hyperion (Testnet)
HYPERION_TESTNET_RPC=https://hyperion-testnet.metisdevops.link
HYPERION_TESTNET_CHAIN_ID=133717

# Hyperion (Mainnet)
HYPERION_MAINNET_RPC=https://hyperion.metisdevops.link
HYPERION_MAINNET_CHAIN_ID=133718

# Mantle (Testnet)
MANTLE_TESTNET_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_TESTNET_CHAIN_ID=5003

# Mantle (Mainnet)
MANTLE_MAINNET_RPC=https://rpc.mantle.xyz
MANTLE_MAINNET_CHAIN_ID=5000

# ============================================================================
# PRIVATE KEY & WALLETS
# ============================================================================

PRIVATE_KEY=your_private_key_hex
PUBLIC_ADDRESS=your_wallet_address
DEPLOYER_ADDRESS=deployment_wallet_address

# ============================================================================
# ALITH SDK CONFIGURATION
# ============================================================================

# Note: Alith SDK does not require an API key
# TEE (Trusted Execution Environment) is optional and will be initialized automatically if available
ALITH_AGENT_ID=your_agent_id  # Optional: for agent identification

# ============================================================================
# SECURITY & AUDIT TOOLS
# ============================================================================

# Mythril
MYTHRIL_TIMEOUT=300

# Slither
SLITHER_TIMEOUT=300

# Echidna
ECHIDNA_TIMEOUT=600

# ============================================================================
# ETHERSCAN / BLOCK EXPLORERS
# ============================================================================

ETHERSCAN_API_KEY=your_etherscan_api_key
MANTLESCAN_API_KEY=your_mantlescan_api_key

# ============================================================================
# AUTHENTICATION & API KEYS
# ============================================================================

SECRET_KEY=your_secret_key_for_jwt
JWT_ALGORITHM=HS256
JWT_EXPIRATION=3600

API_RATE_LIMIT=100
API_RATE_LIMIT_WINDOW=60

# ============================================================================
# MONITORING & TELEMETRY
# ============================================================================

PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

JAEGER_ENABLED=true
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6831

# ============================================================================
# EMAIL NOTIFICATIONS
# ============================================================================

SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
NOTIFICATION_EMAIL=alerts@yourdom.com

# ============================================================================
# SLACK NOTIFICATIONS (optional)
# ============================================================================

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#hyperagent-alerts

# ============================================================================
# SECURITY SETTINGS
# ============================================================================

CORS_ORIGINS=http://localhost:3000,http://localhost:8080
ALLOWED_HOSTS=localhost,127.0.0.1

# SSL/TLS (for production)
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# ============================================================================
# FEATURE FLAGS
# ============================================================================

ENABLE_AUDITING=true
ENABLE_TESTING=true
ENABLE_DEPLOYMENT=true
ENABLE_EIGENDA_INTEGRATION=true

# ============================================================================
# DEPLOYMENT
# ============================================================================

MAX_RETRIES=3
RETRY_DELAY_MS=5000

# Gas settings
MAX_GAS_PRICE_GWEI=100
MAX_GAS_LIMIT=10000000

# ============================================================================
# END OF ENV FILE
# ============================================================================
```

---

## DEPLOYMENT INSTRUCTIONS

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/yourusername/hyperagent.git
cd hyperagent

# 2. Setup Python environment
python3.10 -m venv venv
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Setup environment
cp .env.example .env
# Edit .env with your credentials

# 5. Initialize database
python scripts/init_db.py

# 6. Run locally
uvicorn hyperagent.api.main:app --reload

# 7. Deploy with Docker
docker-compose up -d

# 8. Check health
curl http://localhost:8000/api/v1/health
```

---

**END OF TECHNICAL DOCUMENTATION**
