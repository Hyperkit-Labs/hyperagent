# Code Examples in Issue Templates

## Summary

Issue templates now include actual code examples to guide assignees. Code examples are automatically generated based on the issue area and title, following patterns from `.cursor/llm/` documentation files.

## What Changed

### Before
- Issues had template structure but no code examples
- Assignees had to figure out implementation patterns themselves
- No guidance on how to structure code

### After
- Issues include a **"5.5. Implementation Guide"** section with code examples
- Examples are contextual based on area (orchestration, frontend, agents, etc.)
- Code follows patterns from established LLM documentation

## Code Examples by Area

### Orchestration
- **FastAPI endpoints**: Shows router setup, dependency injection, request/response models
- **LangGraph workflows**: Demonstrates state graph, nodes, edges, conditional routing
- **Supabase schemas**: SQL table definitions and RLS policies

### Frontend
- **Next.js Server Components**: Async data fetching patterns
- **Client Components**: React hooks, state management, UI components

### Agents
- **SpecAgent**: RAG integration with Pinecone, context retrieval
- **CodeGenAgent**: Multi-model routing, code generation patterns
- **AuditAgent**: Slither integration, security analysis

### Chain Adapter
- **Thirdweb SDK**: Contract deployment patterns
- **Multi-chain support**: Chain ID configuration

### Storage-RAG
- **IPFS/Pinata**: File upload and pinning
- **Pinecone**: Vector store operations, embeddings, querying

### Infrastructure
- **Redis Worker Pool**: Task queuing with RQ
- **Worker management**: Async task execution

### SDK-CLI
- **TypeScript SDK**: Client initialization, workspace management, pipeline execution

## How It Works

1. **Area Detection**: Script identifies issue area from labels
2. **Title Analysis**: Parses title for keywords (e.g., "FastAPI", "LangGraph", "UI")
3. **Example Selection**: Chooses relevant code examples from library
4. **Template Integration**: Inserts examples into issue body section 5.5

## Example Output

For an issue like "Implement FastAPI API gateway skeleton", the template includes:

```markdown
### 5.5. Implementation Guide

**Code Examples & Patterns:**

**FastAPI Endpoint Example:**
```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from hyperagent.api.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/workflows")

class WorkflowRequest(BaseModel):
    prompt: str
    chains: list[str]

@router.post("/")
async def create_workflow(
    request: WorkflowRequest,
    user: User = Depends(get_current_user)
):
    workflow = await orchestrator.create_workflow(
        prompt=request.prompt,
        chains=request.chains,
        workspace_id=user.workspace_id
    )
    return workflow
```
```

## Benefits

1. **Faster Onboarding**: New assignees see implementation patterns immediately
2. **Consistency**: All implementations follow the same patterns
3. **Reduced Questions**: Code examples answer "how do I structure this?"
4. **Quality**: Examples follow best practices from LLM documentation

## Source of Examples

Code examples are derived from:
- `.cursor/llm/fastapi-llm.txt`
- `.cursor/llm/langgraph-llm.txt`
- `.cursor/llm/nextjs-react-llm.txt`
- `.cursor/llm/supabase-llm.txt`
- `.cursor/llm/thirdweb-llm.txt`
- And other relevant LLM documentation files

## Customization

To add or modify code examples, edit the `_generate_code_examples()` method in `scripts/github/create_phase1_issues.py`. Examples should:
- Be practical and runnable
- Follow HyperAgent patterns
- Include necessary imports
- Show complete, working code snippets

