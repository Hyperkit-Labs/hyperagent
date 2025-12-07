# Event-Driven Architecture Flow Diagram

## Diagram

```mermaid
graph TB
    subgraph "Event Bus - Redis Streams (Center)"
        EB[Redis Event Bus<br/>Central Hub]
        S1[Stream: events:workflow.*]
        S2[Stream: events:generation.*]
        S3[Stream: events:audit.*]
        S4[Stream: events:testing.*]
        S5[Stream: events:deployment.*]
        S6[Stream: events:a2a.*]
        
        EB --> S1
        EB --> S2
        EB --> S3
        EB --> S4
        EB --> S5
        EB --> S6
    end

    subgraph "Event Producers (Left)"
        CA[CoordinatorAgent<br/>Produces:<br/>WORKFLOW_CREATED<br/>WORKFLOW_STARTED<br/>WORKFLOW_COMPLETED<br/>WORKFLOW_FAILED]
        GA[GenerationAgent<br/>Produces:<br/>GENERATION_STARTED<br/>GENERATION_COMPLETED<br/>GENERATION_FAILED]
        AA[AuditAgent<br/>Produces:<br/>AUDIT_STARTED<br/>AUDIT_COMPLETED<br/>AUDIT_FAILED]
        TA[TestingAgent<br/>Produces:<br/>TESTING_STARTED<br/>TESTING_COMPLETED<br/>TESTING_FAILED]
        DA[DeploymentAgent<br/>Produces:<br/>DEPLOYMENT_STARTED<br/>DEPLOYMENT_CONFIRMED<br/>DEPLOYMENT_FAILED]
    end

    subgraph "Event Consumers (Right)"
        WS[WebSocket Manager<br/>Consumes: All workflow events<br/>Filters by: workflow_id<br/>Broadcasts to: WebSocket clients]
        DBW[Database Writer<br/>Consumes: Completion events<br/>Writes: Workflow state, results]
        MET[Metrics Collector<br/>Consumes: All events<br/>Aggregates: Performance metrics<br/>Sends to: Prometheus]
        LOG[Log Aggregator<br/>Consumes: All events<br/>Logs: Structured logs]
    end

    CA -->|XADD| EB
    GA -->|XADD| EB
    AA -->|XADD| EB
    TA -->|XADD| EB
    DA -->|XADD| EB

    EB -->|XREADGROUP| WS
    EB -->|XREADGROUP| DBW
    EB -->|XREADGROUP| MET
    EB -->|XREADGROUP| LOG

    subgraph "Event Flow Example"
        GA2[GenerationAgent] -->|1. XADD event| EB2[EventBus]
        EB2 -->|2. Store in Redis Stream| RS[Redis Stream]
        RS -->|3. XREADGROUP| WS2[WebSocket Manager]
        WS2 -->|4. Filter by workflow_id| FILTER{workflow_id<br/>match?}
        FILTER -->|Yes| WS3[Send to WebSocket client]
        FILTER -->|No| SKIP[Skip event]
        RS -->|5. XREADGROUP| DBW2[Database Writer]
        DBW2 -->|6. INSERT workflow_update| PG[(PostgreSQL)]
        RS -->|7. XREADGROUP| MET2[Metrics Collector]
        MET2 -->|8. Record metric| PROM[Prometheus]
    end

    subgraph "Event Types Catalog"
        WF[Workflow Lifecycle<br/>WORKFLOW_CREATED<br/>WORKFLOW_STARTED<br/>WORKFLOW_PROGRESSED<br/>WORKFLOW_COMPLETED<br/>WORKFLOW_FAILED<br/>WORKFLOW_CANCELLED]
        AG[Agent Events<br/>GENERATION_STARTED/COMPLETED/FAILED<br/>AUDIT_STARTED/COMPLETED/FAILED<br/>TESTING_STARTED/COMPLETED/FAILED<br/>DEPLOYMENT_STARTED/CONFIRMED/FAILED]
        A2A[A2A Communication<br/>A2A_REQUEST<br/>A2A_RESPONSE]
    end

    subgraph "Event Structure"
        EVENT[Event<br/>id: UUID<br/>type: EventType enum<br/>workflow_id: string<br/>timestamp: datetime<br/>data: Dict[str, Any]<br/>source_agent: string<br/>metadata: Optional[Dict]]
    end

    subgraph "Consumer Groups"
        CG1[websocket_workers<br/>WebSocket connections]
        CG2[db_writers<br/>Database persistence]
        CG3[metrics_collectors<br/>Metrics aggregation]
        CG4[log_aggregators<br/>Log collection]
    end

    subgraph "Redis Streams Operations"
        XADD[XADD - Publish<br/>XADD events:workflow.started *<br/>data '{"id":"...","type":"..."}']
        XREAD[XREADGROUP - Consume<br/>XREADGROUP GROUP websocket_workers<br/>worker-1 STREAMS events:* ><br/>COUNT 10 BLOCK 1000]
        XACK[XACK - Acknowledge<br/>XACK events:workflow.started<br/>websocket_workers event_id]
    end

    style EB fill:#f0e6ff
    style CA fill:#e6f3ff
    style GA fill:#d4edda
    style AA fill:#f8d7da
    style TA fill:#fff3cd
    style DA fill:#ffeaa7
    style WS fill:#d1ecf1
    style DBW fill:#cfe2ff
    style MET fill:#e6ccff
    style LOG fill:#ffe6cc
    style RS fill:#ffcccc
    style PG fill:#cfe2ff
    style PROM fill:#e6ccff
```

