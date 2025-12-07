# HyperAgent API Documentation

RESTful API for AI-powered smart contract generation, auditing, testing, and deployment.

**Base URL**: `https://api.hyperagent.dev/api/v1`  
**Version**: 1.0.0

## Authentication

HyperAgent uses JWT (JSON Web Tokens) for authentication.

### Getting an Access Token

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Using the Token

Include the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### x402 Payment-Gated Endpoints

HyperAgent supports pay-per-use contract generation on Avalanche networks using the x402 payment protocol.

#### Generate Contract (x402)

**POST** `/api/v1/x402/contracts/generate`

Generate a smart contract behind x402 payment. Requires payment approval in wallet.

**Request Headers**:
```
Content-Type: application/json
X-Payment: <base64-encoded-payment-data>  # Added automatically by wrapFetchWithPayment
```

**Request Body**:
```json
{
  "nlp_description": "Create an ERC20 token with vesting",
  "contract_type": "ERC20",
  "network": "avalanche_fuji"
}
```

**Response (402 Payment Required)**:
```json
{
  "error": "Payment Required",
  "endpoint": "/contracts/generate",
  "price_usdc": 0.05,
  "currency": "USDC",
  "network": "avalanche_fuji",
  "token_address": "0x5425890298aed601595a70AB815c96711a31Bc65"
}
```

**Response (200 Success)**:
```json
{
  "contract_code": "pragma solidity ^0.8.0; ...",
  "contract_type": "ERC20",
  "compiled_bytecode": "0x608060405234801561001057600080fd5b50...",
  "abi": [...]
}
```

#### Create Workflow from Contract (x402)

**POST** `/api/v1/x402/workflows/create-from-contract`

Create a workflow from an existing contract behind x402 payment.

**Request Body**:
```json
{
  "contract_code": "pragma solidity ^0.8.0; ...",
  "contract_type": "ERC20",
  "network": "avalanche_fuji",
  "constructor_args": [],
  "name": "My Token",
  "wallet_address": "0x...",
  "use_gasless": true
}
```

#### Prepare Deployment (x402)

**POST** `/api/v1/x402/deployments/prepare`

Prepare an unsigned deployment transaction for user signing.

**Request Body**:
```json
{
  "compiled_contract": {...},
  "network": "avalanche_fuji",
  "constructor_args": [],
  "wallet_address": "0x..."
}
```

**Response**:
```json
{
  "unsigned_transaction": {
    "to": null,
    "data": "0x608060405234801561001057600080fd5b50...",
    "gas": "0x186a0",
    "gasPrice": "0x3b9aca00",
    "value": "0x0",
    "nonce": 5
  }
}
```

#### Complete Deployment (x402)

**POST** `/api/v1/x402/deployments/complete`

Complete deployment with signed transaction from user wallet.

**Request Body**:
```json
{
  "signed_transaction": "0x...",
  "network": "avalanche_fuji",
  "wallet_address": "0x..."
}
```

**Response**:
```json
{
  "contract_address": "0x...",
  "transaction_hash": "0x...",
  "block_number": 12345,
  "gas_used": "150000"
}
```

**Note**: All x402 endpoints require:
- Wallet connection on frontend
- Payment approval for contract generation
- Signed transactions for deployments

### Health Check

**GET** `/api/v1/health`

Check API health status.

**Response**:
```json
{
  "status": "healthy",
  "app_name": "HyperAgent",
  "version": "1.0.0"
}
```

### Workflows

#### Create Workflow

**POST** `/api/v1/workflows/generate`

Create a new contract generation workflow.

**⚠️ IMPORTANT**: All workflows now require `wallet_address` for user-wallet-based deployment. No `PRIVATE_KEY` is needed - users sign transactions in their wallets.

**Request Body**:
```json
{
  "nlp_input": "Create an ERC20 token with burn functionality",
  "network": "hyperion_testnet",
  "contract_type": "ERC20",
  "name": "My Token Contract",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",  // REQUIRED: User's wallet address
  "use_gasless": false  // Optional: Use facilitator for gasless deployment
}
```

**Note**: 
- `wallet_address` is **required** for all workflows
- Wallet address must be a valid Ethereum address (checksum format)
- For x402 networks (Avalanche), users sign transactions in their wallets
- For gasless deployments, set `use_gasless=true` (requires facilitator configuration)

