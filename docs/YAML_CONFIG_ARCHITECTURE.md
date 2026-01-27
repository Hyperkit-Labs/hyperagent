# YAML Configuration Architecture

## Overview

HyperKit Agent uses YAML-based configuration files instead of environment variables for structured, scalable configuration management. This approach improves:

- **Scalability**: Easy to add networks, tokens, pricing tiers
- **Maintainability**: Clear structure, version control friendly
- **Type Safety**: Schema validation in both Python and TypeScript
- **Developer Experience**: No need to update .env for every network/token

## Architecture Principles

### 1. **Separation of Concerns**

Each YAML file manages a specific domain:

```
config/
├── networks.yaml      # Network RPC URLs, explorers, chain IDs
├── tokens.yaml        # Token contract addresses per network
├── pricing.yaml       # x402 pricing, subscriptions, discounts
└── deployment.yaml    # Deployment strategies, gas settings
```

### 2. **Single Source of Truth**

- **Before**: Network config scattered across .env, code, and hardcoded values
- **After**: All config in YAML, loaded via centralized loaders

### 3. **Environment-Agnostic**

- YAML files contain static configuration (networks, addresses, pricing)
- .env contains secrets and environment-specific settings (API keys, private keys)

## Configuration Files

### networks.yaml

```yaml
networks:
  mantle_mainnet:
    chain_id: 5000
    rpc_urls:
      - https://rpc.mantle.xyz
    explorer: https://mantlescan.xyz
    currency: MNT
    features:
      batch_deployment: true
      eigenda: true
```

**Purpose**: Define blockchain networks with RPCs, explorers, and capabilities.

**When to update**: Adding new networks, updating RPC URLs.

### tokens.yaml

```yaml
tokens:
  usdc:
    avalanche_fuji: "0x5425890298aed601595a70AB815c96711a31Bc65"
    mantle_mainnet: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9"
    ethereum_mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    
metadata:
  usdc:
    name: "USD Coin"
    symbol: "USDC"
    decimals: 6
    type: "stablecoin"
```

**Purpose**: Map token contract addresses to networks with metadata.

**When to update**: Adding new tokens, updating contract addresses.

### pricing.yaml

```yaml
contract_types:
  ERC20: 0.01
  ERC721: 0.02
  Custom: 0.15
  
workflow_tiers:
  basic: 0.01
  advanced: 0.02
  deployment: 0.10
  
network_multipliers:
  ethereum_mainnet: 3.0
  avalanche_mainnet: 1.5
  mantle_testnet: 1.0
```

**Purpose**: Define pricing for services, subscriptions, and network-specific multipliers.

**When to update**: Changing prices, adding new tiers, updating multipliers.

### deployment.yaml

```yaml
strategies:
  erc4337:
    enabled: true
    networks:
      - avalanche_mainnet
      - mantle_mainnet
    entrypoint_address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    
gas_settings:
  ethereum_mainnet:
    max_priority_fee_gwei: 2
    max_fee_gwei: 100
    gas_limit_multiplier: 1.2
```

**Purpose**: Configure deployment strategies, gas settings, and verification.

**When to update**: Adding networks to ERC-4337, adjusting gas limits.

## Config Loaders

### Python Loader

```python
from hyperagent.core.config_loader import (
    get_config_loader,
    get_network,
    get_token_address,
    get_contract_price,
    list_networks
)

# Get network config
network = get_network("avalanche_mainnet")
print(network["chain_id"])  # 43114
print(network["rpc_urls"][0])  # https://api.avax.network/...

# Get USDC address
usdc_address = get_token_address("usdc", "avalanche_mainnet")
print(usdc_address)  # 0xB97EF9Ef...

# Get pricing
price = get_contract_price("ERC20")
print(price)  # 0.01

# List all networks
networks = list_networks()
print(networks)  # ['mantle_testnet', 'avalanche_fuji', ...]
```

### TypeScript Loader

