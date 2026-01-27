# Hyperkit Interactive CLI + x402 System Design (v4.0)
## Network-Agnostic Smart Contract Builder with Native Billing

**Date:** January 11, 2026  
**Version:** 4.0 (CLI-First, x402-Native)  
**Status:** Ready for Hackathon + Production Build  
**Supported Networks:** Mantle, Avalanche, BNB, Solana, Sui, ProtocolLabs Genesis  
**Architecture:** Chain-Agnostic Core + Pluggable Adapters + Native x402 Billing

---

## EXECUTIVE SUMMARY

**Hyperkit CLI v4.0** is a **production-grade interactive command-line tool** for generating, auditing, testing, and deploying smart contracts across 6 major blockchain networks. Unlike v3.0 (API-centric, post-hoc billing), v4.0 **bakes x402 billing into the core orchestration** and prioritizes **CLI-first UX** with **existing ecosystem tooling** (Mantle SDK, Avalanche integrations, thirdweb x402, Pinata IPFS, EigenDA).

### Key Changes from v3.0

| Aspect | v3.0 | v4.0 |
|--------|------|------|
| **Primary Interface** | REST API | Interactive CLI |
| **Billing** | Post-hoc x402 settlement | Real-time x402 in build loop |
| **Networks** | 8 (includes deprecated ones) | 6 (Mantle, Avalanche, BNB, Solana, Sui, PL) |
| **External Tools** | Generic RPC, LLM APIs | Mantle SDK, Avalanche integrations, thirdweb, Pinata |
| **TEE Auditing** | Removed | Removed (use Slither + semantic only) |
| **Data Availability** | EigenDA (future) | EigenDA-ready (not required MVP) |
| **Deployment Target** | Hackathon MVP only | Mantle Global Hackathon + production |

### What's New

✅ **Interactive CLI** - User-friendly terminal flow with prompts, validation, real-time feedback  
✅ **Embedded x402 Logic** - Every build checks credits → deducts costs → handles 402 errors → suggests top-up  
✅ **Mantle SDK Integration** - Uses native Mantle SDK for chain detection, deployment, verification  
✅ **Avalanche Ecosystem Tools** - Leverage existing Avalanche integrations for C-Chain support  
✅ **thirdweb x402 Native** - Direct integration with thirdweb's x402 payment infrastructure  
✅ **Pinata + IPFS** - Store contract bytecode, ABI, metadata on IPFS for permanence  
✅ **Chunked LLM Optimization** - Break large contracts into chunks for better model handling  
✅ **System Design Focus** - Scalability, reliability, fault tolerance, disaster recovery  

---

## PART 1: SYSTEM ARCHITECTURE (v4.0)

### 1.1 Three-Layer Architecture (Refined)

```
┌──────────────────────────────────────────────────────────┐
│ LAYER 1: CHAIN-AGNOSTIC CORE (50K LOC)                   │
│ ─────────────────────────────────────────────────────────│
│ • ROMA Planner (Intent → Build steps)                    │
│ • Firecrawl RAG (Live doc context)                       │
│ • Multi-Model Router (Claude/Llama/Gemini)               │
│ • Chunked LLMO (Break contracts for efficiency)          │
│ • x402 Ledger Manager (Mantle canonical contract)        │
│ • 7-Layer Security + ERC-1066 Audit                      │
│ • IaC & Monitoring (Terraform, Prometheus)               │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│ LAYER 2: ADAPTER INTERFACES (15K LOC)                    │
│ ─────────────────────────────────────────────────────────│
│ • ILanguageAdapter (generate_code)                       │
│ • IDeploymentAdapter (deploy_to_chain)                   │
│ • IRPCAdapter (call_rpc with failover)                   │
│ • IMonitoringAdapter (watch_contract)                    │
│ • IStorageAdapter (IPFS via Pinata)                      │
│ • IBillingAdapter (x402 per-chain)                       │
└──────────────────────────────────────────────────────────┘
         ↓                ↓                ↓              ↓
┌────────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐
│ EVM IMPL       │ │ SOLANA IMPL  │ │ SUI IMPL │ │ PL IMPL  │
│ (3K LOC/chain) │ │ (2K LOC)     │ │ (2K LOC) │ │ (2K LOC) │
├────────────────┤ ├──────────────┤ ├──────────┤ ├──────────┤
│ Mantle SDK     │ │ Anchor CLI   │ │ Move CLI │ │ FileCoin │
│ Avalanche      │ │ Solana RPC   │ │ Sui RPC  │ │ Arweave  │
│ BNB Chain      │ │ Magic Eden   │ │ Sui Dev  │ │ IPFS     │
│ Foundry        │ │ Quick Node   │ │ Chainbase│ │ Protocol │
└────────────────┘ └──────────────┘ └──────────┘ └──────────┘
```