**Response**:
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "created",
  "message": "Workflow created successfully",
  "created_at": "2025-01-01T12:00:00Z"
}
```

#### Get Workflow Status

**GET** `/api/v1/workflows/{workflow_id}`

Get current status of a workflow.

**Response**:
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "generating",
  "progress_percentage": 25,
  "network": "hyperion_testnet",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:00:30Z"
}
```

#### Cancel Workflow

**POST** `/api/v1/workflows/{workflow_id}/cancel`

Cancel a running workflow.

**Response**:
```json
{
  "message": "Workflow cancelled successfully"
}
```

### Contracts

#### Generate Contract

**POST** `/api/v1/contracts/generate`

Generate a smart contract from natural language description.

**Request Body**:
```json
{
  "nlp_description": "Create an ERC20 token with burn and mint functions",
  "contract_type": "ERC20",
  "network": "hyperion_testnet"
}
```

**Response**:
```json
{
  "contract_code": "pragma solidity ^0.8.27;\n...",
  "contract_type": "ERC20",
  "abi": {...},
  "constructor_args": []
}
```

#### Audit Contract

**POST** `/api/v1/contracts/audit`

Run security audit on a contract.

**Request Body**:
```json
{
  "contract_code": "pragma solidity ^0.8.27;\n...",
  "audit_level": "standard"
}
```

**Response**:
```json
{
  "vulnerabilities": [],
  "overall_risk_score": 15.0,
  "audit_status": "passed",
  "critical_count": 0,
  "high_count": 0,
  "medium_count": 1,
  "low_count": 2
}
```

### Deployments

#### Deploy Contract

**POST** `/api/v1/deployments/deploy`

Deploy a compiled contract to the blockchain.

**⚠️ IMPORTANT**: For user deployments, use `wallet_address` and `signed_transaction` instead of `private_key`.

**Request Body (User Wallet Deployment - Recommended)**:
```json
{
  "compiled_contract": {
    "abi": [...],
    "bytecode": "0x6080604052..."
  },
  "network": "hyperion_testnet",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",  // REQUIRED: User's wallet address
  "signed_transaction": "0x...",  // REQUIRED: Signed transaction from user wallet
  "constructor_args": []
}
```

**Request Body (Legacy - Server Private Key - Deprecated)**:
```json
{
  "compiled_contract": {
    "abi": [...],
    "bytecode": "0x6080604052..."
  },
  "network": "hyperion_testnet",
  "private_key": "your_private_key",  // DEPRECATED: Only for EigenDA/Alith
  "constructor_args": []
}
```

**Note**: 
- For x402 networks (Avalanche), `wallet_address` and `signed_transaction` are required
- `private_key` is deprecated and only used for server-side operations (EigenDA, Alith)
- Use `/x402/deployments/prepare` to get unsigned transaction, then sign in wallet

**Response**:
```json
{
  "contract_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "transaction_hash": "0x1234...",
  "block_number": 12345,
  "gas_used": 1500000,
  "eigenda_commitment": "0x..."
}
```

### Metrics

#### Prometheus Metrics

**GET** `/api/v1/metrics/prometheus`

Get Prometheus-formatted metrics for monitoring.

**Response**: Prometheus text format

### WebSocket

#### Workflow Updates

**WebSocket** `/ws/workflow/{workflow_id}`

Real-time updates for workflow progress.

**Message Format**:
```json
{
  "type": "workflow.progressed",
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "progress_percentage": 50,
    "current_stage": "auditing"
  }
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Workflow Generation**: 10 requests per minute
- **Contract Generation**: 20 requests per minute
- **Contract Audit**: 30 requests per minute
- **Default**: 100 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message description"
}
```

**HTTP Status Codes**:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Examples

### Complete Workflow Example

```bash
# 1. Login
curl -X POST https://api.hyperagent.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 2. Create Workflow
curl -X POST https://api.hyperagent.dev/api/v1/workflows/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nlp_input": "Create ERC20 token",
    "network": "hyperion_testnet"
  }'

# 3. Check Status
curl https://api.hyperagent.dev/api/v1/workflows/{workflow_id} \
  -H "Authorization: Bearer <token>"
```

## Interactive Documentation

- **Swagger UI**: `/api/v1/docs`
- **ReDoc**: `/api/v1/redoc`
- **OpenAPI JSON**: `/api/v1/openapi.json`

