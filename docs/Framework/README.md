# HyperAgent Architecture Diagrams

This directory contains comprehensive Mermaid diagrams documenting the HyperAgent system architecture, data flows, and integration patterns.

## Diagrams Overview

### 1. [System Architecture Overview](./01_system_architecture.md)
Complete system architecture showing all layers, components, and their relationships.

**Key Components:**
- User Interface Layer (CLI, API, Web UI)
- Application Core (Event Bus, Service Registry, Workflow Coordinator)
- Agent Layer (Generation, Audit, Testing, Deployment)
- Blockchain Layer (Network Manager, Hyperion, Mantle, EigenDA)
- Data Persistence Layer (PostgreSQL, Redis, IPFS)
- Security & Monitoring (Security Tools, Prometheus, Grafana)

### 2. [Complete Workflow Sequence](./02_workflow_sequence.md)
End-to-end sequence diagram showing workflow execution from user request to deployed contract.

**Workflow Stages:**
1. Generation (20% progress) - RAG → LLM → Code
2. Compilation (40% progress) - Solidity compilation
3. Audit (60% progress) - Security analysis
4. Testing (80% progress) - Unit tests
5. Deployment (100% progress) - Blockchain deployment

### 3. [A2A Communication Protocol](./03_a2a_communication.md)
Agent-to-Agent communication protocol using Redis Streams event bus.

**Features:**
- Decoupled agent communication
- Request/Response pattern with correlation IDs
- Retry logic with exponential backoff
- Consumer groups for load balancing

### 4. [RAG System Flow](./04_rag_system_flow.md)
Retrieval-Augmented Generation system for contract template retrieval and enhanced code generation.

**Pipeline Steps:**
1. Embedding Generation
2. Vector Search (pgvector)
3. Similarity Calculation
4. Template Retrieval
5. Prompt Construction
6. LLM Generation
7. Code Extraction
8. Validation
9. Storage

### 5. [Frontend-Backend Integration](./05_frontend_backend_integration.md)
Integration between Next.js frontend and FastAPI backend.

**Integration Patterns:**
- REST API communication
- WebSocket real-time updates
- Polling fallback
- State management

### 6. [Event-Driven Architecture](./06_event_driven_architecture.md)
Event-driven architecture using Redis Streams.

**Event Types:**
- Workflow lifecycle events
- Agent events
- A2A communication events

**Consumers:**
- WebSocket Manager
- Database Writer
- Metrics Collector
- Log Aggregator

### 7. [Deployment Architecture](./07_deployment_architecture.md)
Production deployment architecture with Docker, monitoring, and infrastructure.

**Tiers:**
1. External Access (Users/Clients)
2. Load Balancer (Nginx)
3. Application Layer (FastAPI Workers)
4. Message Queue & Cache (Redis)
5. Database Layer (PostgreSQL)
6. Monitoring Stack (Prometheus, Grafana)
7. External Services (Blockchain, LLM, IPFS)

### 8. [Complete Data Flow](./08_data_flow.md)
Comprehensive data flow diagram showing how data moves through the entire system.

**Data Transformations:**
- NLP → Embedding
- Embedding → Templates
- Templates + Query → Code
- Code → ABI
- Code → Constructor Values
- Code → Audit Results
- Compiled → Test Results
- Transaction → Receipt

## Under the Hood: Detailed System Explanations

### 9. [CLI to API Communication](./09_cli_to_api_communication.md)
How the CLI command `hyperagent workflow create` communicates with the FastAPI backend.

**Topics:**
- Command parsing and validation
- HTTP request/response flow
- Progress monitoring with --watch flag
- Error handling and user feedback

### 10. [Configuration Loading](./10_configuration_loading.md)
How HyperAgent loads and manages settings from environment variables and `.env` files.

**Topics:**
- Pydantic Settings loading
- Environment variable priority
- Field validators and type conversion
- Configuration categories

### 11. [Workflow Management](./11_workflow_management.md)
Detailed workflow orchestration from creation to completion.

**Topics:**
- WorkflowCoordinator orchestration
- SequentialOrchestrator execution
- ServiceRegistry pattern
- Pipeline stages and progress tracking
- Error handling and retry logic