### 1.2 Build Lifecycle with x402 (90 seconds)

```
┌─────────────────────────────────────────────────────────────┐
│ HYPERKIT CLI: 'hk build --chain mantle --prompt "ERC-20"'   │
└─────────────────────────────────────────────────────────────┘
                           ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 1: Wallet Connect & x402 Check (3s)         │
    │ ├─ Detect wallet (ethers.js, thirdweb)           │
    │ ├─ Query Mantle x402 contract: balance(user)     │
    │ ├─ Estimate build cost (ROMA + model + chain)    │
    │ └─ If balance < cost → 402 flow (top-up prompt)  │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 2: Intent Validation (2s)                    │
    │ ├─ Parse prompt, detect jailbreak (DataSentinel)  │
    │ ├─ Estimate tokens & cost breakdown               │
    │ └─ Show summary: "ERC-20 on Mantle: 5 credits"   │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 3: ROMA Planning (8s)                        │
    │ ├─ Decompose: design → code → audit → deploy      │
    │ ├─ Cache hit? (60% → instant)                     │
    │ └─ Return build plan JSON                         │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 4: Firecrawl RAG (5s)                        │
    │ ├─ Fetch Mantle SDK docs, Avalanche integrations  │
    │ ├─ Vector search for relevant patterns            │
    │ └─ Inject 2KB context into model prompt           │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 5: LLM Code Generation (15s)                 │
    │ ├─ Route to Claude/Llama/Gemini (cost-optimized)  │
    │ ├─ Chunk large contracts (LLMO optimization)      │
    │ ├─ Generate w/ natspec, event emission, access    │
    │ └─ CLI shows: "Generated 185 lines of Solidity"   │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 6: Static Audit (10s)                        │
    │ ├─ Run Slither (EVM) / Clippy (Solana) / Analyzer │
    │ ├─ Return findings (HIGH/MED/LOW)                 │
    │ └─ If HIGH: block deployment, ask to regenerate   │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 7: Semantic Audit (8s)                       │
    │ ├─ Fine-tuned model checks for patterns           │
    │ ├─ Return ERC-1066 status code (0x01 = OK)        │
    │ └─ CLI: "✅ Audit passed"                         │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 8: Compile (5s)                              │
    │ ├─ Foundry compile → bytecode + ABI + warnings    │
    │ ├─ Store on IPFS via Pinata                       │
    │ └─ Pinata IPFS hash: QmXxxx...                    │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 9: Testnet Dry-Run (20s)                     │
    │ ├─ Deploy to Mantle testnet via SDK               │
    │ ├─ Verify contract + constructor args             │
    │ └─ CLI: "✅ Testnet OK at 0xtest..."              │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 10: x402 Debit (2s)                          │
    │ ├─ Call Mantle x402 contract: debit(user, cost)   │
    │ ├─ Wait 1 confirmation                            │
    │ └─ CLI: "💳 Deducted 5 credits from your account" │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 11: Mainnet Deploy (20s)                     │
    │ ├─ Deploy to production chain                     │
    │ ├─ Verify source on block explorer                │
    │ └─ CLI: "✅ LIVE at 0x[address]"                  │
    └─────────────────────┬───────────────────────────┘
                          ↓
    ┌───────────────────────────────────────────────────┐
    │ STEP 12: Monitor & Archive (instant)              │
    │ ├─ Subscribe to events (Moralis/Dune)             │
    │ ├─ Archive contract details to IPFS/Pinata        │
    │ └─ CLI: "📊 Monitoring live"                      │
    └──────────────────────────────────────────────────┘

TOTAL: 88-95 seconds ✅
```

