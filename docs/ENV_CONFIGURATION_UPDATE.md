# .env.example Configuration Update Guide

This document outlines the required changes to `.env.example` after migrating network, pricing, and token configurations to YAML files.

## Summary of Changes

1. **Remove**: Network RPC URLs, USDC addresses, and pricing configs (moved to YAML)
2. **Add**: Missing Pinata environment variables
3. **Keep**: API keys, secrets, and service-specific settings

---

## Variables to REMOVE from .env.example

These are now configured in YAML files under `config/`:

### Network RPC URLs (now in config/networks.yaml)
```bash
# REMOVE - These are in config/networks.yaml
# RPC_URL_AVALANCHE_FUJI=
# RPC_URL_AVALANCHE_MAINNET=
# RPC_URL_MANTLE_TESTNET=
# RPC_URL_MANTLE_MAINNET=
# RPC_URL_BASE_SEPOLIA=
# RPC_URL_BASE_MAINNET=
# RPC_URL_ARBITRUM_SEPOLIA=
# RPC_URL_ARBITRUM_ONE=
# RPC_URL_OPTIMISM_SEPOLIA=
# RPC_URL_OPTIMISM_MAINNET=
# RPC_URL_POLYGON_AMOY=
# RPC_URL_POLYGON_MAINNET=
# RPC_URL_ETHEREUM_SEPOLIA=
# RPC_URL_ETHEREUM_MAINNET=
# RPC_URL_BNB_TESTNET=
# RPC_URL_BNB_MAINNET=
# RPC_URLS={}  # JSON string of network ID to RPC URL mappings
```

### USDC Addresses (now in config/tokens.yaml)
```bash
# REMOVE - These are in config/tokens.yaml
# usdc_address_fuji=
# usdc_address_avalanche=
# usdc_address_mantle_testnet=
# usdc_address_mantle_mainnet=
# usdc_address_base_sepolia=
# usdc_address_base_mainnet=
# usdc_address_arbitrum_sepolia=
# usdc_address_arbitrum_one=
# usdc_address_optimism_sepolia=
# usdc_address_optimism_mainnet=
# usdc_address_polygon_amoy=
# usdc_address_polygon_mainnet=
# usdc_address_ethereum_sepolia=
# usdc_address_ethereum_mainnet=
# usdc_address_bnb_testnet=
# usdc_address_bnb_mainnet=
```

### Pricing Configuration (now in config/pricing.yaml)
```bash
# REMOVE - These are in config/pricing.yaml
# x402_price_tiers={"ERC20": 0.01, "ERC721": 0.02, "Custom": 0.15, "basic": 0.01, "advanced": 0.02, "deployment": 0.10}
# X402_CONTRACT_PRICE_USDC=0.01
# X402_WORKFLOW_PRICE_USDC=0.02
# X402_DEPLOY_PRICE_USDC=0.10
```

---

## Variables to ADD to .env.example

### Pinata Configuration (IPFS/Storage)
```bash
# ----------------------------------------------------------------------------
# Pinata (IPFS Storage)
# ----------------------------------------------------------------------------
# Pinata API credentials for decentralized storage
PINATA_API_KEY=
PINATA_API_SECRET=

# Optional: Pinata organizational identifiers
PINATA_TEAM_ID=
PINATA_COMMUNITY_ID=
PINATA_TEMPLATE_ID=
```

---

## Variables to KEEP in .env.example

Keep these as they are secrets or service-specific settings:

### Core Infrastructure
```bash
# Application
APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://hyperagent_user:secure_password@localhost:5432/hyperagent_db

# Redis
REDIS_URL=redis://localhost:6379/0
```

### API Keys & Secrets
```bash
# AI/LLM APIs
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
TOGETHER_API_KEY=

# Thirdweb (Blockchain)
THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=
THIRDWEB_SERVER_WALLET_ADDRESS=
THIRDWEB_SERVER_WALLET_PRIVATE_KEY=

# Pinecone (Vector DB)
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
PINECONE_INDEX_NAME=

# Chroma (Alternative Vector DB)
CHROMA_HOST=
CHROMA_PORT=
```

### Multi-Cloud Platform (MCP)
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=hyperagent_mcp

# Netlify
NETLIFY_AUTH_TOKEN=

# Railway
RAILWAY_TOKEN=

# Render
RENDER_API_KEY=
RENDER_OWNER_ID=

# Postman
POSTMAN_API_KEY=
```

### x402 Configuration
```bash
# x402 (Payment Protocol)
X402_ENABLED=false
MERCHANT_WALLET_ADDRESS=
```

---

## ERC-4337 vs EIP-7702 Support

### Current Implementation: ERC-4337 (Account Abstraction)

The x402 verifier currently uses **ERC-4337** via Thirdweb's SDK:
- Uses UserOperations and EntryPoint contracts
- Supports gasless transactions via facilitator
- Production-ready on multiple networks

### EIP-7702 Support (Requested)

**EIP-7702** ("Set EOA account code for one transaction") is a newer proposal that:
- Allows EOAs to temporarily act like smart contracts
- Different from ERC-4337 (not a replacement, complementary)
- Still in proposal/early adoption phase

**Status**: Not currently implemented in Thirdweb x402 SDK or HyperAgent.

**To Add EIP-7702 Support**, we would need to:

1. Wait for Thirdweb SDK to support EIP-7702, OR
2. Implement custom EIP-7702 handler alongside existing ERC-4337
3. Add network detection to route to appropriate standard

```typescript
// Proposed architecture (not yet implemented)
export interface AccountAbstractionStrategy {
  type: 'ERC4337' | 'EIP7702';
  facilitator: any;
}

