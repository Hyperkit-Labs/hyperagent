# HyperAgent Architecture Guide

This document describes HyperAgent's service-oriented architecture, event-driven patterns, workflow orchestration, and detailed flows for ERC4337 Smart Account deployments and x402 payment gating.

## Table of Contents

1. [Service-Oriented Architecture (SOA)](#service-oriented-architecture-soa)
2. [Event-Driven Architecture](#event-driven-architecture)
3. [Workflow Orchestration](#workflow-orchestration)
4. [ERC4337 Deployment Flow](#erc4337-deployment-flow)
5. [x402 Payment Flow](#x402-payment-flow)
6. [Network Support and Configuration](#network-support-and-configuration)

---

## Service-Oriented Architecture (SOA)

### Service Registry Pattern [Adopted]

HyperAgent uses a centralized service registry for service discovery and lookup.

**Implementation**: `hyperagent/architecture/soa.py`

```python
from hyperagent.architecture.soa import ServiceRegistry, SequentialOrchestrator

# Register services
registry = ServiceRegistry()
registry.register("generation", GenerationService(llm_provider))
registry.register("audit", AuditService())
registry.register("deployment", DeploymentService(network_manager))

# Retrieve services
generation_service = registry.get_service("generation")
```

**Key Benefits**:
- Loose coupling between services
- Easy service replacement and testing
- Centralized service metadata

### Sequential Orchestration Pattern [Adopted]

Workflows execute services sequentially, where output of service N becomes input to service N+1.

**Implementation**: `hyperagent/architecture/soa.py::SequentialOrchestrator`

```python
orchestrator = SequentialOrchestrator(registry)

result = await orchestrator.orchestrate(
    services=["generation", "audit", "deployment"],
    input_data={"nlp_description": "Create ERC20 token"},
    progress_callback=update_workflow_status
)
```

**Service Execution Order**:
1. **Generation**: Creates contract from NLP input
2. **Compilation**: Compiles Solidity to bytecode
3. **Audit**: Scans for vulnerabilities
4. **Testing**: Runs unit tests
5. **Deployment**: Deploys to blockchain (or skips for x402 networks)

**Reference**: See `hyperagent/core/orchestrator.py::WorkflowCoordinator` for full implementation.

---

## Event-Driven Architecture

### Redis Streams Event Bus [Adopted]

HyperAgent uses Redis Streams for event-driven communication between services.

**Event Types**: `hyperagent/events/event_types.py`

```python
from hyperagent.events.event_types import Event, EventType

# Publish event
event = Event(
    event_type=EventType.CONTRACT_GENERATED,
    workflow_id=workflow_id,
    data={"contract_code": "...", "abi": "..."}
)
await event_bus.publish(event)

# Consume events
async for event in event_bus.consume(EventType.CONTRACT_GENERATED):
    await process_contract(event.data)
```

**Event Flow**:
1. Service publishes event to Redis Stream
2. Consumers subscribe to event types
3. Events are processed asynchronously
4. Progress callbacks update workflow status

**Benefits**:
- Decoupled service communication
- Event persistence for replay
- Scalable consumer groups

**Reference**: `hyperagent/events/event_bus.py`

---

## Workflow Orchestration

### Workflow Coordinator [Adopted]

The `WorkflowCoordinator` orchestrates the complete workflow pipeline from contract generation to deployment.

**Implementation**: `hyperagent/core/orchestrator.py`

**Workflow States**:
- `PENDING`: Workflow created, not started
- `PROCESSING`: Currently executing services
- `COMPLETED`: All services completed successfully
- `FAILED`: Service failed, workflow stopped
- `CANCELLED`: User cancelled workflow

**Progress Tracking**:
- Progress percentage: 0-100%
- Status updates via WebSocket or polling
- Metadata includes service results and errors

**Example Workflow Execution**:
```python
coordinator = WorkflowCoordinator(
    service_registry=registry,
    event_bus=event_bus,
    db=db_session
)

workflow_result = await coordinator.execute_workflow(
    workflow_id=workflow_id,
    input_data={
        "nlp_description": "Create ERC20 token with 1M supply",
        "network": "avalanche_fuji",
        "wallet_address": "0x123..."
    }
)
```

---

## ERC4337 Deployment Flow

HyperAgent supports ERC4337 Smart Account deployments on x402 networks (e.g., Avalanche Fuji). Users sign transactions directly in their wallets; no backend private keys are required.

### Step-by-Step Flow

#### Step 1: User Initiates Workflow
**Frontend**: User submits contract generation request via `frontend/app/avax/studio/page.tsx`

```typescript
const response = await fetch(`${API_BASE_URL}/x402/workflows/create`, {
  method: 'POST',
  body: JSON.stringify({
    nlp_description: "Create ERC20 token",
    network: "avalanche_fuji",
    wallet_address: account.address
  })
});
```

#### Step 2: Backend Generates and Compiles Contract
**Backend**: `hyperagent/api/routes/x402/workflows.py::create_workflow_from_contract`

- Generation service creates contract code
- Compilation service compiles to bytecode
- Audit service scans for vulnerabilities
- Contract stored in database with workflow

#### Step 3: DeploymentService Detects x402 Network
**Backend**: `hyperagent/core/services/deployment_service.py::process`

```python
# Check if network is x402-enabled
is_x402_network = network in enabled_networks and settings.x402_enabled

if is_x402_network and not signed_transaction:
    # Skip deployment, return metadata
    return {
        "status": "skipped",
        "deployment_skipped": True,
        "requires_user_signature": True,
        "message": "Deployment requires user wallet signature"
    }
```

#### Step 4: Workflow Marked as Completed with Metadata
**Backend**: `hyperagent/api/routes/workflows.py::update_workflow_and_persist_contracts`

```python
if deployment_result.get("deployment_skipped"):
    workflow.status = WorkflowStatus.COMPLETED.value
    workflow.metadata = {
        "deployment_status": "pending",
        "deployment_skipped": True,
        "requires_user_signature": True
    }
```

#### Step 5: Frontend Polls Workflow Status
**Frontend**: `frontend/app/avax/studio/page.tsx::pollWorkflowStatus`

```typescript
const status = await fetch(`${API_BASE_URL}/workflows/${workflowId}`);
const metadata = status.metadata || {};

if (metadata.deployment_skipped || metadata.requires_user_signature) {
  // Automatically trigger deployment signing
  await handleDeploymentSigning(workflowId, network);
}
```

#### Step 6: Frontend Calls Prepare Deployment Endpoint
**Frontend**: `frontend/app/avax/studio/page.tsx::handleDeploymentSigning`

```typescript
const prepareResponse = await fetch(
  `${API_BASE_URL}/x402/deployments/prepare`,
  {
    method: 'POST',
    body: JSON.stringify({
      compiled_contract: {
        abi: contract.abi,
        bytecode: contract.bytecode
      },
      network: network,
      wallet_address: account.address,
      constructor_args: []
    })
  }
);

const { transaction_data } = await prepareResponse.json();
const unsignedTransaction = transaction_data.transaction;
```

**Backend**: `hyperagent/api/routes/x402/deployments.py::prepare_deployment`

- Validates payment (x402 middleware)
- Calls `DeploymentService.prepare_deployment_transaction()`
- Returns unsigned transaction for user to sign

#### Step 7: Frontend Signs Transaction via Thirdweb SDK
**Frontend**: `frontend/app/avax/studio/page.tsx::handleDeploymentSigning`

```typescript
import { sendTransaction } from 'thirdweb';
import { avalancheFuji } from 'thirdweb/chains';

// Thirdweb SDK handles Smart Account signing automatically
const receipt = await sendTransaction({
  account: account,
  transaction: unsignedTransaction,
  chain: avalancheFuji
});
```

**Note**: Thirdweb SDK detects if the account is an ERC4337 Smart Account and handles the signing flow accordingly. User is prompted to sign in their wallet (Core, MetaMask, etc.).

#### Step 8: Frontend Calls Deploy Endpoint with Signed Transaction
**Frontend**: `frontend/app/avax/studio/page.tsx::handleDeploymentSigning`

```typescript
const deployResponse = await fetch(
  `${API_BASE_URL}/x402/deployments/deploy`,
  {
    method: 'POST',
    body: JSON.stringify({
      compiled_contract: {
        abi: contract.abi,
        bytecode: contract.bytecode
      },
      network: network,
      wallet_address: account.address,
      signed_transaction: signedTxHash,
      use_gasless: false
    })
  }
);
```

**Backend**: `hyperagent/api/routes/x402/deployments.py::deploy_with_payment`

- Validates payment (x402 middleware)
- Calls `DeploymentService._deploy_with_signed_transaction()`
- Broadcasts transaction to network
- Returns deployment result with contract address and transaction hash

#### Step 9: Backend Broadcasts Transaction and Updates Workflow
**Backend**: `hyperagent/core/services/deployment_service.py::_deploy_with_signed_transaction`

```python
# Broadcast signed transaction
tx_hash = await network_manager.broadcast_transaction(
    signed_transaction=signed_transaction,
    network=network
)

# Wait for confirmation
receipt = await network_manager.wait_for_transaction(
    tx_hash=tx_hash,
    network=network
)

# Store deployment record
deployment = Deployment(
    workflow_id=workflow_id,
    contract_address=receipt.contractAddress,
    transaction_hash=tx_hash,
    block_number=receipt.blockNumber
)
```

#### Step 10: Frontend Calls Complete Deployment Endpoint
**Frontend**: `frontend/app/avax/studio/page.tsx::handleDeploymentSigning`

```typescript
await fetch(`${API_BASE_URL}/x402/workflows/complete-deployment`, {
  method: 'POST',
  body: JSON.stringify({
    workflow_id: workflowId,
    signed_transaction: signedTxHash,
    wallet_address: account.address
  })
});
```

**Backend**: `hyperagent/api/routes/x402/workflows.py::complete_workflow_deployment`

- Clears `deployment_skipped` metadata flags
- Updates workflow status to fully completed
- Returns final deployment response

#### Error Handling

**Network Failures**:
- Frontend implements exponential backoff for retries
- Timeout handling (30s default)
- Health check before retrying after multiple failures

**Signature Rejections**:
- User cancels signing: Frontend shows error, workflow remains in "pending deployment" state
- Invalid signature: Backend returns 400 error, frontend retries prepare step

**Transaction Failures**:
- Transaction reverts: Backend logs error, frontend shows error message
- Network congestion: Frontend retries with higher gas (if supported)

**Reference Files**:
- Backend: `hyperagent/core/services/deployment_service.py`, `hyperagent/api/routes/x402/deployments.py`, `hyperagent/api/routes/x402/workflows.py`
- Frontend: `frontend/app/avax/studio/page.tsx`

---

## x402 Payment Flow

HyperAgent uses x402 payment gating for contract generation and deployment on x402-enabled networks. Users pay in USDC via their Core Wallet before accessing services.

### Step-by-Step Flow

#### Step 1: User Requests Service
**Frontend**: User initiates contract generation or deployment

```typescript
const response = await fetch(`${API_BASE_URL}/x402/contracts/generate`, {
  method: 'POST',
  headers: {
    'x-wallet-address': account.address
  },
  body: JSON.stringify({
    nlp_description: "Create ERC20 token",
    network: "avalanche_fuji",
    contract_type: "ERC20"
  })
});
```

#### Step 2: Backend x402 Middleware Checks Payment
**Backend**: `hyperagent/api/middleware/x402.py::X402Middleware.verify_and_handle_payment`

```python
# Check spending controls (daily limits, whitelist, etc.)
allowed, error = await self.check_spending_controls(
    db=db,
    wallet_address=wallet_address,
    amount=price_usdc,
    merchant=merchant
)

if not allowed:
    return JSONResponse(
        status_code=403,
        content={"error": error}
    )

# Call x402-verifier service to verify payment
result = await self._call_x402_service(
    wallet_address=wallet_address,
    endpoint=endpoint,
    network=network,
    price=str(price_usdc)
)
```

#### Step 3: x402-Verifier Service Checks Payment Status
**Service**: `services/x402-verifier/src/index.ts::/settle-payment`

- Checks if user has approved USDC spend for merchant
- Validates spending controls (if configured)
- Returns payment status

**Response Codes**:
- `200`: Payment verified, proceed
- `402`: Payment required, user must approve spend
- `502/503/504`: Settlement service error, retry later

#### Step 4: If Unpaid, Backend Returns 402 Payment Required
**Backend**: `hyperagent/api/middleware/x402.py`

```python
if result.get("status") == 402:
    response_body = result.get("responseBody")  # JWT token or dict
    
    return JSONResponse(
        status_code=402,
        content={
            "x402_token": response_body,  # JWT token for frontend
            "error": "Payment Required",
            "price_usdc": price_usdc,
            "network": network
        }
    )
```

#### Step 5: Frontend Displays Payment Modal
**Frontend**: `frontend/lib/payment.ts::createFetchWithPayment`

```typescript
// Intercept 402 response
if (response.status === 402) {
  const data = await response.json();
  const x402Token = data.x402_token;
  
  // Show payment modal
  await handlePayment(wallet, x402Token, amount);
  
  // Retry original request after payment
  return await fetch(url, options);
}
```

#### Step 6: User Approves USDC Spend via Core Wallet
**Frontend**: `frontend/lib/payment.ts::handlePayment`

- User connects Core Wallet (if not connected)
- User approves USDC spend for merchant address
- Transaction is signed and broadcast
- Frontend waits for transaction confirmation

#### Step 7: Frontend Retries Original Request
**Frontend**: After payment is confirmed, frontend retries the original request

```typescript
// Payment approved, retry request
const retryResponse = await fetch(url, {
  ...options,
  headers: {
    ...options.headers,
    'x-payment-tx-hash': paymentTxHash  // Proof of payment
  }
});
```

#### Step 8: Backend x402-Verifier Validates Payment
**Backend**: x402-verifier service validates that payment transaction is confirmed

```typescript
// x402-verifier checks on-chain transaction
const paymentTx = await getTransaction(paymentTxHash);
if (paymentTx && paymentTx.status === 'confirmed') {
  return { status: 200, verified: true };
}
```

#### Step 9: Request Proceeds to Service
**Backend**: If payment verified, request proceeds to generation/deployment service

```python
if payment_response is None:  # Payment verified
    return await _generate_contract_internal(request, db)
```

#### Step 10: Payment Logged in Database
**Backend**: `hyperagent/api/middleware/x402.py::log_payment`

```python
payment_record = PaymentHistory(
    wallet_address=wallet_address,
    amount=price_usdc,
    network=network,
    endpoint=endpoint,
    transaction_hash=transaction_hash,
    merchant=merchant
)
db.add(payment_record)
await db.commit()
```

### Error Handling

**Payment Failures**:
- User rejects payment: Frontend shows error, user can retry
- Insufficient USDC balance: Frontend shows error with required amount
- Network errors: Frontend retries with exponential backoff

**Settlement Service Errors (502/503/504)**:
- Backend returns error response
- Frontend shows: "Settlement service temporarily unavailable, please try again"
- Frontend implements retry logic with backoff

**Spending Control Violations**:
- Daily limit exceeded: Backend returns 403 with error message
- Merchant not whitelisted: Backend returns 403
- Time restrictions: Backend returns 403 if outside allowed hours

**Reference Files**:
- Backend: `hyperagent/api/middleware/x402.py`, `hyperagent/api/routes/x402/contracts.py`, `hyperagent/api/routes/x402/deployments.py`
- Service: `services/x402-verifier/src/index.ts`
- Frontend: `frontend/lib/payment.ts`, `frontend/app/avax/studio/page.tsx`

---

## Network Support and Configuration

### Supported Networks [Adopted]

| Network | Chain ID | x402 Enabled | ERC4337 Support |
|---------|----------|--------------|-----------------|
| Avalanche Fuji (Testnet) | 43113 | Yes | Yes |
| Avalanche Mainnet | 43114 | Yes | Yes |
| Hyperion Testnet | 133717 | No | No |
| Mantle Testnet | 5003 | No | No |

### Network Configuration

**Environment Variables**:
```bash
# x402 Configuration
X402_ENABLED=true
X402_ENABLED_NETWORKS=avalanche_fuji,avalanche_mainnet
X402_SERVICE_URL=http://x402-verifier:3001

# Network RPC URLs
AVALANCHE_FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_MAINNET_RPC=https://api.avax.network/ext/bc/C/rpc

# USDC Addresses
USDC_ADDRESS_FUJI=0x5425890298aed601595a70AB815c96711a31Bc65
USDC_ADDRESS_AVALANCHE=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
```

**Network Detection**: `hyperagent/blockchain/network_features.py`

```python
from hyperagent.blockchain.network_features import NetworkFeatures

features = NetworkFeatures.get_network_features("avalanche_fuji")
if features.supports_x402:
    # Use x402 payment flow
    pass
if features.supports_erc4337:
    # Use ERC4337 Smart Account deployment
    pass
```

---

## Additional Resources

- [Engineering Standards](./ENGINEERING_STANDARDS.md) - Coding conventions and patterns
- [DevOps & SRE Guide](./DEVOPS_SRE_GUIDE.md) - Infrastructure and monitoring
- [Delivery Process](./DELIVERY_PROCESS.md) - Sprint structure and release process
- [x402 Architecture Documentation](../docs/X402_ARCHITECTURE.md) - Detailed x402 implementation (if exists)
- [Service Registry Implementation](../hyperagent/architecture/soa.py) - SOA pattern code