### 1.3 x402 Native Billing Integration

**Key Insight:** x402 is **not optional** in v4.0 — it's baked into every step.

```python
# Core x402 flow in CLI

class HyperkitCLI:
    def __init__(self):
        self.x402_contract = load_mantle_x402_contract()
        self.user_account = connect_wallet()
    
    async def build(self, prompt: str, chain: str):
        """Main build loop with x402 at each critical juncture"""
        
        # 1. Check balance
        balance = await self.x402_contract.balanceOf(self.user_account)
        estimated_cost = estimate_cost(prompt, chain)
        
        if balance < estimated_cost:
            print(f"❌ Insufficient credits: {balance} < {estimated_cost}")
            print(f"💳 Top up here: hk topup --amount 10")
            return
        
        # 2-5. ROMA → RAG → LLM → Audit (no x402 calls yet, async)
        code = await generate_code(prompt, chain)
        audit_findings = await audit(code, chain)
        
        if audit_findings.has_critical:
            print(f"❌ Critical audit findings. Regenerate? (y/n)")
            return
        
        # 6. Compile + testnet
        bytecode, abi = await compile(code, chain)
        testnet_addr = await deploy_testnet(bytecode, abi, chain)
        
        # 7. x402 DEBIT (critical transaction)
        tx_hash = await self.x402_contract.debit(
            user=self.user_account,
            amount=estimated_cost,
            build_metadata={
                "chain": chain,
                "contract_hash": hash(code),
                "model_used": "claude-4.5",
                "timestamp": now()
            }
        )
        print(f"💳 Deducted {estimated_cost} credits (tx: {tx_hash})")
        
        # 8. Mainnet deploy (now we're committed)
        mainnet_addr = await deploy_mainnet(bytecode, abi, chain)
        
        # 9. Archive + monitoring
        ipfs_hash = await archive_to_pinata(bytecode, abi, code)
        await start_monitoring(mainnet_addr, chain)
        
        return {
            "contract_address": mainnet_addr,
            "testnet_address": testnet_addr,
            "ipfs_hash": ipfs_hash,
            "credits_used": estimated_cost,
            "remaining_balance": balance - estimated_cost
        }
```

---

## PART 2: SUPPORTED NETWORKS (SIMPLIFIED)

### 2.1 Network Matrix

```
Chain          | L1/L2 | Tech         | Compiler    | RPC Provider    | Storage   | Status
───────────────┼───────┼──────────────┼─────────────┼─────────────────┼───────────┼───────
Mantle         | L2    | EVM (OP)     | Foundry     | Mantle SDK      | Pinata    | ✅ MVP
Avalanche C    | L1    | EVM          | Foundry     | Avalanche API   | Pinata    | ✅ MVP
BNB Chain      | L1    | EVM          | Foundry     | BSC RPC         | Pinata    | ✅ MVP
Solana         | L1    | Rust/Anchor  | Anchor CLI  | QuickNode       | Arweave   | ✅ Phase 2
Sui            | L1    | Move         | Move CLI    | Sui RPC         | IPFS      | ✅ Phase 2
Protocol Labs  | Various | Multiple   | Protocol    | PL RPC          | IPFS/Arg  | ✅ Phase 3
```

### 2.2 Network-Specific Adapters

**EVM Stack (Mantle, Avalanche, BNB):**
```python
class EVMAdapter:
    """Shared for all EVM networks"""
    compiler = Foundry()
    
    async def deploy(self, bytecode, abi, chain, constructor_args):
        client = get_rpc_client(chain)  # Mantle SDK, Avalanche API, BSC RPC
        account = get_account()
        
        tx = await client.eth_sendTransaction({
            'to': deployer_address,
            'data': bytecode,
            'value': 0,
            'gas': estimate_gas(bytecode)
        })
        
        receipt = await client.eth_getTransactionReceipt(tx)
        return receipt.contractAddress
```

