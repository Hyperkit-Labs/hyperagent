# Deployment Architecture Diagram

## Diagram

```mermaid
graph TB
    subgraph "Tier 1: External Access"
        USERS[Users/Clients<br/>Browser, CLI, Mobile]
    end

    subgraph "Tier 2: Load Balancer"
        NGINX[Nginx Load Balancer<br/>SSL Termination<br/>Rate Limiting<br/>Health Checks<br/>WebSocket Proxy<br/>Ports: 80, 443]
    end

    subgraph "Tier 3: Application Layer"
        APP1[FastAPI Worker 1<br/>Port: 8000<br/>Health: /api/v1/health/]
        APP2[FastAPI Worker 2<br/>Port: 8000<br/>Health: /api/v1/health/]
        APP3[FastAPI Worker 3<br/>Port: 8000<br/>Health: /api/v1/health/]
        APP4[FastAPI Worker 4<br/>Port: 8000<br/>Health: /api/v1/health/]
    end

    subgraph "Tier 4: Message Queue & Cache"
        REDIS[Redis 7+<br/>Redis Streams - Event bus<br/>Redis Cache - Session/data cache<br/>Redis Pub/Sub - Real-time messaging<br/>Port: 6379<br/>Persistence: AOF + RDB]
    end

    subgraph "Tier 5: Database Layer"
        PG[(PostgreSQL 15+<br/>pgvector Extension<br/>Connection Pooling: 20 connections<br/>Port: 5432<br/>Storage: Persistent volume)]
        REPLICA[(Read Replica<br/>Optional)]
    end

    subgraph "Tier 6: Monitoring Stack"
        PROM[Prometheus<br/>Scrapes: /api/v1/metrics/prometheus<br/>Port: 9090<br/>Storage: Time-series DB]
        GRAF[Grafana<br/>Dashboards: System, Workflow, Agent<br/>Port: 3001<br/>Data Source: Prometheus]
        ALERT[AlertManager<br/>Optional<br/>Alerts: High error rate, SLA violations]
    end

    subgraph "Tier 7: External Services"
        BC[Blockchain Networks<br/>Hyperion Testnet RPC<br/>Mantle Testnet RPC<br/>EigenDA Data Availability]
        LLM[LLM Providers<br/>Google Gemini API<br/>OpenAI API fallback]
        IPFS[IPFS/Pinata<br/>Template storage<br/>Contract metadata]
    end

    USERS -->|HTTPS/WSS| NGINX
    NGINX -->|Load Balanced| APP1
    NGINX -->|Load Balanced| APP2
    NGINX -->|Load Balanced| APP3
    NGINX -->|Load Balanced| APP4

    APP1 --> REDIS
    APP2 --> REDIS
    APP3 --> REDIS
    APP4 --> REDIS

    APP1 --> PG
    APP2 --> PG
    APP3 --> PG
    APP4 --> PG

    PG --> REPLICA

    APP1 --> PROM
    APP2 --> PROM
    APP3 --> PROM
    APP4 --> PROM

    PROM --> GRAF
    PROM --> ALERT

    APP1 --> BC
    APP2 --> BC
    APP3 --> BC
    APP4 --> BC

    APP1 --> LLM
    APP2 --> LLM
    APP3 --> LLM
    APP4 --> LLM

    APP1 --> IPFS
    APP2 --> IPFS
    APP3 --> IPFS
    APP4 --> IPFS

    subgraph "Docker Compose Structure"
        DOCKER[Docker Compose Stack<br/>hyperagent: FastAPI workers<br/>postgres: PostgreSQL 15<br/>redis: Redis 7-alpine<br/>prometheus: Metrics collection<br/>grafana: Dashboards<br/>Network: hyperagent_network]
    end

    subgraph "Scaling Strategy"
        SCALE[Horizontal Scaling<br/>Add more API workers<br/>Vertical Scaling<br/>Increase container resources<br/>Database Scaling<br/>Read replicas for queries<br/>Redis Scaling<br/>Redis Cluster for HA]
    end

    subgraph "Security Layers"
        SEC1[SSL/TLS<br/>End-to-end encryption]
        SEC2[API Keys<br/>Authentication]
        SEC3[Rate Limiting<br/>DDoS protection]
        SEC4[Input Validation<br/>SQL injection prevention]
        SEC5[Secrets Management<br/>Environment variables]
    end

    style USERS fill:#e1f5ff
    style NGINX fill:#ffe6cc
    style APP1 fill:#d4edda
    style APP2 fill:#d4edda
    style APP3 fill:#d4edda
    style APP4 fill:#d4edda
    style REDIS fill:#ffcccc
    style PG fill:#cfe2ff
    style REPLICA fill:#cfe2ff
    style PROM fill:#e6ccff
    style GRAF fill:#e6ccff
    style ALERT fill:#e6ccff
    style BC fill:#f0e6ff
    style LLM fill:#f0e6ff
    style IPFS fill:#f0e6ff
```