## Event Types

### Workflow Lifecycle Events
- `WORKFLOW_CREATED` - Workflow initialized
- `WORKFLOW_STARTED` - Workflow execution begins
- `WORKFLOW_PROGRESSED` - Progress update (with percentage)
- `WORKFLOW_COMPLETED` - Workflow finished successfully
- `WORKFLOW_FAILED` - Workflow failed with error
- `WORKFLOW_CANCELLED` - Workflow cancelled by user

### Agent Events
- `GENERATION_STARTED/COMPLETED/FAILED` - Generation stage
- `AUDIT_STARTED/COMPLETED/FAILED` - Audit stage
- `TESTING_STARTED/COMPLETED/FAILED` - Testing stage
- `DEPLOYMENT_STARTED/CONFIRMED/FAILED` - Deployment stage

### A2A Communication Events
- `A2A_REQUEST` - Request message between agents
- `A2A_RESPONSE` - Response message between agents

## Event Structure

```python
@dataclass
class Event:
    id: str  # UUID
    type: EventType  # Enum
    workflow_id: str
    timestamp: datetime
    data: Dict[str, Any]
    source_agent: str
    metadata: Optional[Dict[str, Any]] = None
```

## Redis Streams Operations

### Publish Event (XADD)
```redis
XADD events:workflow.started * 
  data '{"id":"uuid","type":"workflow.started","workflow_id":"...","timestamp":"...","data":{},"source_agent":"coordinator"}'
```

### Consume Events (XREADGROUP)
```redis
XREADGROUP GROUP websocket_workers worker-1
  STREAMS events:workflow.* >
  COUNT 10
  BLOCK 1000
```

### Acknowledge Event (XACK)
```redis
XACK events:workflow.started 
  websocket_workers event_id
```

## Consumer Groups

- **websocket_workers**: WebSocket connections for real-time updates
- **db_writers**: Database persistence workers
- **metrics_collectors**: Metrics aggregation for Prometheus
- **log_aggregators**: Structured log collection

## Reliability Features

- **Consumer Groups**: Load balancing across multiple workers
- **XACK**: Message acknowledgment ensures processing
- **Retry Logic**: Failed messages retried automatically
- **Dead Letter Queue**: Messages failed after max retries
- **Idempotency**: Event ID prevents duplicate processing
- **Persistence**: Redis Streams persist events to disk

## Performance Metrics

- **Event Propagation**: < 10ms
- **Throughput**: 10,000 events/sec
- **Latency**: p99 < 50ms
- **Durability**: AOF + RDB persistence

## Benefits

- **Decoupling**: Producers and consumers don't know each other
- **Scalability**: Multiple consumers can process events
- **Reliability**: Redis Streams provides persistence
- **Real-time**: Events propagate immediately
- **Load Balancing**: Consumer groups distribute work
- **Fault Tolerance**: Failed consumers don't block others

