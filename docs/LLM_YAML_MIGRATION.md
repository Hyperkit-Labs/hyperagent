# LLM Configuration YAML Migration Guide

Last updated: 2025-01-28

## Overview

LLM configuration has been migrated from environment variables to YAML files for better maintainability, scalability, and separation of sensitive and non-sensitive data.

## Migration Principle

**Sensitive data (API keys, private keys)** → `.env` file  
**Public configuration (model names, timeouts, routing)** → `config/llm.yaml`

## What Was Moved

### From `.env` to `config/llm.yaml`

The following variables are **no longer needed in `.env`**:

```bash
# REMOVE THESE FROM .env (now in config/llm.yaml)
GEMINI_MODEL=gemini-2.5-flash
GEMINI_THINKING_BUDGET=
OPENAI_MODEL=gpt-4o
```

### What Stays in `.env`

Only **sensitive API keys** remain in `.env`:

```bash
# KEEP THESE IN .env (sensitive keys)
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
CLAUDE_API_KEY=your_claude_api_key
```

## New LLM Configuration File

All LLM settings are now in `config/llm.yaml`:

```yaml
providers:
  gemini:
    enabled: true
    priority: 1  # Primary provider
    models:
      default: "gemini-2.5-flash"
    generation:
      temperature: 0.3
      max_output_tokens: 8000
      timeout_seconds: 120
  
  openai:
    enabled: true
    priority: 2  # Fallback provider
    models:
      default: "gpt-4o"
    generation:
      temperature: 0.3
      max_tokens: 8000
      timeout_seconds: 120
```

## Wallet Address Migration

### From `.env` to `config/deployment.yaml`

**Public wallet addresses** (not private keys) moved to YAML:

```bash
# REMOVE FROM .env (now in config/deployment.yaml)
MERCHANT_WALLET_ADDRESS=0xa43b752b6e941263eb5a7e3b96e2e0dea1a586ff
THIRDWEB_SERVER_WALLET_ADDRESS=0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
FACTORY_ADDRESS=0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2
```

### What Stays in `.env`

**Private keys** remain in `.env` (sensitive):

```bash
# KEEP IN .env (sensitive private key)
DEPLOYER_PRIVATE_KEY=0x...
PRIVATE_KEY=0x...  # Legacy alias
THIRDWEB_SECRET_KEY=your_secret_key
```

## New Wallet Configuration in `config/deployment.yaml`

```yaml
wallets:
  # Merchant wallet for receiving x402 payments (public address)
  merchant:
    address: "0xa43b752b6e941263eb5a7e3b96e2e0dea1a586ff"
    description: "Receives x402 payments from workflow operations"
    networks: ["*"]
  
  # Server wallet (public address for reference only)
  server_deployer:
    address: "0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2"
    description: "Server wallet for contract deployment"
  
  # ERC-4337 addresses
  erc4337:
    entrypoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    factory: "0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2"
```

## How to Use New Configuration

### Python Backend

```python
from hyperagent.core.config_loader import (
    get_primary_llm_provider,
    get_llm_provider_config,
    get_merchant_wallet_address
)

# Get primary LLM provider
provider = get_primary_llm_provider()  # Returns "gemini"

# Get provider-specific config
config = get_llm_provider_config("gemini")
model = config["models"]["default"]  # "gemini-2.5-flash"
temperature = config["generation"]["temperature"]  # 0.3

# Get merchant wallet address
merchant = get_merchant_wallet_address()  # "0xa43b..."
```

### TypeScript API

```typescript
import {
  getPrimaryLLMProvider,
  getLLMProviderConfig,
  getMerchantWalletAddress
} from "./config/configLoader";

// Get primary LLM provider
const provider = getPrimaryLLMProvider(); // Returns "gemini"

// Get provider-specific config
const config = getLLMProviderConfig("gemini");
const model = config.models.default; // "gemini-2.5-flash"
const temperature = config.generation.temperature; // 0.3

// Get merchant wallet address
const merchant = getMerchantWalletAddress(); // "0xa43b..."
```