**Solana:**
```python
class SolanaAdapter:
    compiler = AnchorCLI()
    
    async def deploy(self, bytecode, abi, chain, constructor_args):
        # Use Solana CLI or Anchor
        program_id = await deploy_program(bytecode)
        return program_id
```

**Sui:**
```python
class SuiAdapter:
    compiler = MoveCLI()
    
    async def deploy(self, bytecode, abi, chain, constructor_args):
        # Use Sui SDK
        tx = SuiTxBuilder().publish_package(bytecode)
        result = await client.execute_transaction(tx)
        return result.published_objects[0]
```

---

## PART 3: CLI INTERFACE & UX

### 3.1 CLI Command Structure

```bash
# Interactive mode (default)
$ hk
> Welcome to Hyperkit CLI v4.0
> Connected wallet: 0x123...
> Balance: 42 credits
> 
> Commands: build | topup | status | list | deploy | info | exit
> hk> build

# Non-interactive mode
$ hk build --prompt "ERC-20 token" --chain mantle

# Status check
$ hk status

# Top up x402 credits
$ hk topup --amount 10 --token USDC

# List previous builds
$ hk list --chain mantle --limit 10

# Re-deploy an archived contract
$ hk deploy --ipfs-hash QmXxxx... --chain avalanche

# Get network info
$ hk info --chain solana
```

### 3.2 Interactive Build Flow

```
$ hk build

┌─────────────────────────────────────────────┐
│ HYPERKIT v4.0 - Smart Contract Builder      │
│ Connected: 0x123... | Balance: 42 credits   │
└─────────────────────────────────────────────┘

1️⃣  What would you like to build?
   > ERC-20 token

2️⃣  Which network?
   [1] Mantle (OP Stack L2) [recommended]
   [2] Avalanche C-Chain
   [3] BNB Chain
   [4] Solana
   [5] Sui
   > 1

3️⃣  Specify requirements:
   Token name: > MyToken
   Symbol: > MYT
   Supply: > 1000000
   Features: > minting, burning, pausing
   
4️⃣  Advanced options? (y/n) > n

┌─────────────────────────────────────────────┐
│ Summary:                                     │
│ ├─ Network: Mantle                          │
│ ├─ Type: ERC-20 with minting, burning, pause│
│ ├─ Estimated cost: 5 credits ($0.05)        │
│ ├─ Your balance: 42 credits                 │
│ └─ Proceed? (y/n) > y                       │
└─────────────────────────────────────────────┘

[⏳ 2s]  Validating prompt...
[⏳ 8s]  Planning build steps (ROMA)...
[⏳ 5s]  Fetching latest Mantle/OpenZeppelin docs...
[⏳ 15s] Generating Solidity code...
[⏳ 10s] Running Slither audit...
[⏳ 8s]  Running semantic audit...
[⏳ 5s]  Compiling with Foundry...
[⏳ 20s] Deploying to Mantle testnet...
[⏳ 2s]  Processing x402 payment...
[⏳ 20s] Deploying to Mantle mainnet...

✅ SUCCESS!

Contract Details:
├─ Address: 0x1234...
├─ Name: MyToken (MYT)
├─ Supply: 1,000,000
├─ Features: Minting ✅, Burning ✅, Pausing ✅
├─ Audit: PASSED (0x01)
├─ Source: https://etherscan.io/address/0x1234...
│
IPFS Archive:
├─ Bytecode: QmXxxx...
├─ ABI: QmYyyy...
└─ Source: QmZzzz...

Monitoring:
├─ Events: Watching (Moralis webhook active)
├─ TVL: $0 (no liquidity yet)
└─ Gas Used: 125,432 gwei

Credits Used: 5 | Remaining: 37

Next steps:
1. Verify on block explorer: https://...
2. Add liquidity (if DEX)
3. Share IPFS hash: QmXxxx...
4. View in dashboard: https://hyperkit.xyz/contracts/0x1234...

┌─────────────────────────────────────────────┐
│ Would you like to:                          │
│ [1] Build another contract                  │
│ [2] Top up credits                          │
│ [3] Deploy this to another chain            │
│ [4] View dashboard                          │
│ [5] Exit                                    │
│ > 1                                         │
└─────────────────────────────────────────────┘
```

