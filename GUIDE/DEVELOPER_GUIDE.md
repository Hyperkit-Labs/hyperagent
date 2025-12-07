# HyperAgent Developer Guide

Guide for developers to understand HyperAgent's architecture, extend the system, and integrate new features.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Environment Setup](#development-environment-setup)
3. [Agent Development](#agent-development)
4. [Service Integration](#service-integration)
5. [Testing Guide](#testing-guide)
6. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
7. [Performance Optimization](#performance-optimization)

## Architecture Overview

### System Components

HyperAgent follows a Service-Oriented Architecture (SOA) with the following components:

- **Agents**: Specialized workers (Generation, Audit, Testing, Deployment, Coordinator)
- **Services**: Reusable business logic (GenerationService, AuditService, etc.)
- **Event Bus**: Redis Streams for event-driven communication
- **API Layer**: FastAPI REST endpoints and WebSocket support
- **Database**: PostgreSQL with pgvector for semantic search
- **Cache**: Redis for caching and event streaming

### Design Patterns

- **Service-Oriented Architecture (SOA)**: Services are loosely coupled and reusable
- **Agent-to-Agent (A2A) Protocol**: Event-driven communication between agents
- **Service Orchestration Pattern (SOP)**: Workflow orchestration with state management

## Agent Development

### Creating a New Agent

1. **Create agent file** in `hyperagent/agents/`:

```python
from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType
from typing import Dict, Any
import uuid
from datetime import datetime

class MyCustomAgent(ServiceInterface):
    """Custom agent implementation"""
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input and return result"""
        workflow_id = input_data.get("workflow_id")
        
        # Publish start event
        await self.event_bus.publish(Event(
            id=str(uuid.uuid4()),
            type=EventType.TASK_STARTED,
            workflow_id=workflow_id,
            timestamp=datetime.now(),
            data={"message": "Processing started"},
            source_agent="my_custom_agent"
        ))
        
        # Your processing logic here
        result = {"status": "success", "data": "processed"}
        
        # Publish completion event
        await self.event_bus.publish(Event(
            id=str(uuid.uuid4()),
            type=EventType.TASK_COMPLETED,
            workflow_id=workflow_id,
            timestamp=datetime.now(),
            data=result,
            source_agent="my_custom_agent"
        ))
        
        return result
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input data"""
        return bool(data.get("required_field"))
    
    async def on_error(self, error: Exception) -> None:
        """Handle errors"""
        print(f"MyCustomAgent error: {error}")
```

2. **Register agent** in service registry:

```python
from hyperagent.architecture.soa import ServiceRegistry

registry = ServiceRegistry()
registry.register("my_custom_agent", MyCustomAgent(event_bus))
```

### Agent Best Practices

- **Event Publishing**: Always publish events for workflow tracking
- **Error Handling**: Implement robust error handling with `on_error()`
- **Validation**: Validate inputs in `validate()` method
- **Logging**: Use structured logging with correlation IDs
- **Metrics**: Track execution time and success/failure rates

## Service Integration

### Creating a Service

1. **Implement ServiceInterface**:

```python
from hyperagent.core.agent_system import ServiceInterface
from typing import Dict, Any

class MyService(ServiceInterface):
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        # Service logic
        return {"result": "success"}
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        return True
    
    async def on_error(self, error: Exception) -> None:
        pass
```

2. **Use in orchestrator**:

```python
from hyperagent.architecture.soa import SequentialOrchestrator

pipeline = [
    {"service": "my_service", "inputs": {"key": "value"}}
]

result = await orchestrator.orchestrate({
    "workflow_id": "workflow-123",
    "pipeline": pipeline,
    "initial_data": {}
})
```

## Testing Guide

### Unit Tests

Create tests in `tests/unit/`:

```python
import pytest
from unittest.mock import AsyncMock
from hyperagent.agents.my_agent import MyCustomAgent

@pytest.mark.asyncio
async def test_my_agent_process():
    mock_event_bus = AsyncMock()
    agent = MyCustomAgent(mock_event_bus)
    
    result = await agent.process({"workflow_id": "test-123"})
    
    assert result["status"] == "success"
    assert mock_event_bus.publish.called
```

### Integration Tests

Test end-to-end workflows:

```python
@pytest.mark.asyncio
async def test_workflow_e2e():
    # Setup
    coordinator = WorkflowCoordinator(...)
    
    # Execute
    result = await coordinator.execute_workflow(...)
    
    # Verify
    assert result["status"] == "completed"
```

### Running Tests

```bash
# All tests
pytest

# Unit tests only
pytest tests/unit/

# With coverage
pytest --cov=hyperagent --cov-report=html
```

## Development Environment Setup

### Prerequisites

- Python 3.10+ installed
- PostgreSQL 15+ with pgvector
- Redis 7+
- Git
- Docker (optional, for containerized development)

### Step 1: Clone Repository

```bash
git clone https://github.com/JustineDevs/HyperAgent.git
cd HyperAgent
```

### Step 2: Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies
```

### Step 4: Configure Environment

```bash
cp env.example .env
# Edit .env with your configuration
```

### Step 5: Set Up Database

```bash
# Create database
createdb hyperagent_dev

# Enable pgvector
psql hyperagent_dev -c "CREATE EXTENSION vector;"

# Run migrations
alembic upgrade head
```

### Step 6: Start Development Server

```bash
# Start Redis (if not using Docker)
redis-server

# Start API server
uvicorn hyperagent.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 7: Verify Setup

```bash
# Run tests
pytest tests/unit/ -v

# Check health
curl http://localhost:8000/api/v1/health
```

## Debugging and Troubleshooting

### Debugging Tips

1. **Enable Debug Logging**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. **Use Python Debugger**:
   ```python
   import pdb; pdb.set_trace()
   ```

3. **Check Logs**:
   ```bash
   docker-compose logs -f hyperagent
   ```

4. **Test Individual Components**:
   ```python
   # Test agent directly
   from hyperagent.agents.generation import GenerationAgent
   agent = GenerationAgent(llm_provider)
   result = await agent.process({"nlp_description": "test"})
   ```

### Common Development Issues

**Issue**: Import errors
- **Solution**: Ensure virtual environment is activated and dependencies installed

**Issue**: Database connection errors
- **Solution**: Verify PostgreSQL is running and DATABASE_URL is correct

**Issue**: Tests failing
- **Solution**: Check test database setup and mock configurations

## Performance Optimization

### Profiling

```python
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# Your code here

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats()
```

### Async Best Practices

- Use `asyncio.gather()` for parallel operations
- Avoid blocking I/O in async functions
- Use connection pooling for database/Redis

### Caching

- Use Redis for caching expensive operations
- Cache LLM responses when appropriate
- Cache compiled contracts

## Additional Resources

- **[API Documentation](./API.md)** - Complete API reference
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment
- **[Docker Guide](./DOCKER.md)** - Containerized development
- **[Complete Tech Spec](../docs/complete-tech-spec.md)** - Full technical specification
- **[Architecture Diagrams](../docs/ARCHITECTURE_DIAGRAMS.md)** - System architecture
- **[Contributing Guidelines](../CONTRIBUTING.md)** - Contribution process
- **[Collaborator Guide](./COLLABORATOR_GUIDE.md)** - For contributors

