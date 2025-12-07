# Complete Data Flow Diagram

## Diagram

```mermaid
flowchart LR
    subgraph "Input Layer"
        INPUT[User Input<br/>NLP: "Create ERC20 token with 1M supply"<br/>Network: "hyperion_testnet"<br/>Contract Type: "ERC20"<br/>Options: MetisVM optimization]
    end

    subgraph "Generation Flow"
        RAG[RAG System<br/>Generate embedding<br/>vector[1536]]
        TEMPLATE[(Template Database<br/>Vector similarity search<br/>SELECT * FROM templates<br/>WHERE embedding <-> query_embedding < 0.3)]
        LLM1[LLM Provider<br/>Gemini API<br/>prompt: string with RAG context]
        CODE[Contract Code<br/>string]
        VALID[Validation<br/>Syntax check<br/>Structure validation]
        ABI[ABI Extraction<br/>Solidity compilation<br/>abi: JSON<br/>bytecode: hex]
        CONSTRUCTOR[Constructor Extraction<br/>Parse constructor parameters<br/>Generate constructor values]
    end

    subgraph "Compilation Flow"
        COMPILE[Compiler<br/>solc compilation]
        COMPILED[Compiled Contract<br/>abi: JSON<br/>bytecode: hex]
    end

    subgraph "Audit Flow"
        SECURITY[Security Tools<br/>Slither: Static analysis<br/>Mythril: Symbolic execution<br/>Echidna: Fuzzing]
        RISK[Risk Scoring<br/>Calculate risk_score 0-100]
        AUDIT_RESULT[Audit Results<br/>vulnerabilities: List[Vuln]<br/>risk_score: number]
    end

    subgraph "Testing Flow"
        TEST[Test Runner<br/>Hardhat/Foundry tests]
        TEST_RESULT[Test Results<br/>passed: number<br/>failed: number<br/>coverage: percentage]
    end

    subgraph "Deployment Flow"
        TX_BUILD[Transaction Builder<br/>Build deployment transaction<br/>bytecode, constructor_args, gas_estimate]
        SIGNER[Signer<br/>Sign with private_key]
        SIGNED_TX[Signed Transaction<br/>SignedTransaction]
        BLOCKCHAIN[Blockchain Network<br/>Hyperion/Mantle RPC<br/>Send via Web3]
        TX_HASH[Transaction Hash<br/>hex string]
        CONFIRM[Confirmation<br/>Wait for receipt]
        RECEIPT[Transaction Receipt<br/>contract_address: string<br/>block_number: number<br/>gas_used: number]
    end

    subgraph "Data Storage"
        PG[(PostgreSQL<br/>workflows table<br/>contracts table<br/>templates table<br/>deployments table<br/>security_audits table)]
        REDIS[(Redis<br/>Streams: Event persistence<br/>Cache: Workflow state, templates)]
        IPFS_STORE[IPFS/Pinata<br/>Contract templates<br/>Metadata]
    end

    subgraph "Output Layer"
        OUTPUT[Deployed Contract<br/>Contract Address: 0x1234...<br/>Transaction Hash: 0xabcd...<br/>Block Number: 12345<br/>Explorer Link: URL]
    end

    INPUT --> RAG
    RAG --> TEMPLATE
    TEMPLATE --> LLM1
    LLM1 --> CODE
    CODE --> VALID
    VALID --> ABI
    CODE --> CONSTRUCTOR
    ABI --> COMPILE
    COMPILE --> COMPILED
    CODE --> SECURITY
    SECURITY --> RISK
    RISK --> AUDIT_RESULT
    COMPILED --> TEST
    TEST --> TEST_RESULT
    COMPILED --> TX_BUILD
    CONSTRUCTOR --> TX_BUILD
    TX_BUILD --> SIGNER
    SIGNER --> SIGNED_TX
    SIGNED_TX --> BLOCKCHAIN
    BLOCKCHAIN --> TX_HASH
    TX_HASH --> CONFIRM
    CONFIRM --> RECEIPT
    RECEIPT --> OUTPUT

    CODE --> PG
    COMPILED --> PG
    AUDIT_RESULT --> PG
    TEST_RESULT --> PG
    RECEIPT --> PG

    CODE --> REDIS
    COMPILED --> REDIS
    AUDIT_RESULT --> REDIS
    TEST_RESULT --> REDIS
    RECEIPT --> REDIS

    CODE --> IPFS_STORE

    style INPUT fill:#e1f5ff
    style RAG fill:#d4edda
    style TEMPLATE fill:#cfe2ff
    style LLM1 fill:#f0e6ff
    style CODE fill:#fff3cd
    style VALID fill:#f8d7da
    style ABI fill:#ffeaa7
    style CONSTRUCTOR fill:#ffe6cc
    style COMPILE fill:#d1ecf1
    style COMPILED fill:#cfe2ff
    style SECURITY fill:#f8d7da
    style RISK fill:#ffcccc
    style AUDIT_RESULT fill:#ffcccc
    style TEST fill:#fff3cd
    style TEST_RESULT fill:#fff3cd
    style TX_BUILD fill:#d4edda
    style SIGNER fill:#a8e6cf
    style SIGNED_TX fill:#7dcea0
    style BLOCKCHAIN fill:#52be80
    style TX_HASH fill:#52be80
    style CONFIRM fill:#52be80
    style RECEIPT fill:#52be80
    style PG fill:#cfe2ff
    style REDIS fill:#ffcccc
    style IPFS_STORE fill:#ffe6cc
    style OUTPUT fill:#d4edda
```

