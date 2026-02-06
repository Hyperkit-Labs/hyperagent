# Mantle SDK Bridge Service

HTTP bridge service for Mantle SDK cross-chain operations. Enables Python backend to interact with Mantle SDK (TypeScript) for L1↔L2 bridging.

## Features

- ERC20 token deposits (L1→L2)
- ERC20 token withdrawals (L2→L1)
- Cross-chain message status tracking
- Gas estimation for L2 transactions
- Contract deployment with cross-chain support

## Setup

### Development

```bash
npm install
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t mantle-bridge .
docker run -p 3003:3003 mantle-bridge
```

## Environment Variables

```bash
# Network configuration
MANTLE_NETWORK=mantle_testnet # or mantle_mainnet
PORT=3003

# RPC URLs
RPC_URL_ETHEREUM_SEPOLIA=https://rpc.sepolia.org
RPC_URL_MANTLE_TESTNET=https://rpc.sepolia.mantle.xyz
RPC_URL_ETHEREUM_MAINNET=https://eth.llamarpc.com
RPC_URL_MANTLE_MAINNET=https://rpc.mantle.xyz

# Logging
LOG_LEVEL=info

# CORS
CORS_ORIGINS=http://localhost:8000,http://localhost:3000
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "mantle-bridge",
  "network": "mantle_testnet",
  "l1": {
    "chainId": 11155111,
    "blockNumber": 1234567,
    "rpcUrl": "https://rpc.sepolia.org"
  },
  "l2": {
    "chainId": 5003,
    "blockNumber": 7890123,
    "rpcUrl": "https://rpc.sepolia.mantle.xyz"
  }
}
```

### Deposit ERC20

```bash
POST /deposit-erc20
Content-Type: application/json

{
  "l1TokenAddress": "0x...",
  "l2TokenAddress": "0x...",
  "amount": "1000000000000000000",
  "privateKey": "0x..."
}
```

### Withdraw ERC20

```bash
POST /withdraw-erc20
Content-Type: application/json

{
  "l1TokenAddress": "0x...",
  "l2TokenAddress": "0x...",
  "amount": "1000000000000000000",
  "privateKey": "0x..."
}
```

### Wait for Message Status

```bash
POST /wait-for-message-status
Content-Type: application/json

{
  "txHash": "0x...",
  "targetStatus": "RELAYED"
}
```

Valid statuses:
- UNCONFIRMED_L1_TO_L2_MESSAGE
- FAILED_L1_TO_L2_MESSAGE
- STATE_ROOT_NOT_PUBLISHED
- READY_TO_PROVE
- IN_CHALLENGE_PERIOD
- READY_FOR_RELAY
- RELAYED

### Estimate Gas

```bash
POST /estimate-gas
Content-Type: application/json

{
  "from": "0x...",
  "to": "0x...",
  "data": "0x..."
}
```

### Deploy with Cross-Chain

```bash
POST /deploy-with-cross-chain
Content-Type: application/json

{
  "bytecode": "0x...",
  "abi": [...],
  "constructorArgs": [],
  "l1PrivateKey": "0x...",
  "l2PrivateKey": "0x..."
}
```

## Integration with Python Backend

```python
from hyperagent.blockchain.mantle_sdk import MantleSDKClient

# Initialize client
client = MantleSDKClient(network="mantle_testnet")

# Deposit ERC20
result = await client.deposit_erc20(
    l1_token_address="0x...",
    l2_token_address="0x...",
    amount="1000000000000000000",
    private_key="0x..."
)

# Deploy contract
result = await client.deploy_with_cross_chain(
    bytecode="0x...",
    abi=[...],
    constructor_args=[],
    l1_private_key="0x...",
    l2_private_key="0x..."
)
```

## Docker Compose Integration

```yaml
mantle-bridge:
  image: hyperagent-mantle-bridge:latest
  build:
    context: .
    dockerfile: services/mantle-bridge/Dockerfile
  container_name: hyperagent_mantle_bridge
  ports:
    - "3003:3003"
  environment:
    - MANTLE_NETWORK=${MANTLE_NETWORK:-mantle_testnet}
    - RPC_URL_ETHEREUM_SEPOLIA=${RPC_URL_ETHEREUM_SEPOLIA}
    - RPC_URL_MANTLE_TESTNET=${RPC_URL_MANTLE_TESTNET}
    - LOG_LEVEL=${LOG_LEVEL:-info}
  networks:
    - hyperagent_network
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get('http://localhost:3003/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

## Security Considerations

1. Private keys are passed in request bodies - use HTTPS in production
2. Consider implementing request signing/authentication
3. Rate limit endpoints to prevent abuse
4. Validate all inputs before processing
5. Use environment variables for sensitive configuration
6. Monitor for suspicious activity

## Testing

```bash
# Unit tests
npm test

# Integration tests (requires running Ethereum and Mantle nodes)
npm run test:integration

# Health check
curl http://localhost:3003/health
```

## Troubleshooting

### Service won't start
- Check RPC URLs are accessible
- Verify Ethereum and Mantle nodes are reachable
- Check port 3003 is not in use

### Deposit/Withdrawal fails
- Verify wallet has sufficient balance for gas
- Check token addresses are correct
- Ensure private key has permission to transfer tokens
- Verify network is correct (testnet vs mainnet)

### Message status timeout
- Cross-chain messages can take 10-30 minutes
- Increase timeout for production use
- Check message hash is correct

## References

- [Mantle SDK Documentation](https://docs.mantle.xyz/network/for-developers/how-to-guides/how-to-use-mantle-sdk)
- [Mantle Network](https://mantle.xyz)
- [EigenDA](https://docs.eigencloud.xyz)