---

## PART 4: CHUNKED LLM OPTIMIZATION (LLMO)

**Problem:** Large contracts (>2000 lines) confuse LLMs, causing hallucinations and truncation.

**Solution:** Break contracts into chunks, generate separately, assemble intelligently.

```python
class ChunkedLLMOptimizer:
    """Optimize LLM quality by chunking contracts"""
    
    async def generate_chunked(self, spec: str, chain: str) -> str:
        """Generate large contracts in chunks for better quality"""
        
        # 1. Analyze spec → identify components
        components = parse_spec(spec)
        # {"name": "DeFi Protocol", "components": ["Token", "Vault", "Oracle"]}
        
        # 2. Generate each component separately (smaller context window)
        chunks = []
        for component in components:
            chunk_spec = f"Generate only the {component} contract. Assume other contracts exist."
            chunk_code = await self.router.generate(
                spec=chunk_spec,
                chain=chain,
                max_tokens=1500  # Keep individual chunks small
            )
            chunks.append({
                "name": component,
                "code": chunk_code,
                "size": len(chunk_code)
            })
        
        # 3. Assemble chunks with proper interface handling
        final_code = self.assemble_chunks(chunks, spec)
        
        # 4. Validate assembly
        await validate_interfaces(final_code)
        
        return final_code
    
    def assemble_chunks(self, chunks: List[Dict], spec: str) -> str:
        """Intelligently assemble chunks into a single contract"""
        
        # Extract imports from each chunk
        imports = set()
        for chunk in chunks:
            imports.update(extract_imports(chunk["code"]))
        
        # Combine code with interface definitions
        assembled = "\n".join([
            "// SPDX-License-Identifier: MIT",
            f"pragma solidity {detect_version(spec)};",
            "\n".join(imports),
            "\n// ========== ASSEMBLED HYPERKIT CONTRACT ==========\n",
            "\n\n".join([c["code"] for c in chunks]),
            "\n// ========== END HYPERKIT CONTRACT =========="
        ])
        
        return assembled
```

**Benefits:**
- 📈 Model sees smaller context → better quality
- ⚡ Parallel generation (chunks in parallel)
- 🔍 Each component independently verified
- 📊 Better tracking of which model/cost for each chunk

---

## PART 5: INFRASTRUCTURE & DEPLOYMENT

### 5.1 Infrastructure as Code (Terraform + Docker)

```hcl
# main.tf - Infrastructure definition

terraform {
  required_providers {
    aws = "~> 5.0"
    docker = "~> 3.0"
  }
}

# ECS Cluster for Hyperkit services
resource "aws_ecs_cluster" "hyperkit" {
  name = "hyperkit-prod"
}

# FastAPI backend service
resource "aws_ecs_task_definition" "hyperkit_api" {
  family = "hyperkit-api"
  
  container_definitions = jsonencode([{
    name  = "hyperkit-api"
    image = "hyperkit/api:latest"
    portMappings = [{
      containerPort = 8000
      hostPort      = 8000
      protocol      = "tcp"
    }]
    memory = 2048
    cpu    = 1024
    
    environment = [
      { name = "MANTLE_RPC_URL", value = var.mantle_rpc },
      { name = "CLAUDE_API_KEY", value = var.claude_key },
      { name = "PINATA_JWT", value = var.pinata_jwt }
    ]
  }])
}

# CLI service (runs builds)
resource "aws_ecs_task_definition" "hyperkit_cli_worker" {
  family = "hyperkit-cli-worker"
  
  container_definitions = jsonencode([{
    name  = "hyperkit-worker"
    image = "hyperkit/cli:latest"
    memory = 4096
    cpu    = 2048
    
    volumes = [{
      name = "hyperkit-data"
    }]
  }])
}

# RDS PostgreSQL (build history, x402 ledger)
resource "aws_db_instance" "hyperkit_db" {
  identifier     = "hyperkit-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t4g.medium"
  allocated_storage = 100
  
  db_name  = "hyperkit"
  username = "hyperkit_admin"
  password = random_password.db_password.result
  
  multi_az = true
  backup_retention_period = 30
  
  skip_final_snapshot = false
  final_snapshot_identifier = "hyperkit-final-snapshot-${timestamp()}"
}

# ElastiCache Redis (caching ROMA plans, RAG context)
resource "aws_elasticache_cluster" "hyperkit_cache" {
  cluster_id           = "hyperkit-cache"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.t4g.small"
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
  port                 = 6379
  
  automatic_failover_enabled = true
}

output "api_endpoint" {
  value = aws_ecs_task_definition.hyperkit_api.arn
}

output "db_endpoint" {
  value = aws_db_instance.hyperkit_db.endpoint
}
```

