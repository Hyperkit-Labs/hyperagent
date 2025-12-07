# Under the Hood: How the CLI Talks to HyperAgent

## Overview

When you type `hyperagent workflow create`, the CLI acts as an intelligent assistant that communicates with the HyperAgent API to orchestrate smart contract generation.

## Diagram

```mermaid
sequenceDiagram
    participant User
    participant CLI as HyperAgent CLI<br/>(Click Framework)
    participant API as FastAPI REST API<br/>localhost:8000
    participant WC as WorkflowCoordinator
    participant EB as EventBus
    participant BG as Background Task

    User->>CLI: hyperagent workflow create<br/>-d "Create ERC20 token"
    
    Note over CLI: Parse command arguments<br/>Validate input<br/>Build request payload
    
    CLI->>API: POST /api/v1/workflows/generate<br/>Headers: Content-Type: application/json<br/>Body: {nlp_input, network, contract_type}
    
    Note over API: Validate request<br/>Create workflow_id<br/>Initialize workflow context
    
    API->>BG: execute_workflow_background()<br/>Start async task
    
    API-->>CLI: HTTP 202 Accepted<br/>Response: {workflow_id, status: "pending"}
    
    Note over CLI: Display workflow_id<br/>Show "Workflow created" message
    
    alt Watch Mode (--watch flag)
        loop Poll every 2 seconds
            CLI->>API: GET /api/v1/workflows/{workflow_id}
            API-->>CLI: {status, progress_percentage, ...}
            
            Note over CLI: Update progress bar<br/>Display current stage
            
            alt Workflow completed or failed
                CLI->>CLI: Stop polling
                CLI->>User: Display final results
            end
        end
    end

    Note over BG,EB: Background workflow execution
    BG->>WC: execute_workflow(workflow_id, nlp_input, network)
    WC->>EB: publish(WORKFLOW_STARTED)
    WC->>WC: Execute pipeline stages
    
    Note over BG: Workflow runs asynchronously<br/>User can continue using CLI
```

## CLI Command Flow

### 1. Command Parsing
```python
# CLI receives command
@click.command()
@click.option('-d', '--description', required=True)
@click.option('--network', default='hyperion_testnet')
def workflow_create(description, network):
    # Parse and validate
    # Build API request
```

### 2. API Request
```python
# CLI makes HTTP request
async with httpx.AsyncClient() as client:
    response = await client.post(
        f"{api_url}/api/v1/workflows/generate",
        json={
            "nlp_input": description,
            "network": network,
            "contract_type": "ERC20"
        }
    )
```

### 3. API Response
```json
{
    "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "message": "Workflow created successfully"
}
```

### 4. Progress Monitoring (if --watch)
```python
# Poll API for updates
while True:
    status = await get_workflow_status(workflow_id)
    display_progress_bar(status.progress_percentage)
    
    if status in ["completed", "failed"]:
        break
    
    await asyncio.sleep(2)  # Poll every 2 seconds
```

## CLI Features

### Real-time Progress Display
- Unicode progress bar (Windows-safe fallback)
- Stage indicators (Generating, Auditing, Testing, Deploying)
- Percentage completion
- Elapsed time tracking

### Output Formats
- **Table** (default): Formatted table with status
- **JSON**: Raw JSON output
- **YAML**: YAML formatted output
- **Compact**: Single line summary

### Error Handling
- Connection errors: Check if API is running
- HTTP errors: Display user-friendly messages
- Timeout handling: Graceful timeout with retry suggestions

## API Endpoints Used

- `POST /api/v1/workflows/generate` - Create workflow
- `GET /api/v1/workflows/{id}` - Get workflow status
- `GET /api/v1/health/` - Check API health
- `GET /api/v1/contracts/{id}` - Get contract details
- `GET /api/v1/deployments/{id}` - Get deployment details

## Benefits

- **Non-blocking**: Workflow runs in background
- **Real-time Updates**: Progress monitoring with --watch
- **User-friendly**: Clear error messages and suggestions
- **Flexible**: Multiple output formats
- **Cross-platform**: Windows-safe Unicode handling

