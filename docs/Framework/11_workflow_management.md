# Under the Hood: How HyperAgent Manages Workflows

## Overview

When you type `hyperagent workflow create`, a complex yet organized series of events unfolds to orchestrate the complete smart contract lifecycle.

## Diagram

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI Command
    participant API as FastAPI Route
    participant WC as WorkflowCoordinator
    participant SR as ServiceRegistry
    participant SO as SequentialOrchestrator
    participant GA as GenerationAgent
    participant AA as AuditAgent
    participant TA as TestingAgent
    participant DA as DeploymentAgent
    participant EB as EventBus
    participant DB as PostgreSQL

    User->>CLI: hyperagent workflow create
    CLI->>API: POST /api/v1/workflows/generate
    
    Note over API: Create workflow_id<br/>Initialize workflow context
    
    API->>DB: INSERT INTO workflows<br/>(id, nlp_input, network, status)
    DB-->>API: workflow_id
    
    API->>WC: execute_workflow_background()<br/>Start async task
    API-->>CLI: Return workflow_id immediately
    
    Note over WC: WorkflowCoordinator orchestrates<br/>the complete pipeline
    
    WC->>EB: publish(WORKFLOW_STARTED)
    
    WC->>SR: get_service("generation")
    SR-->>WC: GenerationAgent instance
    
    Note over WC,GA: Stage 1: Generation
    WC->>SO: orchestrate(pipeline)
    SO->>GA: process({nlp_description, network})
    GA->>EB: publish(GENERATION_STARTED)
    GA->>GA: RAG → LLM → Code Generation
    GA->>DB: INSERT INTO contracts
    GA->>EB: publish(GENERATION_COMPLETED)
    GA-->>SO: {contract_code, abi, constructor_args}
    SO-->>WC: Stage 1 complete
    
    Note over WC,AA: Stage 2: Compilation
    WC->>SR: get_service("compilation")
    SO->>SO: Compile contract code
    SO-->>WC: {compiled_contract}
    
    Note over WC,AA: Stage 3: Audit
    WC->>SR: get_service("audit")
    SO->>AA: process({contract_code})
    AA->>EB: publish(AUDIT_STARTED)
    AA->>AA: Run Slither, Mythril, Echidna
    AA->>DB: INSERT INTO security_audits
    AA->>EB: publish(AUDIT_COMPLETED)
    AA-->>SO: {vulnerabilities, risk_score}
    SO-->>WC: Stage 3 complete
    
    Note over WC,TA: Stage 4: Testing
    WC->>SR: get_service("testing")
    SO->>TA: process({contract_code, compiled_contract})
    TA->>EB: publish(TESTING_STARTED)
    TA->>TA: Run unit tests
    TA->>DB: INSERT INTO test_results
    TA->>EB: publish(TESTING_COMPLETED)
    TA-->>SO: {test_results, coverage}
    SO-->>WC: Stage 4 complete
    
    Note over WC,DA: Stage 5: Deployment
    WC->>SR: get_service("deployment")
    SO->>DA: process({compiled_contract, network})
    DA->>EB: publish(DEPLOYMENT_STARTED)
    DA->>DA: Build, Sign, Send Transaction
    DA->>DB: INSERT INTO deployments
    DA->>EB: publish(DEPLOYMENT_CONFIRMED)
    DA-->>SO: {contract_address, tx_hash}
    SO-->>WC: Stage 5 complete
    
    WC->>DB: UPDATE workflows<br/>SET status='completed'
    WC->>EB: publish(WORKFLOW_COMPLETED)
    
    Note over WC: All stages complete<br/>Workflow finished
```

## Workflow System Components

### 1. WorkflowCoordinator
```python
class WorkflowCoordinator:
    """Orchestrates complete workflow pipeline"""
    
    async def execute_workflow(self, workflow_id, nlp_input, network):
        # Define pipeline stages
        pipeline = [
            {"service": "generation", ...},
            {"service": "compilation", ...},
            {"service": "audit", ...},
            {"service": "testing", ...},
            {"service": "deployment", ...}
        ]
        
        # Execute sequentially
        result = await self.orchestrator.orchestrate(pipeline)
        return result