```typescript
import {
  getConfigLoader,
  getNetwork,
  getTokenAddress,
  getContractPrice,
  listNetworks
} from './config/configLoader';

// Get network config
const network = getNetwork("avalanche_mainnet");
console.log(network?.chain_id);  // 43114
console.log(network?.rpc_urls[0]);  // https://api.avax.network/...

// Get USDC address
const usdcAddress = getTokenAddress("usdc", "avalanche_mainnet");
console.log(usdcAddress);  // 0xB97EF9Ef...

// Get pricing
const price = getContractPrice("ERC20");
console.log(price);  // 0.01

// List all networks
const networks = listNetworks();
console.log(networks);  // ['mantle_testnet', 'avalanche_fuji', ...]
```

## Migration Guide

### Before (Hardcoded in .env)

```bash
# .env
RPC_URL_AVALANCHE_FUJI=https://api.avax-test.network/ext/bc/C/rpc
RPC_URL_MANTLE_TESTNET=https://rpc.sepolia.mantle.xyz
USDC_ADDRESS_FUJI=0x5425890298aed601595a70AB815c96711a31Bc65
USDC_ADDRESS_MANTLE=0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9
X402_CONTRACT_PRICE_USDC=0.01
X402_WORKFLOW_PRICE_USDC=0.02
```

### After (YAML-based)

```yaml
# config/networks.yaml
networks:
  avalanche_fuji:
    rpc_urls:
      - https://api.avax-test.network/ext/bc/C/rpc

# config/tokens.yaml
tokens:
  usdc:
    avalanche_fuji: "0x5425890298aed601595a70AB815c96711a31Bc65"

# config/pricing.yaml
contract_types:
  ERC20: 0.01
workflow_tiers:
  advanced: 0.02
```

### Code Migration

**Before:**
```python
# Reading from env
rpc_url = os.getenv("RPC_URL_AVALANCHE_FUJI")
usdc_address = os.getenv("USDC_ADDRESS_FUJI")
price = float(os.getenv("X402_CONTRACT_PRICE_USDC", "0.01"))
```

**After:**
```python
# Reading from YAML
from hyperagent.core.config_loader import get_network, get_token_address, get_contract_price

network = get_network("avalanche_fuji")
rpc_url = network["rpc_urls"][0]
usdc_address = get_token_address("usdc", "avalanche_fuji")
price = get_contract_price("ERC20")
```

## Adding New Networks

### Step 1: Add to networks.yaml

```yaml
networks:
  polygon_zkevm:
    chain_id: 1101
    rpc_urls:
      - https://zkevm-rpc.com
    explorer: https://zkevm.polygonscan.com
    currency: ETH
    features:
      batch_deployment: true
      eigenda: false
```

### Step 2: Add token addresses

```yaml
tokens:
  usdc:
    polygon_zkevm: "0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035"
```

### Step 3: Add deployment config

```yaml
strategies:
  erc4337:
    networks:
      - polygon_zkevm  # Add here
      
gas_settings:
  polygon_zkevm:
    max_priority_fee_gwei: 1
    max_fee_gwei: 50
    gas_limit_multiplier: 1.2
```

### Step 4: Use immediately

```python
# No code changes needed!
network = get_network("polygon_zkevm")
usdc = get_token_address("usdc", "polygon_zkevm")
```

## Adding New Tokens

### Step 1: Add to tokens.yaml

```yaml
tokens:
  dai:
    ethereum_mainnet: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    polygon_mainnet: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"
    
metadata:
  dai:
    name: "Dai Stablecoin"
    symbol: "DAI"
    decimals: 18
    type: "stablecoin"
```

### Step 2: Use in code

```python
dai_address = get_token_address("dai", "ethereum_mainnet")
dai_metadata = get_config_loader().get_token_metadata("dai")
print(dai_metadata["decimals"])  # 18
```

## Best Practices

### 1. **Always Use Config Loaders**

Never access YAML files directly. Always use config loaders.

**Good:**
```python
from hyperagent.core.config_loader import get_network
network = get_network("avalanche_mainnet")
```

**Bad:**
```python
import yaml
with open("config/networks.yaml") as f:
    networks = yaml.safe_load(f)
```

### 2. **Cache Config Loaders**

Config loaders use `@lru_cache` to prevent repeated file reads.