## Data Transformations

### 1. NLP → Embedding
- **Input**: User query string
- **Process**: LLM Provider `embed()` method
- **Output**: 1536-dimensional vector
- **Timeout**: 10 seconds

### 2. Embedding → Templates
- **Input**: Query embedding vector
- **Process**: PostgreSQL pgvector cosine similarity
- **Query**: `SELECT * FROM templates WHERE embedding <-> query_embedding < 0.3`
- **Output**: List of similar templates

### 3. Templates + Query → Code
- **Input**: Templates + user query
- **Process**: LLM generation with RAG context
- **Output**: Generated Solidity code
- **Timeout**: 30 seconds

### 4. Code → ABI
- **Input**: Solidity source code
- **Process**: Solidity compiler (solc)
- **Output**: ABI (JSON) + Bytecode (hex)

### 5. Code → Constructor Values
- **Input**: Contract code + NLP description
- **Process**: Parse constructor, LLM generates values
- **Output**: Constructor argument values

### 6. Code → Audit Results
- **Input**: Contract source code
- **Process**: Slither, Mythril, Echidna analysis
- **Output**: Vulnerabilities list + risk score

### 7. Compiled → Test Results
- **Input**: Compiled contract + source code
- **Process**: Hardhat/Foundry test execution
- **Output**: Test results + coverage percentage

### 8. Compiled + Constructor → Transaction
- **Input**: Bytecode + constructor arguments
- **Process**: Build deployment transaction
- **Output**: Raw transaction object

### 9. Transaction → Signed Transaction
- **Input**: Raw transaction + private key
- **Process**: ECDSA signing
- **Output**: Signed transaction with signature

### 10. Signed Transaction → Receipt
- **Input**: Signed transaction
- **Process**: Send to blockchain, wait for confirmation
- **Output**: Transaction receipt with contract address

## Data Storage Points

### PostgreSQL Tables

1. **workflows**
   - id, nlp_input, network, status, progress_percentage
   - created_at, updated_at

2. **contracts**
   - id, workflow_id, code, abi, bytecode
   - contract_type, constructor_params

3. **templates**
   - id, name, code, embedding (vector), contract_type
   - description, tags

4. **deployments**
   - id, contract_id, network, contract_address
   - tx_hash, block_number, gas_used

5. **security_audits**
   - id, contract_id, vulnerabilities (JSON)
   - risk_score, audit_status

### Redis Storage

1. **Streams**: Event persistence
   - `events:workflow.*`
   - `events:generation.*`
   - `events:audit.*`
   - `events:testing.*`
   - `events:deployment.*`

2. **Cache**: Workflow state, templates
   - `workflow:{id}:state`
   - `template:{id}:cache`

### IPFS/Pinata Storage

1. **Templates**: Contract template code
2. **Metadata**: Contract metadata JSON
3. **ABI**: Contract ABI files

## Error Handling Paths

- **Validation Failures** → Error event → Workflow failed
- **Compilation Errors** → Error event → Workflow failed
- **Audit Failures** → Warning event → Continue workflow
- **Deployment Failures** → Error event → Workflow failed
- **Network Errors** → Retry with exponential backoff

## Performance Annotations

- **Embedding Generation**: < 10s
- **Vector Search**: < 50ms (with index)
- **LLM Generation**: < 30s
- **Compilation**: < 5s
- **Audit**: < 60s (p99)
- **Testing**: < 90s (p99)
- **Deployment**: < 300s (p99)
- **Total Workflow**: < 800s (p99)

## Parallel Processing

- **Security Tools**: Slither, Mythril, Echidna run in parallel
- **Template Retrieval**: Vector search is parallelized
- **Event Publishing**: Async, non-blocking
- **Database Writes**: Async with connection pooling

