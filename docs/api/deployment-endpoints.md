# Deployment API Endpoints

Complete API documentation for HyperAgent contract deployment endpoints.

## Authentication

All endpoints require:
- **X-Wallet-Address** header with user's wallet address
- **X402 Payment** verification for x402-enabled networks (Avalanche)

## Base URL

```
Development: http://localhost:8000/api/v1
Production: https://api.hyperagent.xyz/api/v1
```

---

## Deployment Endpoints

### POST /x402/deployments/deploy

Deploy smart contract using server-wallet model (current default).

#### Server-Wallet Deployment

HyperAgent server wallet pays gas and signs deployment transaction. User pays 0.10 USDC service fee.

**Request:**

```json
{
  "compiled_contract": {
    "contract_name": "MyToken",
    "source_code": "pragma solidity ^0.8.0; contract MyToken {...}",
    "bytecode": "0x608060405234801561001057600080fd5b50...",
    "abi": [
      {
        "inputs": [],
        "name": "name",
        "outputs": [{"type": "string"}],
        "stateMutability": "view",
        "type": "function"
      }
    ]
  },
  "network": "avalanche_fuji",
  "wallet_address": "0xYourWalletAddress",
  "use_gasless": true
}
```

**Headers:**

```
Content-Type: application/json
X-Wallet-Address: 0xYourWalletAddress
```

**Response (200 OK):**

```json
{
  "contract_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "transaction_hash": "0x1234567890abcdef...",
  "block_number": 12345678,
  "gas_used": 1500000,
  "deployer": "SERVER_WALLET",
  "gas_paid_by": "server",
  "deployment_method": "server-wallet"
}
```

**Response (402 Payment Required):**

```json
{
  "x402Version": 2,
  "error": "payment_required",
  "price": {
    "amount": "100000",
    "asset": {
      "address": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      "decimals": 6,
      "symbol": "USDC"
    }
  },
  "payTo": "0xMerchantWalletAddress",
  "network": "avalanche_fuji"
}
```

**Response (429 Rate Limit Exceeded):**

```json
{
  "detail": "Rate limit exceeded: max 10 deployments per hour. Retry after 1800 seconds."
}
```

---

### POST /x402/deployments/prepare-user-op

Prepare UserOperation for user-signed deployment (ERC-4337 Account Abstraction).

**Coming Soon**: This endpoint will be available in V2.

#### User-Signed Deployment (V2)

User signs deployment transaction with their Smart Account. HyperAgent paymaster sponsors gas.

**Request:**

```json
{
  "user_smart_account": "0xYourSmartAccountAddress",
  "compiled_contract": {
    "contract_name": "MyToken",
    "source_code": "...",
    "bytecode": "0x608060405234801561001057600080fd5b50...",
    "abi": [...]
  },
  "network": "avalanche_fuji",
  "wallet_address": "0xYourWalletAddress"
}
```

**Response (200 OK):**

```json
{
  "userOp": {
    "sender": "0xYourSmartAccountAddress",
    "nonce": "0x0",
    "initCode": "0x",
    "callData": "0x...",
    "callGasLimit": "0x186a0",
    "verificationGasLimit": "0x186a0",
    "preVerificationGas": "0x5208",
    "maxFeePerGas": "0x59682f00",
    "maxPriorityFeePerGas": "0x3b9aca00",
    "paymasterAndData": "0xPaymasterAddressAndSignature",
    "signature": "0x"
  },
  "paymasterData": {
    "paymaster": "0xPaymasterAddress",
    "sponsor": "hyperagent"
  },
  "estimatedGas": "1500000"
}
```

---

### POST /x402/deployments/submit-user-op

Submit user-signed UserOperation to EntryPoint for deployment.

**Coming Soon**: This endpoint will be available in V2.

**Request:**

```json
{
  "signed_user_op": {
    "sender": "0xYourSmartAccountAddress",
    "nonce": "0x0",
    "initCode": "0x",
    "callData": "0x...",
    "callGasLimit": "0x186a0",
    "verificationGasLimit": "0x186a0",
    "preVerificationGas": "0x5208",
    "maxFeePerGas": "0x59682f00",
    "maxPriorityFeePerGas": "0x3b9aca00",
    "paymasterAndData": "0x...",
    "signature": "0xUserSignatureFromWallet"
  },
  "network": "avalanche_fuji"
}
```

**Response (200 OK):**

```json
{
  "contract_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "transaction_hash": "0x1234567890abcdef...",
  "block_number": 12345678,
  "gas_used": 1500000,
  "deployer": "USER_SMART_ACCOUNT",
  "gas_paid_by": "hyperagent_paymaster",
  "deployment_method": "erc4337"
}
```

---

## Rate Limiting

### GET /x402/deployments/rate-limit

Check remaining deployment allowance for a wallet.

**Headers:**

```
X-Wallet-Address: 0xYourWalletAddress
```

**Query Parameters:**

- `network` (required): Target network (e.g., `avalanche_fuji`)

**Response (200 OK):**

```json
{
  "wallet_remaining": 8,
  "network_remaining": 75,
  "wallet_limit": 10,
  "network_limit": 100,
  "window_seconds": 3600
}
```

---

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | Bad Request | Invalid request body or missing required fields |
| 402 | Payment Required | X402 USDC payment required before deployment |
| 404 | Not Found | Workflow or deployment not found |
| 429 | Rate Limit Exceeded | Too many deployments within time window |
| 500 | Internal Server Error | Server error during deployment |
| 502 | Bad Gateway | X402 payment service unavailable |
| 504 | Gateway Timeout | Deployment transaction timeout (>300s) |

