# Postman Testing Guide for HyperAgent TS API

## Overview

This guide provides instructions for testing all HyperAgent TS API endpoints using the Postman collection.

## Setup

### 1. Import Collection

1. Open Postman
2. Click **Import** button
3. Select `HyperAgent_TS_API.postman_collection.json`
4. Collection will be imported with all endpoints organized by category

### 2. Configure Environment Variables

The collection uses these variables:

- `base_url`: API base URL (default: `http://localhost:4000`)
- `workflow_id`: Workflow ID for testing (set after creating a workflow)
- `wallet_address`: Ethereum wallet address for testing
- `payment_signature`: x402 payment signature (when testing x402 endpoints)
- `x_payment`: Alternative x402 payment header (when testing x402 endpoints)

### 3. Start the API Server

Ensure the TS API server is running:

```bash
cd ts/api
npm run dev
```

Or using Docker:

```bash
docker compose up ts-orchestrator
```

## Testing Strategy

### Phase 1: Health Checks

Test basic connectivity and service status:

1. **Liveness Probe** (`GET /healthz`)
   - Expected: `200 OK` with `{"status": "ok"}`

2. **Readiness Probe** (`GET /readyz`)
   - Expected: `200 OK` with `{"status": "ready"}`

3. **Health Check** (`GET /api/v1/health`)
   - Expected: `200 OK` with timestamp

4. **Detailed Health** (`GET /api/v1/health/detailed`)
   - Expected: `200 OK` with service status details
   - Verify: Database, Redis, LLM, Audit, x402 configuration

### Phase 2: Network Endpoints

Test network discovery and configuration:

1. **List Networks** (`GET /api/v1/networks`)
   - Expected: `200 OK` with array of supported networks
   - Verify: avalanche_fuji, avalanche_mainnet, mantle_testnet, mantle_mainnet

2. **Get Network** (`GET /api/v1/networks/avalanche_fuji`)
   - Expected: `200 OK` with network details

3. **Get Network Features** (`GET /api/v1/networks/avalanche_fuji/features`)
   - Expected: `200 OK` or `501` if Python backend not configured

4. **Get x402 Networks** (`GET /api/v1/networks/x402`)
   - Expected: `200 OK` or `501` if Python backend not configured

### Phase 3: Template Endpoints

Test contract template functionality:

1. **List Templates** (`GET /api/v1/templates`)
   - Expected: `200 OK` with templates array
   - Note: Returns empty array if DATABASE_URL not set

2. **Search Templates (GET)** (`GET /api/v1/templates/search?q=ERC20`)
   - Expected: `200 OK` with filtered templates

3. **Search Templates (POST)** (`POST /api/v1/templates/search`)
   - Expected: `200 OK` with filtered templates

### Phase 4: Cost Estimation

Test cost calculation:

1. **Estimate Cost** (`POST /api/v1/workflows/estimate-cost`)
   - Expected: `200 OK` with cost breakdown
   - Verify: total_usdc, breakdown by task, multipliers

### Phase 5: V2 Workflows (Simple)

Test the simplified V2 workflow API:

1. **Create Workflow** (`POST /api/v2/workflows`)
   - Body: `{"intent": "Create a simple ERC20 token contract"}`
   - Expected: `200 OK` with workflow state or `402` if payment required
   - Save `workflow_id` from response for subsequent tests

2. **Get Workflow** (`GET /api/v2/workflows/{id}`)
   - Expected: `200 OK` with workflow state or `404` if not found
   - Note: Requires DATABASE_URL to be set

3. **List Workflows** (`GET /api/v2/workflows`)
   - Expected: `200 OK` with workflows array
   - Note: Requires DATABASE_URL to be set

### Phase 6: V1 Workflows (Full)

Test the complete V1 workflow API:

1. **Generate Workflow** (`POST /api/v1/workflows/generate`)
   - Body: Complete workflow request with nlp_input, network, wallet_address
   - Expected: `200 OK` with workflow_id and status "created"
   - If x402 enabled: May require payment headers
   - Save `workflow_id` from response

2. **Get Workflow** (`GET /api/v1/workflows/{id}`)
   - Expected: `200 OK` with full workflow details
   - Verify: status, progress_percentage, contracts, deployments

3. **List Workflows** (`GET /api/v1/workflows`)
   - Expected: `200 OK` with workflows array

4. **Get Workflow Contracts** (`GET /api/v1/workflows/{id}/contracts`)
   - Expected: `200 OK` with contracts array
   - Verify: source_code, bytecode, abi

5. **Cancel Workflow** (`POST /api/v1/workflows/{id}/cancel`)
   - Expected: `200 OK` with cancellation message

6. **Confirm Deployment** (`POST /api/v1/workflows/{id}/deploy/confirm`)
   - Body: `{"tx_hash": "...", "network": "avalanche_fuji"}`
   - Expected: `200 OK` with deployment confirmation

### Phase 7: x402 Endpoints (Payment Required)

Test x402 payment integration (requires x402 to be enabled):

1. **Generate Contract** (`POST /api/v1/x402/contracts/generate`)
   - Requires: `x-wallet-address` header
   - May require: `payment-signature` or `x-payment` header
   - Expected: `200 OK` with contract_code or `402` if payment required