```python
# Good: Singleton pattern
from hyperagent.core.config_loader import get_config_loader
loader = get_config_loader()  # Cached

# Bad: Creating new instances
loader1 = ConfigLoader()
loader2 = ConfigLoader()
```

### 3. **Validate Network IDs**

Always validate network IDs before using:

```python
from hyperagent.core.config_loader import list_networks

supported_networks = list_networks()
if network_id not in supported_networks:
    raise ValueError(f"Unsupported network: {network_id}")
```

### 4. **Use Fallback Values**

Provide defaults for optional config:

```python
# With fallback
gas_limit_multiplier = gas_settings.get("gas_limit_multiplier", 1.2)

# Or use config loader methods with defaults
multiplier = get_config_loader().get_network_multiplier(network_id) or 1.0
```

### 5. **Keep .env for Secrets Only**

Only store sensitive data in .env:

```bash
# .env - Secrets and API keys only
ANTHROPIC_API_KEY=sk-ant-...
THIRDWEB_SECRET_KEY=xK3tS5vyw1O5...
PRIVATE_KEY=0x225667ea8a585333...
DATABASE_URL=postgresql://...

# NOT in .env
# RPC_URL_AVALANCHE=...  ❌ Use networks.yaml
# USDC_ADDRESS=...       ❌ Use tokens.yaml
# CONTRACT_PRICE=...     ❌ Use pricing.yaml
```

## Testing

### Unit Tests

```python
def test_get_network():
    network = get_network("avalanche_mainnet")
    assert network is not None
    assert network["chain_id"] == 43114
    assert "https://api.avax.network" in network["rpc_urls"][0]

def test_get_token_address():
    usdc = get_token_address("usdc", "avalanche_mainnet")
    assert usdc == "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"

def test_get_contract_price():
    price = get_contract_price("ERC20")
    assert price == 0.01
```

### Integration Tests

```python
def test_deployment_config_consistency():
    """Ensure all networks in deployment.yaml exist in networks.yaml"""
    deployment_config = get_config_loader().get_deployment_config()
    supported_networks = list_networks()
    
    # Check ERC-4337 networks
    erc4337_networks = deployment_config["strategies"]["erc4337"]["networks"]
    for net in erc4337_networks:
        assert net in supported_networks, f"ERC-4337 network {net} not found in networks.yaml"
    
    # Check gas settings
    for net in deployment_config["gas_settings"].keys():
        assert net in supported_networks, f"Gas settings network {net} not found in networks.yaml"
```

## Troubleshooting

### Config File Not Found

```
FileNotFoundError: Config file not found: /path/to/config/networks.yaml
```

**Solution**: Ensure config files are in `config/` directory relative to repo root.

### Invalid YAML Syntax

```
yaml.scanner.ScannerError: while scanning for the next token
```

**Solution**: Validate YAML syntax using online validators or `yamllint`.

### Missing Network

```python
network = get_network("invalid_network")
# Returns: None
```

**Solution**: Check network ID spelling, or add to `networks.yaml`.

### Cache Stale Data

If config changes aren't reflected:

```python
# Clear cache
get_config_loader().clearCache()  # TypeScript
get_config_loader().load_yaml.cache_clear()  # Python
```

## Performance

- **First Load**: ~5ms per YAML file
- **Cached Load**: <0.1ms (in-memory)
- **Memory**: ~10KB per config file

Config loaders use LRU caching, so repeated calls are near-instant.

## Future Enhancements

1. **Hot Reload**: Auto-reload config on file change (development mode)
2. **Schema Validation**: JSON Schema validation for YAML files
3. **Config Versioning**: Version tags for breaking changes
4. **Remote Config**: Load from HTTP endpoint for distributed systems
5. **Config Merge**: Environment-specific overrides (dev, staging, prod)

## Summary

| Aspect | Before (.env) | After (YAML) |
|---|---|---|
| **Scalability** | Hard to add networks | Add to YAML, instant support |
| **Type Safety** | String parsing | Schema validation |
| **Maintainability** | Scattered config | Centralized files |
| **Version Control** | Binary .env | Git-friendly YAML |
| **Developer UX** | Edit .env per network | Edit once, use everywhere |

YAML configuration makes HyperKit Agent more scalable, maintainable, and developer-friendly.

