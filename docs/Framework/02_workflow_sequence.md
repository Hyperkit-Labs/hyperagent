# Complete Workflow Sequence Diagram

## Diagram

```mermaid
sequenceDiagram
    participant User
    participant FastAPI as FastAPI REST API
    participant WC as WorkflowCoordinator
    participant EB as EventBus/Redis
    participant GA as GenerationAgent
    participant RAG as RAG System
    participant LLM as LLM Provider<br/>(Gemini/OpenAI)
    participant CS as CompilationService
    participant AA as AuditAgent
    participant TA as TestingAgent
    participant DA as DeploymentAgent
    participant BC as Blockchain Network
    participant PG as PostgreSQL Database
    participant WS as WebSocket Connection

    User->>FastAPI: POST /api/v1/workflows/generate<br/>NLP: "Create ERC20 token"
    FastAPI->>WC: execute_workflow(workflow_id, nlp_input, network)
    WC->>EB: publish(WORKFLOW_CREATED)
    WC->>EB: publish(WORKFLOW_STARTED)
    
    Note over WC,GA: Stage 1: Generation
    WC->>GA: process(nlp_description)
    GA->>EB: publish(GENERATION_STARTED)
    GA->>RAG: retrieve_templates(user_query)
    RAG->>PG: Vector similarity search<br/>pgvector cosine similarity
    PG-->>RAG: Top 3 templates
    RAG-->>GA: Retrieved templates with context
    GA->>LLM: generate(prompt_with_templates)
    LLM-->>GA: Generated Solidity code
    GA->>PG: INSERT contract
    GA->>EB: publish(GENERATION_COMPLETED)
    EB->>WS: broadcast(workflow_progressed)
    WS->>User: Real-time update: Progress 20%
    
    Note over WC,CS: Stage 2: Compilation
    WC->>CS: process(contract_code)
    CS->>PG: Store compiled contract<br/>(ABI + Bytecode)
    
    Note over WC,AA: Stage 3: Audit
    WC->>AA: process(contract_code)
    AA->>EB: publish(AUDIT_STARTED)
    AA->>AA: Run Slither, Mythril, Echidna<br/>(Parallel security analysis)
    AA->>PG: Store audit results<br/>(Vulnerabilities + Risk Score)
    AA->>EB: publish(AUDIT_COMPLETED)
    EB->>WS: broadcast(workflow_progressed)
    WS->>User: Real-time update: Progress 60%
    
    Note over WC,TA: Stage 4: Testing
    WC->>TA: process(contract_code, compiled_contract)
    TA->>EB: publish(TESTING_STARTED)
    TA->>TA: Run unit tests<br/>(Hardhat/Foundry)
    TA->>PG: Store test results<br/>(Test coverage, results)
    TA->>EB: publish(TESTING_COMPLETED)
    EB->>WS: broadcast(workflow_progressed)
    WS->>User: Real-time update: Progress 80%
    
    Note over WC,DA: Stage 5: Deployment
    WC->>DA: process(compiled_contract, network)
    DA->>EB: publish(DEPLOYMENT_STARTED)
    DA->>BC: Build, Sign, Send Transaction<br/>(Web3 transaction)
    BC-->>DA: Transaction Receipt<br/>(Contract Address, TX Hash)
    DA->>PG: Store deployment info<br/>(Address, TX Hash, Block Number)
    DA->>EB: publish(DEPLOYMENT_CONFIRMED)
    WC->>EB: publish(WORKFLOW_COMPLETED)
    EB->>WS: broadcast(workflow_completed)
    WS->>User: Real-time update: Progress 100%
    FastAPI->>User: HTTP Response<br/>Workflow result with contract address
```

## Workflow Stages

1. **Generation** (20% progress)
   - RAG template retrieval
   - LLM code generation
   - Constructor argument extraction
   - SLA: p99 < 45s

2. **Compilation** (40% progress)
   - Solidity compilation
   - ABI extraction
   - Bytecode generation

3. **Audit** (60% progress)
   - Slither static analysis
   - Mythril symbolic execution
   - Echidna fuzzing
   - Risk score calculation
   - SLA: p99 < 60s

4. **Testing** (80% progress)
   - Contract compilation
   - Unit test execution
   - Test coverage analysis
   - SLA: p99 < 90s

5. **Deployment** (100% progress)
   - Transaction building
   - Transaction signing
   - Blockchain submission
   - Confirmation waiting
   - SLA: p99 < 300s

## Event Types

- `WORKFLOW_CREATED` - Workflow initialized
- `WORKFLOW_STARTED` - Workflow execution begins
- `GENERATION_STARTED/COMPLETED` - Generation stage events
- `AUDIT_STARTED/COMPLETED` - Audit stage events
- `TESTING_STARTED/COMPLETED` - Testing stage events
- `DEPLOYMENT_STARTED/CONFIRMED` - Deployment stage events
- `WORKFLOW_COMPLETED` - Workflow finished successfully

