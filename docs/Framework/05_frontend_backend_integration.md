# Frontend-Backend Integration Diagram

## Diagram

```mermaid
graph TB
    subgraph "Frontend - Next.js (Left)"
        subgraph "UI Layer"
            PAGES[Next.js App Router<br/>/workflows<br/>/workflows/create<br/>/workflows/[id]<br/>/contracts/[id]<br/>/deployments/[id]]
        end

        subgraph "Components Layer"
            COMP[React Components<br/>WorkflowForm<br/>WorkflowProgress<br/>ContractViewer<br/>ExplorerLink]
        end

        subgraph "Hooks Layer"
            HOOKS[Custom React Hooks<br/>useWorkflow(workflowId)<br/>useWebSocket(workflowId)<br/>usePolling(fetchFn, interval)<br/>useHealth()]
        end

        subgraph "API Client Layer"
            API_CLIENT[lib/api.ts<br/>createWorkflow(data)<br/>getWorkflow(id)<br/>getTemplates()<br/>searchTemplates(query)]
        end

        subgraph "WebSocket Client Layer"
            WS_CLIENT[lib/websocket.ts<br/>WorkflowWebSocket<br/>connect()<br/>onMessage(callback)<br/>onConnect(callback)<br/>disconnect()]
        end

        PAGES --> COMP
        COMP --> HOOKS
        HOOKS --> API_CLIENT
        HOOKS --> WS_CLIENT
    end

    subgraph "Backend - FastAPI (Right)"
        subgraph "API Routes Layer"
            ROUTES[FastAPI Routes<br/>POST /api/v1/workflows/generate<br/>GET /api/v1/workflows/{id}<br/>GET /api/v1/templates<br/>POST /api/v1/templates/search<br/>GET /api/v1/networks<br/>GET /api/v1/health/detailed]
        end

        subgraph "WebSocket Endpoint"
            WS_ENDPOINT[WebSocket Endpoint<br/>/ws/workflow/{workflow_id}<br/>ConnectionManager<br/>websocket_endpoint()]
        end

        subgraph "Event Bus Integration"
            EB_SUB[EventBus Subscriber<br/>Subscribes to workflow events<br/>Filters by workflow_id<br/>Broadcasts to WebSocket clients]
        end

        subgraph "Background Tasks"
            BG_TASK[Background Task Queue<br/>execute_workflow_background()<br/>Runs workflow asynchronously]
        end

        subgraph "Database Layer"
            DB[(PostgreSQL<br/>SQLAlchemy ORM<br/>Workflows, Contracts<br/>Deployments)]
        end

        ROUTES --> BG_TASK
        ROUTES --> DB
        WS_ENDPOINT --> EB_SUB
        EB_SUB --> WS_ENDPOINT
        BG_TASK --> DB
    end

    API_CLIENT -->|HTTP REST| ROUTES
    WS_CLIENT -->|WebSocket| WS_ENDPOINT
    WS_ENDPOINT -->|Real-time Events| WS_CLIENT
    ROUTES -->|JSON Response| API_CLIENT

    subgraph "Flow 1: Create Workflow"
        F1A[User fills WorkflowForm] --> F1B[createWorkflow(data)]
        F1B --> F1C[POST /api/v1/workflows/generate]
        F1C --> F1D[Creates workflow, returns workflow_id]
        F1D --> F1E[Starts background task]
        F1E --> F1F[Redirects to /workflows/{id}]
    end

    subgraph "Flow 2: Real-time Updates"
        F2A[useWebSocket(workflowId)] --> F2B[WS /ws/workflow/{id}]
        F2B --> F2C[ConnectionManager.connect()]
        F2C --> F2D[Subscribes to EventBus events]
        F2D --> F2E[EventBus publishes workflow events]
        F2E --> F2F[Filters events by workflow_id]
        F2F --> F2G[Broadcasts to WebSocket]
        F2G --> F2H[Frontend receives update, updates UI]
    end

    subgraph "Flow 3: Polling Fallback"
        F3A[useWorkflow(workflowId)] --> F3B[GET /workflows/{id}]
        F3B --> F3C[Queries database]
        F3C --> F3D[Returns workflow status]
        F3D --> F3E[Polls every 2s if not completed]
        F3E --> F3F[Stops polling when completed]
    end

    subgraph "Flow 4: Template Search"
        F4A[User searches templates] --> F4B[searchTemplates(query)]
        F4B --> F4C[POST /templates/search]
        F4C --> F4D[Vector similarity search]
        F4D --> F4E[Returns similar templates]
        F4E --> F4F[Frontend displays results]
    end

    style PAGES fill:#e1f5ff
    style COMP fill:#cfe2ff
    style HOOKS fill:#a8d5e2
    style API_CLIENT fill:#85c1e2
    style WS_CLIENT fill:#5dade2
    style ROUTES fill:#d4edda
    style WS_ENDPOINT fill:#a8e6cf
    style EB_SUB fill:#7dcea0
    style BG_TASK fill:#52be80
    style DB fill:#cfe2ff
```

## Data Structures

### WebSocket Message
```typescript
{
  type: "workflow.progressed" | "workflow.completed" | "workflow.failed",
  workflow_id: string,
  data: Workflow,
  timestamp: string,
  source_agent: string
}
```

### Workflow Type
```typescript
{
  id: string,
  status: "pending" | "generating" | "auditing" | "testing" | "deploying" | "completed" | "failed",
  progress_percentage: number,
  nlp_input: string,
  network: string,
  contract?: Contract,
  deployment?: Deployment
}
```

## Integration Patterns

### 1. REST API Communication
- **Method**: HTTP POST/GET requests
- **Format**: JSON
- **Timeout**: 30 seconds
- **Error Handling**: Axios interceptors
- **Base URL**: `http://localhost:8000/api/v1`

### 2. WebSocket Real-time Updates
- **Protocol**: WebSocket (WS/WSS)
- **Endpoint**: `/ws/workflow/{workflow_id}`
- **Connection**: Persistent, auto-reconnect
- **Heartbeat**: 30-second ping/pong
- **Fallback**: Polling if WebSocket unavailable

### 3. Polling Fallback
- **Trigger**: When WebSocket unavailable
- **Interval**: 2 seconds (configurable)
- **Stop Condition**: Workflow completed or failed
- **Hook**: `useWorkflow(workflowId, pollInterval)`

### 4. State Management
- **Local State**: React useState hooks
- **Real-time Updates**: WebSocket messages update state
- **Optimistic Updates**: UI updates immediately on user actions
- **Error States**: Error boundaries and try-catch

## Key API Endpoints

### Workflows
- `POST /api/v1/workflows/generate` - Create new workflow
- `GET /api/v1/workflows/{id}` - Get workflow details

### Templates
- `GET /api/v1/templates` - List templates
- `POST /api/v1/templates/search` - Search templates

### Networks
- `GET /api/v1/networks` - List supported networks
- `GET /api/v1/networks/{network}/features` - Get network features

### Health
- `GET /api/v1/health/` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health status

## Error Handling

- **Network Errors**: Retry with exponential backoff
- **API Errors**: Display user-friendly error messages
- **WebSocket Errors**: Fallback to polling
- **Timeout Errors**: Show timeout message, allow retry

