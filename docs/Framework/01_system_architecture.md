# HyperAgent System Architecture Overview

## Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        CLI[CLI Layer<br/>Click Framework]
        API[API Layer<br/>FastAPI REST API]
        WEB[Web UI<br/>Next.js Frontend]
    end

    subgraph "Application Core"
        EB[Event Bus<br/>Redis Streams<br/>Message Queue<br/>Cache Layer]
        SR[Service Registry<br/>Generation, Audit<br/>Testing, Deployment]
        WC[Workflow Coordinator<br/>SequentialOrchestrator]
        CM[WebSocket ConnectionManager<br/>Real-time Updates]
    end

    subgraph "Agent Layer"
        GA[Generation Agent<br/>RAG → LLM → Code<br/>SLA: p99<45s]
        AA[Audit Agent<br/>Slither, Mythril, Echidna<br/>SLA: p99<60s]
        TA[Testing Agent<br/>Compile, Unit Tests<br/>SLA: p99<90s]
        DA[Deployment Agent<br/>Sign, Submit, Confirm<br/>SLA: p99<300s]
    end

    subgraph "Blockchain Layer"
        NM[Network Manager<br/>Web3 Instances]
        HYPER[Hyperion Testnet<br/>Chain ID: 133717]
        MANTLE[Mantle Testnet<br/>Chain ID: 5003]
        EIGEN[EigenDA Integration<br/>Data Availability]
        ALITH[Alith SDK Client<br/>AI Agent Framework]
    end

    subgraph "Data Persistence Layer"
        PG[(PostgreSQL 15+<br/>pgvector Extension<br/>Workflows, Contracts<br/>Templates, Deployments)]
        REDIS[(Redis 7+<br/>Streams, Cache, State)]
        IPFS[IPFS/Pinata<br/>Template Storage]
    end

    subgraph "Security & Monitoring"
        SEC[Security Tools<br/>Slither, Mythril, Echidna]
        PROM[Prometheus<br/>Metrics Collection]
        GRAF[Grafana<br/>Dashboards]
    end

    CLI --> EB
    API --> EB
    WEB --> EB
    API --> CM
    
    EB --> SR
    SR --> WC
    WC --> GA
    WC --> AA
    WC --> TA
    WC --> DA
    
    GA --> EB
    AA --> EB
    TA --> EB
    DA --> EB
    
    DA --> NM
    NM --> HYPER
    NM --> MANTLE
    NM --> EIGEN
    DA --> ALITH
    
    GA --> PG
    AA --> PG
    TA --> PG
    DA --> PG
    
    GA --> REDIS
    AA --> REDIS
    TA --> REDIS
    DA --> REDIS
    
    GA --> IPFS
    
    AA --> SEC
    PROM --> GRAF
    
    style CLI fill:#e1f5ff
    style API fill:#e1f5ff
    style WEB fill:#e1f5ff
    style EB fill:#f0e6ff
    style SR fill:#e6f3ff
    style WC fill:#e6f3ff
    style CM fill:#fff4e6
    style GA fill:#d4edda
    style AA fill:#f8d7da
    style TA fill:#fff3cd
    style DA fill:#ffeaa7
    style NM fill:#d1ecf1
    style HYPER fill:#d1ecf1
    style MANTLE fill:#d1ecf1
    style EIGEN fill:#d1ecf1
    style ALITH fill:#d1ecf1
    style PG fill:#cfe2ff
    style REDIS fill:#ffcccc
    style IPFS fill:#ffe6cc
    style SEC fill:#ffcccc
    style PROM fill:#e6ccff
    style GRAF fill:#e6ccff
```

## Technology Stack

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, Alembic
- **Database**: PostgreSQL 15+ with pgvector extension
- **Cache/Events**: Redis 7+ with Streams
- **Blockchain**: Web3.py, Alith SDK, EigenDA
- **LLM**: Google Gemini, OpenAI GPT-4
- **Security**: Slither, Mythril, Echidna
- **Frontend**: Next.js, React, TypeScript
- **Monitoring**: Prometheus, Grafana

## Architecture Principles

- **Service-Oriented Architecture (SOA)**: Decoupled services with clear interfaces
- **Agent-to-Agent (A2A) Protocol**: Decoupled agent communication via event bus
- **Event-Driven Architecture**: Redis Streams for event persistence and real-time updates
- **Service Orchestration**: Sequential and parallel service execution patterns
- **RAG System**: Template retrieval and similarity matching for enhanced generation