## Docker Compose Configuration

```yaml
services:
  hyperagent:
    image: hyperagent:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/hyperagent_db
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - hyperagent_network

  postgres:
    image: postgres:15
    volumes:
      - ./data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=hyperagent_db
      - POSTGRES_USER=hyperagent_user
      - POSTGRES_PASSWORD=secure_password
    networks:
      - hyperagent_network

  redis:
    image: redis:7-alpine
    volumes:
      - ./redis-data:/data
    networks:
      - hyperagent_network

  prometheus:
    image: prom/prometheus
    volumes:
      - ./config/prometheus:/etc/prometheus
    ports:
      - "9090:9090"
    networks:
      - hyperagent_network

  grafana:
    image: grafana/grafana
    volumes:
      - ./config/grafana:/etc/grafana
    ports:
      - "3001:3001"
    depends_on:
      - prometheus
    networks:
      - hyperagent_network

networks:
  hyperagent_network:
    driver: bridge
```

## Network Architecture

- **Docker Network**: `hyperagent_network` (bridge driver)
- **All containers**: On same network for internal communication
- **External access**: Via Nginx load balancer only
- **Port mapping**: Only expose necessary ports (80, 443, 3001, 9090)

## Data Flow

1. **User Request**: HTTPS → Nginx Load Balancer
2. **Load Balancing**: Nginx → FastAPI Worker (round-robin)
3. **Event Publishing**: FastAPI → Redis Streams
4. **Database Operations**: FastAPI → PostgreSQL
5. **Blockchain Interaction**: FastAPI → Blockchain RPC
6. **Metrics Collection**: Prometheus → FastAPI (scrape)
7. **Visualization**: Grafana → Prometheus (query)

## Scaling Strategy

### Horizontal Scaling
- Add more FastAPI worker containers
- Load balancer distributes requests
- Stateless workers scale independently

### Vertical Scaling
- Increase container CPU/memory
- Optimize database queries
- Increase Redis memory

### Database Scaling
- Read replicas for query load
- Connection pooling (20 connections)
- Query optimization with indexes

### Redis Scaling
- Redis Cluster for high availability
- Sharding for large datasets
- Persistence with AOF + RDB

## Security Layers

1. **SSL/TLS**: End-to-end encryption
2. **API Keys**: Authentication for API access
3. **Rate Limiting**: DDoS protection (Nginx)
4. **Input Validation**: SQL injection prevention
5. **Secrets Management**: Environment variables (never commit)
6. **Network Isolation**: Docker network isolation
7. **Health Checks**: Automatic container restart on failure

## Monitoring

### Prometheus Metrics
- **System Metrics**: CPU, memory, disk, network
- **Application Metrics**: Request rate, latency, errors
- **Workflow Metrics**: Workflow count, success rate, SLA compliance
- **Agent Metrics**: Agent execution time, error rate

### Grafana Dashboards
- **System Health Dashboard**: Overall system status
- **Workflow Metrics Dashboard**: Workflow performance
- **Agent Performance Dashboard**: Agent execution metrics
- **Error Tracking Dashboard**: Error rates and types

### Alerting
- **High Error Rate**: > 5% error rate
- **SLA Violations**: p99 latency > SLA threshold
- **Resource Exhaustion**: CPU/Memory > 80%
- **Database Issues**: Connection pool exhaustion

## High Availability

- **Multiple Workers**: 4+ FastAPI workers
- **Database Replication**: Read replicas
- **Redis Persistence**: AOF + RDB snapshots
- **Health Checks**: Automatic failover
- **Load Balancing**: Distribute load evenly