export const getAAStrategy = (network: string): AccountAbstractionStrategy => {
  const networkConfig = getNetwork(network);
  
  // Check if network supports EIP-7702
  if (networkConfig?.features?.eip7702) {
    return {
      type: 'EIP7702',
      facilitator: createEIP7702Facilitator(network),
    };
  }
  
  // Default to ERC-4337
  return {
    type: 'ERC4337',
    facilitator: thirdwebFacilitator,
  };
};
```

**Recommendation**: 
- Keep ERC-4337 as primary (production-ready)
- Monitor EIP-7702 adoption and Thirdweb support
- Add feature flag in `config/networks.yaml` for future EIP-7702 networks:

```yaml
networks:
  experimental_network:
    chain_id: 12345
    rpc_urls:
      - https://rpc.example.com
    features:
      erc4337: true
      eip7702: true  # Future support
```

---

## Migration Checklist

- [ ] Remove all RPC URL environment variables
- [ ] Remove all USDC address environment variables
- [ ] Remove x402 pricing environment variables
- [ ] Add Pinata API keys section
- [ ] Add Pinata organizational IDs section
- [ ] Keep all API keys and secrets
- [ ] Keep database and service URLs
- [ ] Add comment noting network configs are in YAML
- [ ] Update docker-compose.yml to use placeholder for THIRDWEB_SERVER_WALLET_ADDRESS
- [ ] Document EIP-7702 future support plan

---

## Complete .env.example Template

```bash
# Application
APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO

# ----------------------------------------------------------------------------
# Core Infrastructure
# ----------------------------------------------------------------------------

# Database
DATABASE_URL=postgresql://hyperagent_user:secure_password@localhost:5432/hyperagent_db

# Redis
REDIS_URL=redis://localhost:6379/0

# ----------------------------------------------------------------------------
# AI/LLM Providers
# ----------------------------------------------------------------------------

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
TOGETHER_API_KEY=

# ----------------------------------------------------------------------------
# Blockchain & Web3
# ----------------------------------------------------------------------------

# Thirdweb
THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=
THIRDWEB_SERVER_WALLET_ADDRESS=
THIRDWEB_SERVER_WALLET_PRIVATE_KEY=

# Note: Network RPC URLs are configured in config/networks.yaml
# Note: Token addresses (USDC, etc.) are configured in config/tokens.yaml

# ----------------------------------------------------------------------------
# Vector Databases
# ----------------------------------------------------------------------------

# Pinecone
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
PINECONE_INDEX_NAME=

# Chroma (Alternative)
CHROMA_HOST=http://localhost:8000
CHROMA_PORT=8000

# ----------------------------------------------------------------------------
# Storage & IPFS
# ----------------------------------------------------------------------------

# Pinata (IPFS Storage)
PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_TEAM_ID=
PINATA_COMMUNITY_ID=
PINATA_TEMPLATE_ID=

# ----------------------------------------------------------------------------
# x402 Payment Protocol
# ----------------------------------------------------------------------------

# Note: Pricing configuration is in config/pricing.yaml
X402_ENABLED=false
MERCHANT_WALLET_ADDRESS=

# ----------------------------------------------------------------------------
# Multi-Cloud Platform (MCP)
# ----------------------------------------------------------------------------

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=hyperagent_mcp

# Netlify
NETLIFY_AUTH_TOKEN=

# Railway
RAILWAY_TOKEN=

# Render
RENDER_API_KEY=
RENDER_OWNER_ID=

# Postman
POSTMAN_API_KEY=

# ----------------------------------------------------------------------------
# Monitoring & Observability
# ----------------------------------------------------------------------------

# MLflow
MLFLOW_TRACKING_URI=http://localhost:5000

# Prometheus
PROMETHEUS_PORT=9090
```

---

## Next Steps

1. **Manual Update**: Since `.env.example` is in `.gitignore`, manually update it using this template
2. **Team Alignment**: Share this doc with team to ensure everyone updates their local `.env`
3. **CI/CD**: Update deployment scripts to reference YAML configs instead of env vars
4. **Documentation**: Update main README to reference YAML configuration architecture
5. **EIP-7702**: Track Thirdweb SDK updates for EIP-7702 support, add when available

---

## Related Documentation

- [YAML Configuration Architecture](./YAML_CONFIG_ARCHITECTURE.md)
- [Config Migration Summary](./CONFIG_MIGRATION_SUMMARY.md)
- [MCP Configuration](./MCP_CONFIGURATION.md)
- [Network Features](../config/networks.yaml)
- [Token Addresses](../config/tokens.yaml)
- [Pricing Configuration](../config/pricing.yaml)

