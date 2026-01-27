"""
Unit tests for YAML config loader
"""
import pytest
from hyperagent.core.config_loader import (
    get_config_loader,
    get_network,
    get_token_address,
    get_contract_price,
    get_workflow_price,
    get_deployment_strategy,
    list_networks,
    is_testnet,
)


def test_get_network():
    """Test loading network config from networks.yaml"""
    network = get_network("avalanche_mainnet")
    assert network is not None
    assert network["chain_id"] == 43114
    assert "https://api.avax.network" in network["rpc_urls"][0]
    assert network["explorer"] == "https://snowtrace.io"
    assert network["currency"] == "AVAX"
    assert network["features"]["batch_deployment"] is True


def test_get_network_mantle():
    """Test Mantle network config"""
    network = get_network("mantle_mainnet")
    assert network is not None
    assert network["chain_id"] == 5000
    assert "https://rpc.mantle.xyz" in network["rpc_urls"][0]
    assert network["features"]["eigenda"] is True


def test_get_network_not_found():
    """Test non-existent network returns None"""
    network = get_network("invalid_network")
    assert network is None


def test_get_usdc_address():
    """Test loading USDC addresses from tokens.yaml"""
    # Avalanche mainnet USDC
    usdc = get_token_address("usdc", "avalanche_mainnet")
    assert usdc == "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    
    # Mantle mainnet USDC
    usdc_mantle = get_token_address("usdc", "mantle_mainnet")
    assert usdc_mantle == "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9"
    
    # Ethereum mainnet USDC
    usdc_eth = get_token_address("usdc", "ethereum_mainnet")
    assert usdc_eth == "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"


def test_get_token_address_not_found():
    """Test non-existent token/network returns None"""
    address = get_token_address("invalid_token", "avalanche_mainnet")
    assert address is None
    
    address = get_token_address("usdc", "invalid_network")
    assert address is None


def test_get_token_metadata():
    """Test loading token metadata"""
    loader = get_config_loader()
    metadata = loader.get_token_metadata("usdc")
    assert metadata["name"] == "USD Coin"
    assert metadata["symbol"] == "USDC"
    assert metadata["decimals"] == 6
    assert metadata["type"] == "stablecoin"


def test_get_contract_price():
    """Test loading contract prices from pricing.yaml"""
    erc20_price = get_contract_price("ERC20")
    assert erc20_price == 0.01
    
    erc721_price = get_contract_price("ERC721")
    assert erc721_price == 0.02
    
    custom_price = get_contract_price("Custom")
    assert custom_price == 0.15


def test_get_workflow_price():
    """Test loading workflow tier prices"""
    loader = get_config_loader()
    basic_price = loader.get_workflow_price("basic")
    assert basic_price == 0.01
    
    advanced_price = loader.get_workflow_price("advanced")
    assert advanced_price == 0.02
    
    deployment_price = loader.get_workflow_price("deployment")
    assert deployment_price == 0.10


def test_get_network_multiplier():
    """Test loading network pricing multipliers"""
    loader = get_config_loader()
    eth_multiplier = loader.get_network_multiplier("ethereum_mainnet")
    assert eth_multiplier == 3.0
    
    mantle_multiplier = loader.get_network_multiplier("mantle_mainnet")
    assert mantle_multiplier == 1.5
    
    testnet_multiplier = loader.get_network_multiplier("avalanche_fuji")
    assert testnet_multiplier == 1.0


def test_get_deployment_strategy():
    """Test determining deployment strategy"""
    # ERC-4337 networks
    strategy = get_deployment_strategy("avalanche_mainnet")
    assert strategy == "erc4337"
    
    strategy = get_deployment_strategy("mantle_mainnet")
    assert strategy == "erc4337"
    
    # Server wallet networks
    strategy = get_deployment_strategy("ethereum_mainnet")
    assert strategy == "server_wallet"


def test_get_gas_settings():
    """Test loading gas settings"""
    loader = get_config_loader()
    gas = loader.get_gas_settings("ethereum_mainnet")
    assert gas["max_priority_fee_gwei"] == 2
    assert gas["max_fee_gwei"] == 100
    assert gas["gas_limit_multiplier"] == 1.2
    
    gas_mantle = loader.get_gas_settings("mantle_mainnet")
    assert gas_mantle["max_priority_fee_gwei"] == 0.02
    assert gas_mantle["max_fee_gwei"] == 0.1


def test_get_explorer_api():
    """Test loading explorer API URLs"""
    loader = get_config_loader()
    api = loader.get_explorer_api("avalanche_mainnet")
    assert api == "https://api.snowtrace.io/api"
    
    api_mantle = loader.get_explorer_api("mantle_mainnet")
    assert api_mantle == "https://api.mantlescan.xyz/api"


def test_list_networks():
    """Test listing all supported networks"""
    networks = list_networks()
    assert isinstance(networks, list)
    assert len(networks) >= 11  # We have 11+ networks configured
    assert "avalanche_mainnet" in networks
    assert "mantle_testnet" in networks
    assert "base_mainnet" in networks
    assert "arbitrum_one" in networks


def test_is_testnet():
    """Test testnet detection"""
    assert is_testnet("avalanche_fuji") is True
    assert is_testnet("mantle_testnet") is True
    assert is_testnet("ethereum_sepolia") is True
    assert is_testnet("base_sepolia") is True
    
    assert is_testnet("avalanche_mainnet") is False
    assert is_testnet("mantle_mainnet") is False
    assert is_testnet("ethereum_mainnet") is False


def test_config_loader_singleton():
    """Test that config loader is a singleton"""
    loader1 = get_config_loader()
    loader2 = get_config_loader()
    assert loader1 is loader2


def test_config_caching():
    """Test that configs are cached"""
    import time
    
    # First call (uncached)
    start = time.time()
    networks1 = get_config_loader().get_networks()
    first_time = time.time() - start
    
    # Second call (should be cached)
    start = time.time()
    networks2 = get_config_loader().get_networks()
    second_time = time.time() - start
    
    assert networks1 == networks2
    # Cached should be significantly faster (at least 2x)
    assert second_time < first_time / 2


def test_deployment_config_consistency():
    """Ensure all networks in deployment.yaml exist in networks.yaml"""
    loader = get_config_loader()
    deployment_config = loader.get_deployment_config()
    supported_networks = list_networks()
    
    # Check ERC-4337 networks
    erc4337_networks = deployment_config["strategies"]["erc4337"]["networks"]
    for net in erc4337_networks:
        assert net in supported_networks, f"ERC-4337 network {net} not found in networks.yaml"
    
    # Check server wallet networks
    server_wallet_networks = deployment_config["strategies"]["server_wallet"]["networks"]
    for net in server_wallet_networks:
        assert net in supported_networks, f"Server wallet network {net} not found in networks.yaml"
    
    # Check gas settings
    for net in deployment_config["gas_settings"].keys():
        assert net in supported_networks, f"Gas settings network {net} not found in networks.yaml"