## Benefits of YAML Configuration

1. **Security**: API keys stay in `.env`, configuration in version control
2. **Scalability**: Easy to add new LLM providers without code changes
3. **Maintainability**: Centralized configuration for all services
4. **Flexibility**: Change providers, models, or routing without touching code
5. **Documentation**: YAML files are self-documenting with comments

## Migration Checklist

- [x] Create `config/llm.yaml` with provider configurations
- [x] Update `config/deployment.yaml` with wallet addresses
- [x] Update Python `config_loader.py` with LLM methods
- [x] Update TypeScript `configLoader.ts` with LLM methods
- [ ] **Clean up your `.env` file**:
  - Remove `GEMINI_MODEL`
  - Remove `GEMINI_THINKING_BUDGET`
  - Remove `OPENAI_MODEL`
  - Remove `MERCHANT_WALLET_ADDRESS`
  - Remove `ENTRYPOINT_ADDRESS`
  - Remove `FACTORY_ADDRESS`
  - Remove `THIRDWEB_SERVER_WALLET_ADDRESS` (if not used elsewhere)
- [ ] Keep only API keys and private keys in `.env`
- [ ] Restart all services: `docker compose restart`

## Update Your `.env` File

Remove these lines from your `.env`:

```bash
GEMINI_MODEL=gemini-2.5-flash
GEMINI_THINKING_BUDGET=
OPENAI_MODEL=gpt-4o
MERCHANT_WALLET_ADDRESS=0xa43b752b6e941263eb5a7e3b96e2e0dea1a586ff
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
FACTORY_ADDRESS=0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2
```

## Example Updated `.env`

Your `.env` should now look like:

```bash
# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL=postgresql://...

# ============================================================================
# LLM API KEYS (Sensitive - Keep in .env)
# ============================================================================
GEMINI_API_KEY=your_actual_gemini_api_key
OPENAI_API_KEY=your_actual_openai_api_key
ANTHROPIC_API_KEY=your_actual_anthropic_api_key

# ============================================================================
# THIRDWEB (Sensitive - Keep in .env)
# ============================================================================
THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key

# ============================================================================
# DEPLOYMENT (Sensitive - Keep in .env)
# ============================================================================
DEPLOYER_PRIVATE_KEY=0x...
```

## Testing After Migration

```bash
# Test Python config loading
docker compose exec hyperagent python -c "from hyperagent.core.config_loader import get_primary_llm_provider, get_merchant_wallet_address; print(f'Primary provider: {get_primary_llm_provider()}'); print(f'Merchant wallet: {get_merchant_wallet_address()}')"

# Restart services
docker compose restart hyperagent ts-orchestrator

# Test workflow creation
hyperagent workflow create --interactive
```

## Troubleshooting

### Error: "Failed to load config file llm.yaml"

Make sure `config/llm.yaml` exists and is mounted in Docker:

```yaml
# docker-compose.yml
services:
  hyperagent:
    volumes:
      - ./config:/app/config:ro  # This line should exist
```

### Error: "API key not valid"

API keys are still read from `.env`. Verify your `.env` has valid keys:

```bash
# Check keys are present
grep "GEMINI_API_KEY" .env
grep "OPENAI_API_KEY" .env
```

### LLM provider not found

Check `config/llm.yaml` has the provider enabled:

```yaml
providers:
  gemini:
    enabled: true  # Must be true
    priority: 1    # Lower number = higher priority
```

## Documentation

For full LLM configuration options, see:
- `config/llm.yaml` - Inline comments explain all settings
- `docs/YAML_CONFIG_ARCHITECTURE.md` - Complete architecture guide
- `docs/PROPOSED_YAML_ARCHITECTURE.md` - Future enhancements

## Support

If you encounter issues after migration:

1. Check Docker logs: `docker compose logs hyperagent ts-orchestrator`
2. Verify YAML syntax: `python -c "import yaml; yaml.safe_load(open('config/llm.yaml'))"`
3. Restart services: `docker compose restart`
4. Review this guide: `docs/LLM_YAML_MIGRATION.md`

