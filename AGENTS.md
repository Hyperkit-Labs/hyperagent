# AGENTS.md

This file provides guidance to AI agents (Claude, GPT, etc.) when working with code in this repository.

## What this repo is
HyperAgent is a multi-service "AI-powered smart contract development" system:
- **Python backend (FastAPI)**: Primary API under `/api/v1/*`, workflow execution, orchestration, DB access, WebSocket updates.
- **Frontend (Next.js)**: UI in `frontend/`.
- **x402 verifier service (TypeScript)**: Payment verification wrapper around Thirdweb in `services/x402-verifier/`.

## Skills System (CRITICAL - Apply to ALL Development)

**All development must follow the skills in `skills/` directory.**

### Active Skills Overview

| Skill | Priority | Apply To | Key Patterns |
|-------|----------|----------|--------------|
| senior-architect | CRITICAL | All services | Microservices, event-driven, service registry |
| senior-backend | CRITICAL | Python backend | Async patterns, FastAPI, SQLAlchemy |
| senior-frontend | CRITICAL | Frontend | React patterns, Next.js App Router, TypeScript |
| vercel-react-best-practices | CRITICAL | Frontend | Bundle optimization, performance, Suspense |
| senior-prompt-engineer | HIGH | LLM integration | Multi-model routing, structured outputs |
| mcp-builder | MEDIUM | External services | Tool design, error handling, schemas |
| quality-documentation-manager | MEDIUM | All docs | API docs, changelogs, technical specs |
| web-design-guidelines | MEDIUM | Frontend UI | Accessibility, UX compliance |

### Skill Documentation

**Before making changes, consult:**
1. `SKILLS_README.md` - Master guide and quick start
2. `SKILLS_ACTIVE_NOW.md` - Current status and priorities
3. `SKILLS_QUICK_REFERENCE.md` - Daily development patterns
4. `SKILLS_APPLICATION_PLAN.md` - Comprehensive implementation guide
5. `SKILLS_VISUALIZATION.md` - Architecture and flow diagrams

### Quick Skill Commands

```bash
# Architecture review
python skills/senior-architect/scripts/project_architect.py . --verbose

# API performance test
python skills/senior-backend/scripts/api_load_tester.py --endpoint=/api/v1/workflows

# Bundle analysis
python skills/senior-frontend/scripts/bundle_analyzer.py frontend/

# Prompt optimization
python skills/senior-prompt-engineer/scripts/prompt_optimizer.py hyperagent/core/
```

## Common commands

### Docker Compose (full local stack)
From repo root:
- Start everything:
  - `docker compose up -d --build`
- Follow logs:
  - `docker compose logs -f`
- Stop:
  - `docker compose down`

Makefile shortcuts (if you have `make` installed):
- `make up` (runs `docker-compose up -d`)
- `make logs`
- `make migrate` (runs `alembic upgrade head` inside the backend container)
- `make test` (runs `pytest tests/ -v` inside the backend container)

Note: `Makefile` contains `make up-prod` but this repo does **not** include `docker-compose.prod.yml`.

### Python backend (FastAPI)
Install + run locally (no Docker):
- Create venv:
  - `python -m venv venv`
  - Windows PowerShell: `venv\Scripts\Activate.ps1`
  - macOS/Linux: `source venv/bin/activate`
- Install deps:
  - `pip install -r requirements.txt`
- Apply DB migrations:
  - `alembic upgrade head`
- Run API (dev):
  - `uvicorn hyperagent.api.main:app --reload`

Tests:
- Run all tests:
  - `pytest -v`
- Run a subset:
  - `pytest tests/unit -v`
  - `pytest tests/integration -v`
  - `pytest tests/e2e -v`
- Run a single test file:
  - `pytest tests/unit/test_foo.py -v`
- Run a single test case:
  - `pytest tests/unit/test_foo.py::test_some_behavior -v`
  - `pytest -k "some_behavior" -v`

Lint/format/typecheck:
- `black hyperagent/`
- `isort hyperagent/`
- `mypy hyperagent/`