2. **Create Workflow from Contract** (`POST /api/v1/x402/workflows/create-from-contract`)
   - Body: contract_code, network, wallet_address
   - May require: payment headers
   - Expected: `200 OK` with workflow_id

3. **Deploy Contract** (`POST /api/v1/x402/deployments/deploy`)
   - Body: compiled_contract, network, wallet_address
   - May require: payment headers
   - Expected: `200 OK` with deployment details

### Phase 8: x402 Analytics

Test spending tracking and analytics:

1. **Get Payment History** (`GET /api/v1/x402/analytics/history`)
   - Query: `wallet_address`, `page`, `page_size`
   - Expected: `200 OK` with payment history

2. **Get Payment Summary** (`GET /api/v1/x402/analytics/summary`)
   - Query: `wallet_address`
   - Expected: `200 OK` with summary statistics

### Phase 9: Spending Controls

Test spending limit management:

1. **Get Spending Control** (`GET /api/v1/x402/spending-controls/{wallet}`)
   - Expected: `200 OK` with control settings or `404` if not found

2. **Create/Update Spending Control** (`POST /api/v1/x402/spending-controls`)
   - Body: wallet_address, daily_limit, monthly_limit, whitelist_merchants
   - Expected: `200 OK` with created/updated control

### Phase 10: Metrics

Test system metrics:

1. **Get Metrics** (`GET /api/v1/metrics`)
   - Expected: `200 OK` with workflow/deployment/performance metrics

## Error Scenarios to Test

### Validation Errors

1. **Invalid Request Body**
   - Send malformed JSON
   - Expected: `400 Bad Request` with validation errors

2. **Missing Required Fields**
   - Omit required fields (e.g., wallet_address, nlp_input)
   - Expected: `400 Bad Request` with field-specific errors

3. **Invalid Wallet Address**
   - Use invalid format: `"wallet_address": "invalid"`
   - Expected: `400 Bad Request` with validation error

### Not Found Errors

1. **Non-existent Workflow**
   - `GET /api/v1/workflows/non-existent-id`
   - Expected: `404 Not Found`

2. **Non-existent Network**
   - `GET /api/v1/networks/invalid-network`
   - Expected: `404 Not Found`

### Payment Errors (x402)

1. **Payment Required (402)**
   - Call x402 endpoint without payment headers
   - Expected: `402 Payment Required` with payment details

2. **Spending Limit Exceeded**
   - Set low spending limits, then exceed them
   - Expected: `403 Forbidden` with limit message

3. **Spending Controls Disabled**
   - Disable spending controls, then test
   - Expected: `403 Forbidden` with disabled message

### Service Unavailable

1. **Database Not Configured**
   - Test endpoints requiring DATABASE_URL without it set
   - Expected: `501 Not Implemented` with message

2. **Python Backend Not Configured**
   - Test proxy endpoints without PYTHON_BACKEND_URL
   - Expected: `501 Not Implemented` with message

## Automated Testing

### Using Postman Collection Runner

1. Select the collection
2. Click **Run** button
3. Configure:
   - Iterations: 1
   - Delay: 1000ms
   - Data: None (or CSV file for data-driven tests)
4. Click **Run HyperAgent TS API**

### Using Newman (CLI)

```bash
# Install Newman
npm install -g newman

# Run collection
newman run HyperAgent_TS_API.postman_collection.json \
  --environment localhost.postman_environment.json \
  --reporters cli,html

# With environment variables
newman run HyperAgent_TS_API.postman_collection.json \
  -e localhost.postman_environment.json \
  --env-var "base_url=http://localhost:4000" \
  --env-var "wallet_address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

## Expected Response Times

- Health checks: < 100ms
- Network/template endpoints: < 200ms
- Cost estimation: < 300ms
- Workflow creation: < 500ms (immediate response)
- Workflow status: < 200ms
- Contract generation: < 5s (background processing)
- Deployment: < 30s (depends on network)

## Troubleshooting

### Connection Refused

- Verify API server is running: `curl http://localhost:4000/healthz`
- Check port configuration in environment variables

### 501 Not Implemented

- Check DATABASE_URL is set for workflow persistence
- Check PYTHON_BACKEND_URL is set for proxy endpoints

### 402 Payment Required

- Verify x402 is enabled: Check `/api/v1/health/detailed`
- Add payment headers if testing x402 endpoints
- Disable x402 for non-payment testing

### Invalid Workflow ID

- Create a workflow first, then copy workflow_id from response
- Use the workflow_id variable in Postman

## Success Criteria

All tests pass if:

- ✅ All health checks return 200 OK
- ✅ Network endpoints return valid network data
- ✅ Workflow creation returns workflow_id
- ✅ Workflow status can be retrieved
- ✅ Cost estimation returns valid breakdown
- ✅ Error responses follow expected format
- ✅ Response times meet performance targets

## Notes

- Some endpoints require DATABASE_URL to be configured
- x402 endpoints require payment integration setup
- Workflow execution is asynchronous; status may change after creation
- Use test networks (avalanche_fuji, mantle_testnet) for deployment testing

