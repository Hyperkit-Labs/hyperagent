# Under the Hood: The Three Core Duties of Every Agent

## Overview

All agents in HyperAgent implement the `ServiceInterface` protocol, which defines three core methods that every agent must provide.

## Diagram

```mermaid
classDiagram
    class ServiceInterface {
        <<Protocol>>
        +async process(input_data: Dict) Dict
        +async validate(data: Dict) bool
        +async on_error(error: Exception) None
    }
    
    class GenerationAgent {
        +async process(input_data) Dict
        +async validate(data) bool
        +async on_error(error) None
    }
    
    class AuditAgent {
        +async process(input_data) Dict
        +async validate(data) bool
        +async on_error(error) None
    }
    
    class TestingAgent {
        +async process(input_data) Dict
        +async validate(data) bool
        +async on_error(error) None
    }
    
    class DeploymentAgent {
        +async process(input_data) Dict
        +async validate(data) bool
        +async on_error(error) None
    }
    
    ServiceInterface <|.. GenerationAgent
    ServiceInterface <|.. AuditAgent
    ServiceInterface <|.. TestingAgent
    ServiceInterface <|.. DeploymentAgent
```

## The Three Core Methods

### 1. `process(input_data: Dict[str, Any]) -> Dict[str, Any]`

**Purpose**: Execute the agent's main functionality

**Flow**:
```mermaid
sequenceDiagram
    participant Orchestrator
    participant Agent
    participant EventBus
    participant Database

    Orchestrator->>Agent: process(input_data)
    
    Note over Agent: 1. Validate input
    Agent->>Agent: validate(input_data)
    
    Note over Agent: 2. Publish start event
    Agent->>EventBus: publish(AGENT_STARTED)
    
    Note over Agent: 3. Execute business logic
    Agent->>Agent: Execute agent-specific logic
    
    Note over Agent: 4. Store results
    Agent->>Database: INSERT/UPDATE data
    
    Note over Agent: 5. Publish completion event
    Agent->>EventBus: publish(AGENT_COMPLETED)
    
    Agent-->>Orchestrator: Return result dict
```

**Example - GenerationAgent**:
```python
async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
    # 1. Validate
    if not await self.validate(input_data):
        raise ValueError("Invalid input")
    
    # 2. Publish start event
    await self.event_bus.publish(Event(
        type=EventType.GENERATION_STARTED,
        workflow_id=input_data["workflow_id"],
        ...
    ))
    
    # 3. Execute logic
    contract_code = await self.template_retriever.retrieve_and_generate(...)
    
    # 4. Store results
    # (handled by service layer)
    
    # 5. Publish completion
    await self.event_bus.publish(Event(
        type=EventType.GENERATION_COMPLETED,
        ...
    ))
    
    # 6. Return result
    return {
        "status": "success",
        "contract_code": contract_code,
        "abi": abi,
        ...
    }
```

### 2. `validate(data: Dict[str, Any]) -> bool`

**Purpose**: Validate input data before processing

**Flow**:
```mermaid
flowchart TD
    START[Input Data Received]
    VALIDATE{validate() called}
    CHECK1{Required fields present?}
    CHECK2{Field types correct?}
    CHECK3{Values within range?}
    PASS[Return True]
    FAIL[Return False]
    
    START --> VALIDATE
    VALIDATE --> CHECK1
    CHECK1 -->|Yes| CHECK2
    CHECK1 -->|No| FAIL
    CHECK2 -->|Yes| CHECK3
    CHECK2 -->|No| FAIL
    CHECK3 -->|Yes| PASS
    CHECK3 -->|No| FAIL
```

**Example - AuditAgent**:
```python
async def validate(self, data: Dict[str, Any]) -> bool:
    # Check required fields
    if not data.get("contract_code"):
        return False
    
    # Check data types
    if not isinstance(data["contract_code"], str):
        return False
    
    # Check value constraints
    if len(data["contract_code"]) < 10:
        return False
    
    return True
```

### 3. `on_error(error: Exception) -> None`

**Purpose**: Handle errors gracefully

**Flow**:
```mermaid
sequenceDiagram
    participant Agent
    participant EventBus
    participant Logger
    participant Database

    Note over Agent: Error occurs during process()
    Agent->>Agent: on_error(exception)
    
    Note over Agent: 1. Log error
    Agent->>Logger: Log error with context
    
    Note over Agent: 2. Update state
    Agent->>Database: UPDATE workflow<br/>SET status='failed'
    
    Note over Agent: 3. Publish error event
    Agent->>EventBus: publish(AGENT_FAILED)
    
    Note over Agent: 4. Cleanup resources
    Agent->>Agent: Cleanup temp files, connections
```

**Example - DeploymentAgent**:
```python
async def on_error(self, error: Exception):
    # 1. Log error
    logger.error(
        f"Deployment error for workflow {self.workflow_id}",
        exc_info=error,
        extra={
            "workflow_id": self.workflow_id,
            "network": self.network
        }
    )
    
    # 2. Publish error event
    await self.event_bus.publish(Event(
        type=EventType.DEPLOYMENT_FAILED,
        workflow_id=self.workflow_id,
        data={"error": str(error)},
        ...
    ))
    
    # 3. Cleanup
    if self.temp_files:
        for file in self.temp_files:
            os.remove(file)
```

## Agent Interaction Example

### Workflow System → Audit Agent

```mermaid
sequenceDiagram
    participant WS as Workflow System
    participant AA as Audit Agent
    participant VALIDATE as validate()
    participant PROCESS as process()
    participant ERROR as on_error()

    WS->>AA: process({contract_code: "..."})
    
    Note over AA: Step 1: Validate input
    AA->>VALIDATE: validate({contract_code})
    VALIDATE-->>AA: True (valid)
    
    Note over AA: Step 2: Execute audit
    AA->>PROCESS: Run Slither, Mythril, Echidna
    PROCESS->>PROCESS: Analyze contract
    PROCESS-->>AA: {vulnerabilities, risk_score}
    
    alt Error occurs
        AA->>ERROR: on_error(exception)
        ERROR->>ERROR: Log error
        ERROR->>ERROR: Publish error event
        ERROR-->>AA: Error handled
    end
    
    AA-->>WS: {status: "success", vulnerabilities: [...]}
```

## ServiceInterface Protocol

```python
class ServiceInterface(Protocol):
    """Service contract - all services must implement"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process input and return output
        
        Logic Flow:
        1. Validate input_data
        2. Execute business logic
        3. Return structured output
        4. Handle errors gracefully
        """
        ...
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input data before processing"""
        ...
    
    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        ...
```

## Benefits

- **Consistency**: All agents follow the same interface
- **Error Handling**: Standardized error handling pattern
- **Validation**: Input validation before processing
- **Event Publishing**: Consistent event publishing
- **Testability**: Easy to test with mock implementations
- **Extensibility**: Easy to add new agents

## Agent Responsibilities

### GenerationAgent
- **process**: Generate contract code from NLP
- **validate**: Check NLP input is valid
- **on_error**: Handle generation failures

### AuditAgent
- **process**: Run security analysis
- **validate**: Check contract code exists
- **on_error**: Handle audit tool failures

### TestingAgent
- **process**: Run unit tests
- **validate**: Check contract is compilable
- **on_error**: Handle test execution failures

### DeploymentAgent
- **process**: Deploy contract to blockchain
- **validate**: Check compiled contract and network
- **on_error**: Handle deployment failures