Pre-commit hooks:
- `pre-commit install`
- `pre-commit run --all-files`

### Frontend (Next.js)
From `frontend/`:
- Install:
  - `npm ci`
- Dev server:
  - `npm run dev`
- Lint / format:
  - `npm run lint`
  - `npm run format`
- Tests:
  - `npm test`
  - Single test file/pattern: `npm test -- <pattern>`

The frontend expects the Python API at `http://localhost:8000` (see `frontend/README.md`).

### x402 verifier service
From `services/x402-verifier/`:
- Install/run:
  - `npm ci`
  - `npm run dev`
- Lint:
  - `npm run lint`

## High-level architecture (big picture)

### Python backend request flow
- **Entry point**: `hyperagent/api/main.py`
  - Registers routers under `/api/v1/*` (docs at `/api/v1/docs`).
  - Websocket updates at `/ws/workflow/{workflow_id}`.
- **Workflow creation**: `hyperagent/api/routes/workflows.py`
  - `POST /api/v1/workflows/generate` creates a DB workflow record and starts an async background task.
  - `wallet_address` is required for workflow creation and for deployment-related stages.
  - Supports modular execution via `selected_tasks` (generation/compilation/audit/testing/deployment).
- **Orchestration**: `hyperagent/core/orchestrator.py` + `hyperagent/architecture/soa.py`
  - Builds a pipeline (based on `selected_tasks`) and runs it through a sequential orchestrator.
  - Services are registered by name in `ServiceRegistry`.
- **Service layer** (examples):
  - `hyperagent/core/services/generation_service.py`: LLM + template retrieval (optionally routed via `MultiModelRouter`), optional “memory” integration.
  - `hyperagent/core/services/audit_service.py`: security auditing (Slither via `SecurityAuditor`).
  - `hyperagent/core/services/deployment_service.py`: handles user-signed deployments and (non-x402) gasless facilitator flows.
- **Events/progress**: `hyperagent/events/event_bus.py`
  - Uses Redis Streams when available with an in-memory fallback.

### Persistence
- Postgres access is via async SQLAlchemy session factory in `hyperagent/db/session.py`.
- Migrations are managed by Alembic under `alembic/`.

### x402 (payments) integration
- Python backend has x402-related routes under `hyperagent/api/routes/x402/`.
- Payment verification is delegated to the TypeScript service in `services/x402-verifier/` (also wired in `docker-compose.yml`).

### TS orchestrator (spec-locked)
- The “DNA blueprint” lives in `docs/hyperagent_dna_blueprint.md`.
- Canonical state spec: `ts/orchestrator/src/core/spec/state.ts`.
- Generated artifacts:
  - `schema/hyperagent_state.schema.json`
  - `hyperagent/core/generated_spec/hyperagent_state.py`
- TS API server: `ts/api/src/server.ts`
  - Routes in `ts/api/src/routes/*` (notably `/api/v2/workflows`).
  - During migration, TS code can call the Python backend via `ts/api/src/clients/pythonBackend.ts`.

## Mandatory Skill Patterns (Apply to All Code)

### Backend Patterns (senior-backend + senior-architect)

**1. Async Parallel Execution (CRITICAL)**
```python
# ❌ BAD: Sequential waterfalls
user = await fetch_user()
posts = await fetch_posts()
comments = await fetch_comments()

# ✅ GOOD: Parallel execution
user, posts, comments = await asyncio.gather(
    fetch_user(),
    fetch_posts(),
    fetch_comments()
)
```

**2. Background Task Pattern**
```python
from fastapi import BackgroundTasks

@router.post("/workflows/generate")
async def create_workflow(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Create workflow record immediately
    workflow_id = await create_workflow_record(db, request)
    
    # Execute in background (non-blocking)
    background_tasks.add_task(execute_workflow_pipeline, workflow_id)
    
    return {"workflow_id": workflow_id, "status": "pending"}
```