```

### 2. SequentialOrchestrator
```python
class SequentialOrchestrator:
    """Executes services one after another"""
    
    async def orchestrate(self, workflow_context):
        for stage in pipeline:
            service = self.registry.get_service(stage["service"])
            
            # Validate input
            if not await service.validate(request):
                raise ValueError("Validation failed")
            
            # Execute service
            result = await service.process(request)
            
            # Update progress
            await self.progress_callback(status, progress)
            
            # Publish event
            await self.event_bus.publish(progress_event)
```

### 3. ServiceRegistry
```python
class ServiceRegistry:
    """Central registry for service lookup"""
    
    def register(self, name, service, metadata=None):
        self._services[name] = service
        self._metadata[name] = metadata
    
    def get_service(self, name):
        if name not in self._services:
            raise ValueError(f"Service '{name}' not found")
        return self._services[name]
```

## Pipeline Stages

### Stage 1: Generation (20% progress)
- **Service**: GenerationAgent
- **Input**: `{nlp_description, network, contract_type}`
- **Process**: RAG → LLM → Code Generation
- **Output**: `{contract_code, abi, constructor_args}`
- **SLA**: p99 < 45s

### Stage 2: Compilation (40% progress)
- **Service**: CompilationService
- **Input**: `{contract_code}`
- **Process**: Solidity compilation
- **Output**: `{compiled_contract: {abi, bytecode}}`

### Stage 3: Audit (60% progress)
- **Service**: AuditAgent
- **Input**: `{contract_code}`
- **Process**: Slither, Mythril, Echidna
- **Output**: `{vulnerabilities, risk_score}`
- **SLA**: p99 < 60s

### Stage 4: Testing (80% progress)
- **Service**: TestingAgent
- **Input**: `{contract_code, compiled_contract}`
- **Process**: Unit tests execution
- **Output**: `{test_results, coverage}`
- **SLA**: p99 < 90s

### Stage 5: Deployment (100% progress)
- **Service**: DeploymentAgent
- **Input**: `{compiled_contract, network, constructor_args}`
- **Process**: Build → Sign → Send → Confirm
- **Output**: `{contract_address, tx_hash, block_number}`
- **SLA**: p99 < 300s

## State Management

### Workflow States
```python
class WorkflowStatus(Enum):
    CREATED = "created"
    NLP_PARSING = "nlp_parsing"
    GENERATING = "generating"
    AUDITING = "auditing"
    TESTING = "testing"
    DEPLOYING = "deploying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
```

### Progress Tracking
- **Progress Percentage**: 0-100%
- **Current Stage**: Active stage name
- **Updated At**: Last update timestamp
- **Error Tracking**: Error message and stacktrace

## Error Handling

### Retry Logic
```python
# Exponential backoff retry
retry_count = 0
max_retries = 3

while retry_count < max_retries:
    try:
        result = await service.process(input_data)
        break
    except Exception as e:
        retry_count += 1
        wait_time = 2 ** retry_count  # Exponential backoff
        await asyncio.sleep(wait_time)
```

### Error Events
- `WORKFLOW_FAILED` - Workflow failed with error
- `GENERATION_FAILED` - Generation stage failed
- `AUDIT_FAILED` - Audit stage failed
- `TESTING_FAILED` - Testing stage failed
- `DEPLOYMENT_FAILED` - Deployment stage failed

## Benefits

- **Sequential Execution**: Stages run in order
- **State Persistence**: Workflow state saved to database
- **Progress Tracking**: Real-time progress updates
- **Error Recovery**: Retry logic with exponential backoff
- **Event-Driven**: Events published for each stage
- **Scalable**: Services can be scaled independently