---

## Supported Networks

| Network | ID | Chain ID | X402 Enabled | Gas Token |
|---------|---|----------|--------------|-----------|
| Avalanche Fuji | `avalanche_fuji` | 43113 | Yes | AVAX |
| Avalanche Mainnet | `avalanche_mainnet` | 43114 | Yes | AVAX |
| Mantle Testnet | `mantle_testnet` | 5003 | No | MNT |
| Mantle Mainnet | `mantle_mainnet` | 5000 | No | MNT |

---

## Deployment Flow Diagram

### Server-Wallet Model (Current)

```
User → Connect Wallet → Generate Contract → Review
  ↓
Approve 0.10 USDC Payment (X402)
  ↓
POST /x402/deployments/deploy
  ↓
Payment Verification (X402 Middleware)
  ↓
Rate Limit Check (10/hour per wallet)
  ↓
Server Wallet Signs Transaction
  ↓
Server Wallet Pays Gas (AVAX)
  ↓
Blockchain Confirms Deployment
  ↓
Contract Address Returned
  ↓
Audit Log Created
```

### User-Signed Model (V2 - Coming Soon)

```
User → Connect Smart Account → Generate Contract → Review
  ↓
Approve 0.10 USDC Payment (X402)
  ↓
POST /x402/deployments/prepare-user-op
  ↓
Payment Verification
  ↓
Prepare UserOperation
  ↓
Request Paymaster Sponsorship
  ↓
Return UserOp to Frontend
  ↓
User Signs UserOp in Wallet
  ↓
POST /x402/deployments/submit-user-op
  ↓
EntryPoint Executes UserOp
  ↓
Paymaster Pays Gas (AVAX)
  ↓
Contract Deployed by User's Smart Account
  ↓
Contract Address Returned
```

---

## Examples

### cURL: Server-Wallet Deployment

```bash
curl -X POST https://api.hyperagent.xyz/api/v1/x402/deployments/deploy \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0xYourWalletAddress" \
  -d '{
    "compiled_contract": {
      "contract_name": "SimpleToken",
      "source_code": "pragma solidity ^0.8.0; contract SimpleToken { string public name = \"Simple\"; }",
      "bytecode": "0x608060405234801561001057600080fd5b50...",
      "abi": [{"inputs":[],"name":"name","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"}]
    },
    "network": "avalanche_fuji",
    "wallet_address": "0xYourWalletAddress",
    "use_gasless": true
  }'
```

### Python: Check Rate Limit

```python
import httpx

wallet_address = "0xYourWalletAddress"
network = "avalanche_fuji"

async with httpx.AsyncClient() as client:
    response = await client.get(
        "https://api.hyperagent.xyz/api/v1/x402/deployments/rate-limit",
        headers={"X-Wallet-Address": wallet_address},
        params={"network": network}
    )
    
    rate_limit = response.json()
    print(f"Deployments remaining: {rate_limit['wallet_remaining']}/{rate_limit['wallet_limit']}")
```

### JavaScript/TypeScript: Server-Wallet Deployment

```typescript
const deployContract = async (
  compiledContract: any,
  network: string,
  walletAddress: string
) => {
  const response = await fetch('https://api.hyperagent.xyz/api/v1/x402/deployments/deploy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Wallet-Address': walletAddress
    },
    body: JSON.stringify({
      compiled_contract: compiledContract,
      network: network,
      wallet_address: walletAddress,
      use_gasless: true
    })
  });
  
  if (response.status === 402) {
    const paymentData = await response.json();
    // Handle X402 payment
    console.log('Payment required:', paymentData);
    return null;
  }
  
  return await response.json();
};
```

---

## SDK Support

### Thirdweb SDK (Frontend)

```typescript
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";

const client = createThirdwebClient({ clientId: "YOUR_CLIENT_ID" });
const fetchWithPayment = wrapFetchWithPayment(client, fetch);

// Automatically handles x402 payment popup
const response = await fetchWithPayment(
  'https://api.hyperagent.xyz/api/v1/x402/deployments/deploy',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Wallet-Address': userAddress
    },
    body: JSON.stringify({ ... })
  }
);
```

---

## Security

### Request Signing (Coming Soon)

For additional security, API requests will support optional signing:

```
X-Signature: <ECDSA signature of request body>
X-Timestamp: <Unix timestamp>
```

### Rate Limiting

Rate limits are enforced per wallet and per network:
- **Wallet**: 10 deployments/hour
- **Network**: 100 deployments/hour

Exceeding limits returns HTTP 429 with `Retry-After` header.

### Audit Logging

All deployments are logged with:
- User wallet address
- Server wallet address
- Payment transaction hash
- Deployment transaction hash
- Gas paid by server
- Timestamp

Logs are retained for 7 years for compliance.

---

## Changelog

### V1.0.0 (Current)

- Server-wallet deployment
- X402 payment integration
- Rate limiting
- Avalanche Fuji support
- Deployment audit logging

### V2.0.0 (Coming Q2 2025)

- User-signed deployment (ERC-4337)
- Paymaster gas sponsorship
- Smart Account detection
- User choice UI
- Multi-network expansion

---

## Support

- **Documentation**: https://docs.hyperagent.xyz
- **Discord**: https://discord.gg/hyperagent
- **Email**: support@hyperagent.xyz
- **Status**: https://status.hyperagent.xyz