**3. User-Signed Transactions (MANDATORY)**
```python
# ❌ NEVER: Server-side private keys
# PRIVATE_KEY = os.getenv("PRIVATE_KEY")  # FORBIDDEN

# ✅ ALWAYS: User wallet signatures
async def deploy_contract(signed_transaction: str, wallet_address: str):
    if not signed_transaction:
        raise WalletError("User signature required")
    
    tx_hash = w3.eth.send_raw_transaction(signed_transaction)
    return await wait_for_receipt(tx_hash)
```

**4. Error Handling**
```python
# ✅ Specific, actionable errors
try:
    result = await deployment_service.process(data)
except WalletError as e:
    raise HTTPException(
        status_code=400,
        detail=f"Wallet signature required: {e.message}"
    )
except NetworkError as e:
    raise HTTPException(
        status_code=502,
        detail=f"Network unavailable: {e.message}. Try again."
    )
```

### Frontend Patterns (senior-frontend + vercel-react-best-practices)

**1. Direct Imports (CRITICAL - No Barrel Files)**
```typescript
// ❌ BAD: Barrel imports (loads entire library)
import { Check, X, Menu } from 'lucide-react'

// ✅ GOOD: Direct imports (loads only what you need)
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
```

**2. Dynamic Imports for Heavy Components**
```typescript
import dynamic from 'next/dynamic'

// ✅ Lazy load heavy components
const MonacoEditor = dynamic(
  () => import('./monaco-editor'),
  { ssr: false }
)

const Charts = dynamic(
  () => import('./charts'),
  { 
    ssr: false,
    loading: () => <ChartsSkeleton />
  }
)
```

**3. Strategic Suspense Boundaries**
```typescript
// ✅ Stream content, show layout immediately
function WorkflowPage({ workflowId }: { workflowId: string }) {
  return (
    <div className="layout">
      <Header /> {/* Renders immediately */}
      <Suspense fallback={<WorkflowSkeleton />}>
        <WorkflowContent workflowId={workflowId} />
      </Suspense>
      <Footer /> {/* Renders immediately */}
    </div>
  )
}
```

**4. Wallet Integration Pattern**
```typescript
import { useActiveWallet, useActiveAccount } from 'thirdweb/react'

// ✅ User-signed transactions
const handleDeploy = async () => {
  if (!wallet || !account) {
    toast.error('Connect wallet first')
    return
  }
  
  // 1. Prepare transaction
  const { transaction } = await prepareDeployment(workflowId)
  
  // 2. Sign with user's wallet
  const signedTx = await wallet.sendTransaction(transaction)
  
  // 3. Complete deployment
  await completeDeployment(workflowId, signedTx.hash, account.address)
}
```

**5. Data Fetching with SWR**
```typescript
import useSWR from 'swr'

// ✅ Auto-deduplication and caching
function WorkflowStatus({ workflowId }: { workflowId: string }) {
  const { data, error } = useSWR(
    `/api/v1/workflows/${workflowId}/status`,
    fetcher,
    { refreshInterval: 2000 } // Poll every 2s
  )
  
  if (error) return <ErrorDisplay error={error} />
  if (!data) return <LoadingSkeleton />
  return <StatusDisplay status={data} />
}
```

### LLM Integration Patterns (senior-prompt-engineer)

**1. Structured Prompts**
```python
# ✅ Clear, structured prompts with examples
GENERATION_PROMPT = """
You are a Solidity smart contract generator.

# Task
Generate a {contract_type} contract for {network}.

# Requirements
- Use OpenZeppelin libraries
- Include Natspec comments
- Optimize for gas efficiency
- Follow security best practices

# Example Input
"ERC20 token with 18 decimals, initial supply 1000000"

# Example Output
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {{
    constructor() ERC20("MyToken", "MTK") {{
        _mint(msg.sender, 1000000 * 10**18);
    }}
}}
```

