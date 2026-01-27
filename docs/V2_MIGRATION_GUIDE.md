# v2 API Migration Guide

This guide helps you migrate from the v1 API to the v2 API for HyperAgent workflows.

## Overview

The v2 API introduces a specification-locked state machine architecture with improved type safety, better error handling, and support for the HyperAgent blueprint specification.

### Key Differences

| Feature | v1 API | v2 API |
|---------|--------|--------|
| **State Management** | Flexible, Python-based | Specification-locked (7 core fields + meta) |
| **Language** | Python (FastAPI) | TypeScript (Fastify) |
| **State Shape** | Customizable | Strict HyperAgentState |
| **Orchestration** | Python WorkflowCoordinator | TypeScript LangGraph-like state machine |
| **Type Safety** | Runtime (Pydantic) | Compile-time (TypeScript) |
| **Base URL** | `/api/v1/workflows` | `/api/v2/workflows` |

## Migration Steps

### 1. Update API Base URL

**Before (v1)**:
```typescript
const API_BASE_URL = 'http://localhost:8000/api/v1';
```

**After (v2)**:
```typescript
const API_BASE_URL_V2 = 'http://localhost:4000/api/v2';
```

### 2. Update Workflow Creation

**Before (v1)**:
```typescript
const response = await fetch(`${API_BASE_URL}/workflows/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nlp_input: "Create an ERC20 token",
    network: "mantle_testnet",
    wallet_address: "0x...",
    selected_tasks: ["generation", "compilation"]
  })
});
```

**After (v2)**:
```typescript
const response = await fetch(`${API_BASE_URL_V2}/workflows`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Create an ERC20 token",  // Changed from nlp_input
    network: "mantle_testnet",
    wallet_address: "0x...",
    selected_tasks: ["generation", "compilation"]
  })
});
```

### 3. Update Workflow Status Retrieval

**Before (v1)**:
```typescript
const workflow = await fetch(`${API_BASE_URL}/workflows/${workflowId}`);
const data = await workflow.json();
// Status: "created" | "generating" | "compiling" | ...
```

**After (v2)**:
```typescript
const workflow = await fetch(`${API_BASE_URL_V2}/workflows/${workflowId}`);
const data = await workflow.json();
// Status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
// State includes: node, status, prompt, network, contract_code, audit_result, deployment_result, meta
```

### 4. Handle State Structure Changes

**v1 Response**:
```typescript
{
  workflow_id: string;
  status: string;
  nlp_input: string;
  network: string;
  contract_code?: string;
  // ... flexible fields
}
```

**v2 Response**:
```typescript
{
  workflow_id: string;
  node: "policy" | "generate" | "audit" | "validate" | "deploy" | "eigenda" | "monitor";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  prompt: string;  // Renamed from nlp_input
  network: string;
  contract_code?: string;
  audit_result?: AuditResult;
  deployment_result?: DeploymentResult;
  meta: HyperAgentMetaV1;  // Schema-locked metadata
}
```

### 5. Update Error Handling

**Before (v1)**:
```typescript
try {
  const response = await createWorkflow(data);
  // Handle success
} catch (error) {
  // Generic error handling
}
```

**After (v2)**:
```typescript
try {
  const response = await createWorkflowV2(data);
  if (response.status === 402) {
    // Handle x402 payment required
    const paymentInfo = await response.json();
    // Show payment modal
  }
} catch (error) {
  // Check for specific error codes
  if (error.code === 'VALIDATION_ERROR') {
    // Handle validation errors
  }
}
```

## Using the Frontend API Client

The frontend provides helper functions for both APIs:

### v1 API (Legacy)
```typescript
import { createWorkflow, getWorkflow } from '@/lib/api';

const workflow = await createWorkflow({
  nlp_input: "Create a token",
  network: "mantle_testnet",
  wallet_address: "0x...",
});
```

### v2 API (Recommended)
```typescript
import { createWorkflowV2, getWorkflowV2 } from '@/lib/api';

const workflow = await createWorkflowV2({
  prompt: "Create a token",  // Note: prompt instead of nlp_input
  network: "mantle_testnet",
  wallet_address: "0x...",
});
```

## Feature Flags

The frontend supports selecting API version:

```typescript
// In WorkflowForm component
const [apiVersion, setApiVersion] = useState<'v1' | 'v2'>('v2');

// Conditionally call appropriate API
if (apiVersion === 'v2') {
  await createWorkflowV2(data);
} else {
  await createWorkflow(data);
}
```

## Backward Compatibility

- **v1 API remains available** during migration period
- Both APIs can be used simultaneously
- v1 endpoints: `http://localhost:8000/api/v1/*`
- v2 endpoints: `http://localhost:4000/api/v2/*`

## Migration Checklist

### Pre-Migration
- [ ] Review feature comparison (`docs/V2_FEATURE_COMPARISON.md`)
- [ ] Identify features used in your integration
- [ ] Check if all required features are available in v2
- [ ] Plan rollback strategy

### API Updates
- [ ] Update API base URLs to v2 (`http://localhost:4000/api/v2`)
- [ ] Change `nlp_input` to `prompt` in workflow creation
- [ ] Update status enum values (uppercase: `PENDING`, `PROCESSING`, etc.)
- [ ] Handle `meta` field in workflow responses
- [ ] Update error handling for v2 error codes
- [ ] Update TypeScript types to use v2 interfaces

### Testing
- [ ] Test workflow creation flow
- [ ] Test workflow status polling (note: WebSocket not available in v2)
- [ ] Test x402 payment flows
- [ ] Test memory integration (Chroma search, IPFS storage)
- [ ] Test audit with Slither fallback
- [ ] Test deployment flow

### Post-Migration
- [ ] Monitor error rates and performance
- [ ] Verify all features work as expected
- [ ] Update documentation
- [ ] Remove v1 API calls once migration is complete (optional)

## Benefits of v2 API

1. **Type Safety**: Compile-time type checking with TypeScript
2. **Specification-Locked**: Prevents AI hallucination with strict state shape
3. **Better Error Handling**: Structured error responses with error codes
4. **State Machine**: Predictable state transitions
5. **Performance**: TypeScript/Fastify typically faster than Python/FastAPI
6. **Future-Proof**: Aligned with blueprint specification

## Troubleshooting

### Common Issues

1. **404 Not Found**: Ensure v2 API server is running on port 4000
2. **Validation Errors**: Check that `prompt` is used instead of `nlp_input`
3. **Status Mismatch**: v2 uses uppercase status values
4. **Missing Meta Field**: v2 responses always include `meta` field

### Getting Help

- Check `docs/API_CLIENT_ARCHITECTURE.md` for API client details
- Review `ts/api/src/routes/workflows.ts` for v2 endpoint definitions
- See `ts/orchestrator/src/core/spec/state.ts` for state structure

## Timeline

- **Phase 1** (Current): Both APIs available, gradual migration
- **Phase 2** (Future): v1 API deprecated, v2 only
- **Phase 3** (Future): v1 API removed

## Additional Resources

- `hyperagent_dna_blueprint.md` - Blueprint specification
- `hyperagent_playbook.md` - Implementation playbook
- `ts/orchestrator/src/core/spec/` - v2 specification source code