### 12. [Agent Core Duties](./12_agent_core_duties.md)
The three core methods every agent must implement: `process()`, `validate()`, and `on_error()`.

**Topics:**
- ServiceInterface protocol
- Process method flow
- Validation patterns
- Error handling strategies
- Agent interaction examples

### 13. [SQLAlchemy Models](./13_sqlalchemy_models.md)
How HyperAgent uses SQLAlchemy ORM for database operations.

**Topics:**
- Model definitions
- Data saving process
- Update operations
- Relationship handling
- Async database operations

### 14. [LLM Provider in Action](./14_llm_provider_action.md)
How the LLM Provider abstraction layer works with different AI models.

**Topics:**
- Abstract interface design
- Gemini Provider implementation
- OpenAI Provider (fallback)
- Embedding generation
- Error handling and retries

### 15. [RAG Implementation](./15_rag_implementation.md)
Detailed explanation of the Retrieval-Augmented Generation system.

**Topics:**
- Query embedding generation
- Vector similarity search with pgvector
- Template retrieval and filtering
- RAG prompt construction
- Code extraction and validation

### 16. [Network Management](./16_network_management.md)
How HyperAgent manages blockchain networks and their capabilities.

**Topics:**
- Network feature registry
- Feature detection and checking
- Fallback strategies
- Network compatibility matrix
- Web3 instance management

### 17. [Contract Auditing](./17_contract_auditing.md)
How HyperAgent performs comprehensive security audits using multiple tools.

**Topics:**
- Audit process flow
- Parallel tool execution (Slither, Mythril, Echidna)
- Vulnerability aggregation
- Risk score calculation
- Audit result structure

### 18. [Redis Streams Event Bus](./18_redis_streams_event_bus.md)
How HyperAgent implements the event bus using Redis Streams.

**Topics:**
- Event publishing (XADD)
- Event consumption (XREADGROUP)
- Consumer groups
- Message acknowledgment (XACK)
- Stream structure and operations

## How to View Diagrams

### Option 1: GitHub
GitHub automatically renders Mermaid diagrams in markdown files. Simply view the files on GitHub.

### Option 2: VS Code
Install the "Markdown Preview Mermaid Support" extension:
```bash
code --install-extension bierner.markdown-mermaid
```

### Option 3: Online Mermaid Editor
Copy the mermaid code blocks to [Mermaid Live Editor](https://mermaid.live/)

### Option 4: Local Rendering
Install Mermaid CLI:
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram.mmd -o diagram.png
```

## Architecture Principles

1. **Service-Oriented Architecture (SOA)**: Decoupled services with clear interfaces
2. **Agent-to-Agent (A2A) Protocol**: Decoupled agent communication via event bus
3. **Event-Driven Architecture**: Redis Streams for event persistence and real-time updates
4. **Service Orchestration**: Sequential and parallel service execution patterns
5. **RAG System**: Template retrieval and similarity matching for enhanced generation

## Technology Stack

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, Alembic
- **Database**: PostgreSQL 15+ with pgvector extension
- **Cache/Events**: Redis 7+ with Streams
- **Blockchain**: Web3.py, Alith SDK, EigenDA
- **LLM**: Google Gemini, OpenAI GPT-4
- **Security**: Slither, Mythril, Echidna
- **Frontend**: Next.js, React, TypeScript
- **Monitoring**: Prometheus, Grafana

## Related Documentation

- [Architecture Diagrams](../ARCHITECTURE_DIAGRAMS.md) - ASCII art diagrams
- [Complete Technical Specification](../complete-tech-spec.md) - Full technical details
- [Implementation Status](../IMPLEMENTATION_STATUS.md) - Implementation progress
- [Deployment Guide](../../GUIDE/DEPLOYMENT.md) - Deployment instructions

## Contributing

When adding new diagrams:
1. Follow the existing naming convention: `##_diagram_name.md`
2. Include a clear title and description
3. Use consistent styling and color coding
4. Add performance annotations where relevant
5. Update this README with the new diagram

## License

These diagrams are part of the HyperAgent project and are licensed under the MIT License.