# Your Turn
Generate contract for: {user_prompt}
"""
```

**2. Multi-Model Routing with Fallback**
```python
class MultiModelRouter:
    MODEL_CONFIG = {
        "solidity_codegen": {
            "primary": "claude-opus-4.5",
            "fallback": "llama-3.1-405b",
            "timeout": 30,
            "temperature": 0.3
        }
    }
    
    async def route_task(self, task: str, context: dict):
        config = self.MODEL_CONFIG[task]
        try:
            return await self.call_model(
                config["primary"], 
                task, 
                context,
                timeout=config["timeout"],
                temperature=config["temperature"]
            )
        except TimeoutError:
            logger.warning(f"Primary model timeout, using fallback")
            return await self.call_model(
                config["fallback"],
                task,
                context
            )
```

**3. Structured Outputs with Pydantic**
```python
from pydantic import BaseModel, Field

class ContractGenerationOutput(BaseModel):
    contract_code: str = Field(..., description="Complete Solidity code")
    contract_name: str = Field(..., description="Contract name")
    compiler_version: str = Field(..., description="Solidity version")
    dependencies: list[str] = Field(default_factory=list)
    
# Use in LLM call
output = await llm.generate(
    prompt=prompt,
    response_format=ContractGenerationOutput
)
```

### Architecture Patterns (senior-architect)

**1. Service Registry Pattern**
```python
# ✅ Centralized service registration
class ServiceRegistry:
    _services: Dict[str, Any] = {}
    
    @classmethod
    def register(cls, name: str, service: Any):
        cls._services[name] = service
    
    @classmethod
    def get(cls, name: str) -> Any:
        if name not in cls._services:
            raise ServiceNotFoundError(f"Service {name} not registered")
        return cls._services[name]

# Register services at startup
ServiceRegistry.register("generation", GenerationService())
ServiceRegistry.register("audit", AuditService())
ServiceRegistry.register("deployment", DeploymentService())
```

**2. Event-Driven Updates**
```python
# ✅ Emit events for progress tracking
class EventBus:
    async def emit(self, event_type: str, data: dict):
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        # Publish to Redis Streams
        await self.redis.xadd("workflow_events", event)
        
        # Send via WebSocket
        await self.ws_manager.broadcast(event)
```

**3. Configuration-Driven Design**
```yaml
# config/networks.yaml
networks:
  mantle_testnet:
    name: "Mantle Sepolia"
    chain_id: 5003
    rpc_urls:
      - "https://rpc.sepolia.mantle.xyz"
    explorer: "https://sepolia.mantlescan.xyz"
    x402_enabled: true
```

```python
# Load config in services
config = load_yaml("config/networks.yaml")
network_config = config["networks"]["mantle_testnet"]
```

### Security Patterns (senior-backend + mcp-builder)

**1. Input Validation**
```python
from pydantic import BaseModel, validator

class WorkflowCreateRequest(BaseModel):
    prompt: str
    network: str
    wallet_address: str
    
    @validator('wallet_address')
    def validate_wallet(cls, v):
        if not v.startswith('0x') or len(v) != 42:
            raise ValueError('Invalid Ethereum address')
        return v.lower()
    
    @validator('network')
    def validate_network(cls, v):
        allowed = ['mantle_testnet', 'ethereum_mainnet']
        if v not in allowed:
            raise ValueError(f'Network must be one of {allowed}')
        return v
```

**2. Rate Limiting**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/workflows/generate")
@limiter.limit("10/minute")
async def create_workflow(request: Request):
    # Limited to 10 requests per minute per IP
    pass
```

### Documentation Patterns (quality-documentation-manager)

**1. API Documentation**
```python
@router.post(
    "/workflows/generate",
    response_model=WorkflowResponse,
    summary="Generate smart contract",
    description="""
    Creates a new workflow to generate, audit, test, and deploy a smart contract.
    
    The workflow executes asynchronously. Use the WebSocket endpoint or polling
    to track progress.
    """,
    responses={
        200: {"description": "Workflow created successfully"},
        400: {"description": "Invalid input"},
        429: {"description": "Rate limit exceeded"}
    }
)
async def create_workflow(request: WorkflowCreateRequest):
    pass
```

**2. Code Comments**
```python
def calculate_gas_estimate(bytecode: str, network: str) -> int:
    """
    Calculate gas estimate for contract deployment.
    
    Args:
        bytecode: Compiled contract bytecode (hex string)
        network: Target network identifier
        
    Returns:
        Estimated gas units required
        
    Raises:
        NetworkError: If RPC provider is unavailable
        ValueError: If bytecode is invalid
        
    Note:
        Estimates include 20% buffer for safety margin.
    """
    pass
```

## Code Quality Standards

### Pre-Commit Checklist
- [ ] Applied relevant skill patterns (see sections above)
- [ ] No barrel imports in frontend (`import from 'lib'` ❌)
- [ ] Async operations use `asyncio.gather()` where possible
- [ ] User wallet signatures required (no server private keys)
- [ ] Error messages are specific and actionable
- [ ] API endpoints documented with examples
- [ ] Types defined (TypeScript strict, Python mypy)
- [ ] Tests added for new functionality

### Performance Targets
- **API Response:** p95 < 2 seconds
- **Bundle Size:** < 300KB (gzipped)
- **Database Queries:** < 100ms per query
- **LLM Generation:** < 15 seconds average

### File Structure Rules
- Backend services: `hyperagent/core/services/`
- API routes: `hyperagent/api/routes/`
- Frontend components: `frontend/components/`
- Frontend pages: `frontend/app/`
- Configuration: `config/*.yaml`
- Documentation: `docs/`

## Where to look for deeper design docs
- `docs/README.md` is an index into architecture/planning documents.
- Additional refactor/blueprint materials live under `Hyperagent Refactor/Hyperagent Plan/` (including `BLUEPRINT_PLAYBOOK_COMBINED.md`).

## Skill Reference Files (Read Before Implementing)

### Architecture & Design
- `skills/senior-architect/references/architecture_patterns.md`
- `skills/senior-architect/references/system_design_workflows.md`
- `skills/senior-architect/references/tech_decision_guide.md`

### Backend Development
- `skills/senior-backend/references/api_design_patterns.md`
- `skills/senior-backend/references/database_optimization_guide.md`
- `skills/senior-backend/references/backend_security_practices.md`

### Frontend Development
- `skills/senior-frontend/references/react_patterns.md`
- `skills/senior-frontend/references/nextjs_optimization_guide.md`
- `skills/senior-frontend/references/frontend_best_practices.md`
- `skills/vercel-react-best-practices/AGENTS.md` (57 optimization rules)

### LLM Integration
- `skills/senior-prompt-engineer/references/prompt_engineering_patterns.md`
- `skills/senior-prompt-engineer/references/llm_evaluation_frameworks.md`
- `skills/senior-prompt-engineer/references/agentic_system_design.md`

### External Services
- `skills/mcp-builder/reference/mcp_best_practices.md`
- `skills/mcp-builder/reference/python_mcp_server.md`
- `skills/mcp-builder/reference/node_mcp_server.md`

## Quick Skill Application

**When adding a new API endpoint:**
1. Read `skills/senior-backend/references/api_design_patterns.md`
2. Use async patterns from examples above
3. Add input validation with Pydantic
4. Document with OpenAPI annotations
5. Test with `python skills/senior-backend/scripts/api_load_tester.py`

**When adding a new React component:**
1. Read `skills/senior-frontend/references/react_patterns.md`
2. Use direct imports (no barrel files)
3. Add Suspense boundaries for async content
4. Optimize with memo/useMemo where needed
5. Test bundle impact with `python skills/senior-frontend/scripts/bundle_analyzer.py`

**When integrating an LLM:**
1. Read `skills/senior-prompt-engineer/references/prompt_engineering_patterns.md`
2. Structure prompts with clear instructions and examples
3. Define output schema with Pydantic
4. Implement multi-model routing with fallback
5. Test with `python skills/senior-prompt-engineer/scripts/prompt_optimizer.py`

**When deploying contracts:**
1. NEVER use server-side private keys
2. Always require user wallet signatures
3. Use prepare-deploy-complete pattern
4. Emit progress events via WebSocket
5. Handle network errors gracefully