```dockerfile
# Dockerfile for Hyperkit CLI

FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Foundry (for EVM compilation)
RUN curl -L https://foundry.paradigm.xyz | bash
RUN /root/.foundry/bin/foundryup

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Sui CLI
RUN cargo install --locked sui

# Copy code
COPY . .

# Expose ports
EXPOSE 8000 3000

# Run CLI
CMD ["python", "-m", "hyperkit.cli"]
```

### 5.2 Monitoring & Observability

```yaml
# prometheus.yml - Metrics collection

global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'hyperkit-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
  
  - job_name: 'hyperkit-cli-worker'
    static_configs:
      - targets: ['localhost:9090']

# Alert rules
rule_files:
  - 'alerts.yml'

# Grafana dashboards
# URL: http://grafana:3000
# Metrics:
#   - build_success_rate (%)
#   - build_latency (seconds)
#   - x402_credits_burned (total)
#   - audit_findings (by severity)
#   - rpc_failover_events (count)
```

### 5.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml

name: Deploy Hyperkit

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run tests
        run: |
          python -m pytest tests/ -cov --cov-threshold=80
      
      - name: Security scan (Bandit)
        run: bandit -r hyperkit/ -f json -o bandit-report.json
      
      - name: Lint (Ruff)
        run: ruff check hyperkit/

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: |
          docker build -t hyperkit/api:${{ github.sha }} ./api
          docker build -t hyperkit/cli:${{ github.sha }} ./cli
      
      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REPO
          docker push hyperkit/api:${{ github.sha }}
          docker push hyperkit/cli:${{ github.sha }}

  deploy:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster hyperkit-prod \
            --service hyperkit-api \
            --force-new-deployment
      
      - name: Smoke tests
        run: |
          curl -X POST https://api.hyperkit.xyz/api/health
          hk status
```

---

## PART 6: x402 LEDGER SCHEMA

### 6.1 PostgreSQL Tables

```sql
-- x402 Ledger (canonical source of truth on Mantle, replicated locally)
CREATE TABLE x402_ledger (
    id UUID PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    amount_credits INT NOT NULL,
    operation_type VARCHAR(20),  -- "debit", "credit", "top_up"
    build_hash VARCHAR(66),
    timestamp TIMESTAMP DEFAULT NOW(),
    tx_hash VARCHAR(66),  -- Mantle x402 tx
    status VARCHAR(20)   -- "pending", "confirmed", "failed"
);

