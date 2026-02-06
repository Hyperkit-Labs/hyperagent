"""
YAML Configuration Loader
Centralized config loading for networks, tokens, pricing, deployment
"""
import os
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from functools import lru_cache

# Config directory path (relative to repo root)
CONFIG_DIR = Path(__file__).parent.parent.parent / "config"


class ConfigLoader:
    """Load and cache YAML configuration files"""
    
    def __init__(self, config_dir: Optional[Path] = None):
        self.config_dir = config_dir or CONFIG_DIR
        self._cache: Dict[str, Any] = {}
    
    @lru_cache(maxsize=10)
    def load_yaml(self, filename: str) -> Dict[str, Any]:
        """Load YAML file with caching"""
        filepath = self.config_dir / filename
        
        if not filepath.exists():
            raise FileNotFoundError(f"Config file not found: {filepath}")
        
        with open(filepath, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    
    def get_networks(self) -> Dict[str, Any]:
        """Load networks.yaml"""
        return self.load_yaml("networks.yaml").get("networks", {})
    
    def get_network(self, network_id: str) -> Optional[Dict[str, Any]]:
        """Get specific network configuration"""
        networks = self.get_networks()
        return networks.get(network_id)
    
    def get_tokens(self) -> Dict[str, Any]:
        """Load tokens.yaml"""
        return self.load_yaml("tokens.yaml").get("tokens", {})
    
    def get_token_address(self, token_symbol: str, network_id: str) -> Optional[str]:
        """Get token contract address for specific network"""
        tokens = self.get_tokens()
        token_data = tokens.get(token_symbol.lower(), {})
        return token_data.get(network_id)
    
    def get_token_metadata(self, token_symbol: str) -> Dict[str, Any]:
        """Get token metadata (name, symbol, decimals)"""
        metadata = self.load_yaml("tokens.yaml").get("metadata", {})
        return metadata.get(token_symbol.lower(), {})
    
    def get_pricing(self) -> Dict[str, Any]:
        """Load pricing.yaml"""
        return self.load_yaml("pricing.yaml")
    
    def get_contract_price(self, contract_type: str) -> float:
        """Get price for contract type"""
        pricing = self.get_pricing()
        return pricing.get("contract_types", {}).get(contract_type, 0.15)
    
    def get_workflow_price(self, tier: str) -> float:
        """Get price for workflow tier"""
        pricing = self.get_pricing()
        return pricing.get("workflow_tiers", {}).get(tier, 0.02)
    
    def get_network_multiplier(self, network_id: str) -> float:
        """Get pricing multiplier for network"""
        pricing = self.get_pricing()
        return pricing.get("network_multipliers", {}).get(network_id, 1.0)
    
    def get_model_multiplier(self, model_name: str) -> float:
        """Get pricing multiplier for LLM model"""
        pricing = self.get_pricing()
        multipliers = pricing.get("model_multipliers", {})
        return multipliers.get(model_name, 1.0)
    
    def get_deployment_config(self) -> Dict[str, Any]:
        """Load deployment.yaml"""
        return self.load_yaml("deployment.yaml")
    
    def get_deployment_strategy(self, network_id: str) -> str:
        """Determine deployment strategy for network"""
        config = self.get_deployment_config()
        strategies = config.get("strategies", {})
        
        # Check ERC-4337 support
        if network_id in strategies.get("erc4337", {}).get("networks", []):
            return "erc4337"
        
        # Check server wallet support
        if network_id in strategies.get("server_wallet", {}).get("networks", []):
            return "server_wallet"
        
        # Default to server wallet
        return "server_wallet"
    
    def get_gas_settings(self, network_id: str) -> Dict[str, Any]:
        """Get gas configuration for network"""
        config = self.get_deployment_config()
        gas_settings = config.get("gas_settings", {})
        return gas_settings.get(network_id, {})
    
    def get_explorer_api(self, network_id: str) -> Optional[str]:
        """Get block explorer API URL for contract verification"""
        config = self.get_deployment_config()
        explorers = config.get("verification", {}).get("explorers", {})
        return explorers.get(network_id)
    
    def list_supported_networks(self) -> list[str]:
        """List all configured networks"""
        return list(self.get_networks().keys())
    
    def list_supported_tokens(self) -> list[str]:
        """List all configured tokens"""
        return list(self.get_tokens().keys())
    
    def is_testnet(self, network_id: str) -> bool:
        """Check if network is a testnet"""
        return "_testnet" in network_id or "sepolia" in network_id or "fuji" in network_id or "calibration" in network_id or "amoy" in network_id
    
    # ========================================================================
    # LLM Configuration Methods
    # ========================================================================
    
    def get_llm_config(self) -> Dict[str, Any]:
        """Load llm.yaml"""
        return self.load_yaml("llm.yaml")
    
    def get_llm_provider_config(self, provider_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for specific LLM provider (gemini, openai, anthropic, together)"""
        config = self.get_llm_config()
        providers = config.get("providers", {})
        return providers.get(provider_name)
    
    def get_enabled_llm_providers(self) -> list[str]:
        """Get list of enabled LLM providers in priority order"""
        config = self.get_llm_config()
        providers = config.get("providers", {})
        
        enabled = [
            (name, data.get("priority", 99))
            for name, data in providers.items()
            if data.get("enabled", False)
        ]
        
        enabled.sort(key=lambda x: x[1])
        return [name for name, _ in enabled]
    
    def get_primary_llm_provider(self) -> str:
        """Get primary (highest priority) LLM provider"""
        enabled = self.get_enabled_llm_providers()
        if enabled:
            return enabled[0]
        return "gemini"  # Default fallback
    
    def get_llm_model(self, provider_name: str) -> str:
        """Get default model for provider"""
        provider_config = self.get_llm_provider_config(provider_name)
        if provider_config:
            return provider_config.get("models", {}).get("default", "")
        return ""
    
    def get_llm_generation_config(self, provider_name: str) -> Dict[str, Any]:
        """Get generation settings for provider (temperature, max_tokens, etc.)"""
        provider_config = self.get_llm_provider_config(provider_name)
        if provider_config:
            return provider_config.get("generation", {})
        return {}
    
    def get_llm_routing_config(self) -> Dict[str, Any]:
        """Get multi-model routing configuration"""
        config = self.get_llm_config()
        return config.get("routing", {})
    
    def get_llm_routing_for_task(self, task_name: str) -> Dict[str, Any]:
        """Get routing configuration for specific task (solidity_codegen, gas_optimization, etc.)"""
        routing = self.get_llm_routing_config()
        tasks = routing.get("tasks", {})
        return tasks.get(task_name, {})
    
    def get_llm_pricing(self, provider_name: str) -> Dict[str, float]:
        """Get pricing for LLM provider (input/output per 1M tokens)"""
        config = self.get_llm_config()
        pricing = config.get("pricing", {})
        return pricing.get(provider_name, {})
    
    # ========================================================================
    # Wallet Configuration Methods
    # ========================================================================
    
    def get_merchant_wallet_address(self) -> str:
        """Get merchant wallet address for x402 payments"""
        config = self.get_deployment_config()
        wallets = config.get("wallets", {})
        merchant = wallets.get("merchant", {})
        return merchant.get("address", "")
    
    def get_server_deployer_address(self) -> str:
        """Get server wallet address for deployments (public address only)"""
        config = self.get_deployment_config()
        wallets = config.get("wallets", {})
        server = wallets.get("server_deployer", {})
        return server.get("address", "")
    
    def get_erc4337_entrypoint(self) -> str:
        """Get ERC-4337 EntryPoint address"""
        config = self.get_deployment_config()
        wallets = config.get("wallets", {})
        erc4337 = wallets.get("erc4337", {})
        return erc4337.get("entrypoint", "0x0000000071727De22E5E9d8BAf0edAc6f37da032")
    
    def get_erc4337_factory(self) -> str:
        """Get ERC-4337 Account Factory address"""
        config = self.get_deployment_config()
        wallets = config.get("wallets", {})
        erc4337 = wallets.get("erc4337", {})
        return erc4337.get("factory", "")
    
    # ========================================================================
    # x402 Configuration Methods
    # ========================================================================
    
    def get_x402_config(self) -> Dict[str, Any]:
        """Load x402.yaml"""
        return self.load_yaml("x402.yaml")
    
    def is_x402_enabled(self) -> bool:
        """Check if x402 payments are enabled globally"""
        config = self.get_x402_config()
        return config.get("enabled", False)
    
    def get_x402_supported_networks(self) -> list[str]:
        """Get list of networks supporting x402 payments"""
        config = self.get_x402_config()
        return config.get("supported_networks", [])
    
    def is_network_x402_supported(self, network_id: str) -> bool:
        """Check if network supports x402 payments"""
        return network_id in self.get_x402_supported_networks()
    
    def get_x402_network_settings(self, network_id: str) -> Dict[str, Any]:
        """Get x402 settings for specific network"""
        config = self.get_x402_config()
        network_settings = config.get("network_settings", {})
        return network_settings.get(network_id, {})
    
    def get_x402_verifier_config(self) -> Dict[str, Any]:
        """Get x402 payment verifier configuration"""
        config = self.get_x402_config()
        return config.get("verifier", {})
    
    def get_x402_pricing(self, category: str, tier: str = "basic") -> float:
        """Get x402 price for category and tier"""
        config = self.get_x402_config()
        pricing = config.get("pricing", {})
        category_pricing = pricing.get(category, {})
        return category_pricing.get(tier, 0.0)
    
    def get_x402_payment_methods(self) -> list[str]:
        """Get list of supported x402 payment methods"""
        config = self.get_x402_config()
        payment_flow = config.get("payment_flow", {})
        return payment_flow.get("methods", ["erc4337_bundler"])
    
    def get_x402_default_payment_method(self) -> str:
        """Get default x402 payment method"""
        config = self.get_x402_config()
        payment_flow = config.get("payment_flow", {})
        return payment_flow.get("default_method", "erc4337_bundler")
    
    def is_x402_refund_enabled(self) -> bool:
        """Check if x402 refunds are enabled"""
        config = self.get_x402_config()
        refunds = config.get("refunds", {})
        return refunds.get("enabled", True)
    
    def get_x402_rate_limits(self) -> Dict[str, Any]:
        """Get x402 rate limits per wallet"""
        config = self.get_x402_config()
        fraud = config.get("fraud_prevention", {})
        return fraud.get("rate_limits", {})
    
    def get_x402_protocol_standard(self) -> str:
        """Get x402 protocol standard (EIP-7702 or ERC-4337)"""
        config = self.get_x402_config()
        return config.get("protocol_standard", "EIP-7702")
    
    def get_x402_gas_sponsorship_config(self) -> Dict[str, Any]:
        """Get Thirdweb gas sponsorship configuration"""
        config = self.get_x402_config()
        integrations = config.get("integrations", {})
        thirdweb = integrations.get("thirdweb", {})
        return thirdweb.get("gas_sponsorship", {})


# Singleton instance
_config_loader: Optional[ConfigLoader] = None


def get_config_loader() -> ConfigLoader:
    """Get or create singleton ConfigLoader instance"""
    global _config_loader
    if _config_loader is None:
        _config_loader = ConfigLoader()
    return _config_loader


# Convenience functions
def get_network(network_id: str) -> Optional[Dict[str, Any]]:
    """Get network configuration"""
    return get_config_loader().get_network(network_id)


def get_token_address(token_symbol: str, network_id: str) -> Optional[str]:
    """Get token address for network"""
    return get_config_loader().get_token_address(token_symbol, network_id)


def get_contract_price(contract_type: str) -> float:
    """Get contract generation price"""
    return get_config_loader().get_contract_price(contract_type)


def get_deployment_strategy(network_id: str) -> str:
    """Get deployment strategy for network"""
    return get_config_loader().get_deployment_strategy(network_id)


def list_networks() -> list[str]:
    """List all supported networks"""
    return get_config_loader().list_supported_networks()


def is_testnet(network_id: str) -> bool:
    """Check if network is testnet"""
    return get_config_loader().is_testnet(network_id)


def get_llm_provider_config(provider_name: str) -> Optional[Dict[str, Any]]:
    """Get LLM provider configuration"""
    return get_config_loader().get_llm_provider_config(provider_name)


def get_primary_llm_provider() -> str:
    """Get primary LLM provider"""
    return get_config_loader().get_primary_llm_provider()


def get_merchant_wallet_address() -> str:
    """Get merchant wallet address for x402 payments"""
    return get_config_loader().get_merchant_wallet_address()


def is_x402_enabled() -> bool:
    """Check if x402 payments are enabled"""
    return get_config_loader().is_x402_enabled()


def get_x402_supported_networks() -> list[str]:
    """Get x402 supported networks"""
    return get_config_loader().get_x402_supported_networks()


def is_network_x402_supported(network_id: str) -> bool:
    """Check if network supports x402"""
    return get_config_loader().is_network_x402_supported(network_id)


def get_x402_pricing(category: str, tier: str = "basic") -> float:
    """Get x402 pricing for category and tier"""
    return get_config_loader().get_x402_pricing(category, tier)


def get_x402_config() -> Dict[str, Any]:
    """Get x402 configuration"""
    return get_config_loader().get_x402_config()


def get_x402_protocol_standard() -> str:
    """Get x402 protocol standard"""
    return get_config_loader().get_x402_protocol_standard()