-- Build History
CREATE TABLE builds (
    id UUID PRIMARY KEY,
    user_id VARCHAR(42) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    status VARCHAR(20),  -- "success", "failed", "auditing"
    contract_address VARCHAR(42),
    ipfs_hash VARCHAR(60),
    cost_credits INT,
    latency_ms INT,
    audit_findings JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- x402 Top-up History
CREATE TABLE topups (
    id UUID PRIMARY KEY,
    user_id VARCHAR(42) NOT NULL,
    amount_credits INT NOT NULL,
    amount_usd DECIMAL(10,2),
    tx_hash VARCHAR(66),
    source VARCHAR(20),  -- "card", "x402", "grant"
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_user_builds ON builds(user_id, created_at DESC);
CREATE INDEX idx_chain_builds ON builds(chain, created_at DESC);
CREATE INDEX idx_x402_ledger ON x402_ledger(user_address, timestamp DESC);
```

---

## PART 7: DEPLOYMENT ROADMAP (MANTLE HACKATHON)

### Phase 1: MVP (Weeks 1-2) - Hackathon Submission

**Week 1:**
- [ ] CLI skeleton (Click framework)
- [ ] Wallet connection (ethers.js)
- [ ] Mantle SDK integration
- [ ] ROMA planner MVP
- [ ] Solidity generation (Claude)
- [ ] x402 contract calls (mock)

**Week 2:**
- [ ] Foundry deployment
- [ ] EVM adapter (Mantle-specific)
- [ ] Slither audit
- [ ] x402 real transaction handling
- [ ] Testnet → Mainnet flow
- [ ] Basic monitoring (Moralis)

**Deliverable:** CLI that builds ERC-20 on Mantle in <120s with real x402 billing

### Phase 2: Expand to Avalanche + BNB (Week 3-4)

- [ ] Avalanche C-Chain adapter
- [ ] BNB Chain adapter
- [ ] Multi-chain RPC failover
- [ ] Unified CLI experience across chains

### Phase 3: Solana + Sui (Weeks 5-6)

- [ ] Anchor code generation (Llama 3.1)
- [ ] Solana deployment via CLI
- [ ] Move generation (Gemini)
- [ ] Sui deployment

### Phase 4: Production Hardening (Weeks 7-8)

- [ ] Security audit
- [ ] Load testing
- [ ] Public beta launch
- [ ] Documentation

---

## PART 8: KEY TECHNOLOGIES & INTEGRATIONS

### 8.1 Integrated Tooling (No Custom Code Needed)

| Component | Technology | Purpose | Cost |
|-----------|-----------|---------|------|
| **Network:** Mantle | Mantle SDK + Viem | EVM deployment | Free |
| **Network:** Avalanche | Avalanche integrations | C-Chain support | Free |
| **Network:** BNB | thirdweb + RPC | BSC deployment | Free |
| **Code Gen** | Claude API | LLM generation | $$ |
| **Storage** | Pinata IPFS | Contract bytecode | $$ |
| **Audit** | Slither | Static analysis | Free |
| **Billing** | thirdweb x402 | Payment processing | Native |
| **Monitoring** | Moralis webhooks | Event tracking | Free tier |
| **CLI** | Click (Python) | CLI framework | Free |
| **IaC** | Terraform | Infrastructure | Free |
| **CI/CD** | GitHub Actions | Deployment | Free |

### 8.2 x402 Integration (thirdweb)

```python
from thirdweb import ThirdwebSDK
from thirdweb.types import ContractDeployTransaction

# Initialize thirdweb SDK
sdk = ThirdwebSDK.from_private_key(
    private_key=os.getenv("DEPLOYER_PRIVATE_KEY"),
    chain_id=5000  # Mantle
)

# Get x402 contract instance
x402_contract = sdk.get_contract(
    address="0x[MANTLE_X402_ADDRESS]",
    abi=X402_ABI  # Standard x402 interface
)

# Check balance
user_balance = x402_contract.call(
    "balanceOf",
    [user_address]
)

# Debit after successful build
tx_hash = x402_contract.call(
    "debit",
    [user_address, credits_cost]
)

print(f"x402 debit confirmed: {tx_hash}")
```

---

## PART 9: SUCCESS METRICS (HACKATHON)

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Build latency** | <120 seconds (p99) | Competitive with manual |
| **Success rate** | 90%+ | Production-ready |
| **Supported chains** | 3 (Mantle, Avalanche, BNB) | Hackathon scope |
| **x402 integration** | Real transactions | Not mock payments |
| **CLI UX** | Interactive + guided | Easy for new users |
| **Code quality** | 80%+ test coverage | Production standard |

---

## CONCLUSION

**Hyperkit CLI v4.0** bridges Web3 infrastructure and AI code generation by:

1. ✅ Making CLI the primary interface (not API)
2. ✅ Baking x402 billing into the core flow (not post-hoc)
3. ✅ Focusing on real, viable networks only (Mantle, Avalanche, BNB, Solana, Sui)
4. ✅ Leveraging existing tools (Mantle SDK, thirdweb, Pinata) instead of inventing
5. ✅ Designing for scale from day 1 (Terraform, Prometheus, chunked LLMO)

**Status:** Ready for Mantle Global Hackathon 2025 submission.

