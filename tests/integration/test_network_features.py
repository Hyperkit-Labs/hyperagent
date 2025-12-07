"""Integration tests for network feature detection"""
import pytest
from hyperagent.blockchain.network_features import (
    NetworkFeatureManager,
    NetworkFeature,
    NETWORK_FEATURES
)


class TestNetworkFeatureManager:
    """Test NetworkFeatureManager functionality"""
    
    def test_get_features_hyperion_testnet(self):
        """Test getting features for Hyperion testnet"""
        features = NetworkFeatureManager.get_features("hyperion_testnet")
        
        assert features[NetworkFeature.PEF] is True
        assert features[NetworkFeature.METISVM] is True
        assert features[NetworkFeature.BATCH_DEPLOYMENT] is True
        assert features[NetworkFeature.EIGENDA] is False
    
    def test_get_features_avalanche_fuji(self):
        """Test getting features for Avalanche Fuji"""
        features = NetworkFeatureManager.get_features("avalanche_fuji")
        
        assert features[NetworkFeature.PEF] is False
        assert features[NetworkFeature.METISVM] is False
        assert features[NetworkFeature.BATCH_DEPLOYMENT] is True
    
    def test_supports_feature(self):
        """Test feature support checking"""
        assert NetworkFeatureManager.supports_feature("hyperion_testnet", NetworkFeature.PEF) is True
        assert NetworkFeatureManager.supports_feature("hyperion_testnet", NetworkFeature.EIGENDA) is False
        assert NetworkFeatureManager.supports_feature("avalanche_fuji", NetworkFeature.PEF) is False
    
    def test_get_network_config(self):
        """Test getting full network configuration"""
        config = NetworkFeatureManager.get_network_config("avalanche_fuji")
        
        assert config["chain_id"] == 43113
        assert config["rpc_url"] is not None
        assert config["currency"] == "AVAX"
        assert "features" in config
    
    def test_get_network_config_with_usdc(self):
        """Test getting network config with USDC address"""
        from hyperagent.core.config import settings
        
        # Set USDC address for testing
        original_usdc = settings.usdc_address_fuji
        settings.usdc_address_fuji = "0x5425890298aed601595a70AB815c96711a31Bc65"
        
        try:
            config = NetworkFeatureManager.get_network_config("avalanche_fuji", load_usdc=True)
            assert config.get("usdc_address") == "0x5425890298aed601595a70AB815c96711a31Bc65"
        finally:
            settings.usdc_address_fuji = original_usdc
    
    def test_list_networks(self):
        """Test listing all registered networks"""
        networks = NetworkFeatureManager.list_networks()
        
        assert "hyperion_testnet" in networks
        assert "avalanche_fuji" in networks
        assert "mantle_testnet" in networks
        assert len(networks) >= 4
    
    def test_is_x402_network(self):
        """Test x402 network detection"""
        # Test Avalanche Fuji (x402 enabled)
        is_x402 = NetworkFeatureManager.is_x402_network(
            "avalanche_fuji",
            True,  # x402 enabled
            "avalanche_fuji,avalanche_mainnet"
        )
        assert is_x402 is True
        
        # Test Hyperion (not x402)
        is_x402 = NetworkFeatureManager.is_x402_network(
            "hyperion_testnet",
            True,  # x402 enabled
            "avalanche_fuji,avalanche_mainnet"
        )
        assert is_x402 is False
        
        # Test with x402 disabled
        is_x402 = NetworkFeatureManager.is_x402_network(
            "avalanche_fuji",
            False,  # x402 disabled
            "avalanche_fuji,avalanche_mainnet"
        )
        assert is_x402 is False
    
    def test_normalize_network_name(self):
        """Test network name normalization"""
        # Test hyphen to underscore
        normalized = NetworkFeatureManager.normalize_network_name("avalanche-fuji")
        assert normalized == "avalanche_fuji"
        
        # Test case normalization
        normalized = NetworkFeatureManager.normalize_network_name("AVALANCHE_FUJI")
        assert normalized == "avalanche_fuji"
        
        # Test already normalized
        normalized = NetworkFeatureManager.normalize_network_name("avalanche_fuji")
        assert normalized == "avalanche_fuji"
    
    def test_get_fallback_strategy(self):
        """Test getting fallback strategies"""
        strategy = NetworkFeatureManager.get_fallback_strategy(
            "avalanche_fuji",
            NetworkFeature.PEF
        )
        assert strategy == "sequential_deployment"
        
        strategy = NetworkFeatureManager.get_fallback_strategy(
            "avalanche_fuji",
            NetworkFeature.METISVM
        )
        assert strategy == "standard_compilation"


class TestNetworkConfiguration:
    """Test network configuration structure"""
    
    def test_all_networks_have_required_fields(self):
        """Test that all networks have required configuration fields"""
        required_fields = ["chain_id", "rpc_url", "currency", "features"]
        
        for network_name, config in NETWORK_FEATURES.items():
            for field in required_fields:
                assert field in config, f"Network {network_name} missing field: {field}"
    
    def test_network_features_structure(self):
        """Test that network features are properly structured"""
        for network_name, config in NETWORK_FEATURES.items():
            features = config.get("features", {})
            assert isinstance(features, dict)
            
            # Check that all features are boolean
            for feature, supported in features.items():
                assert isinstance(feature, NetworkFeature)
                assert isinstance(supported, bool)
    
    def test_chain_ids_are_unique(self):
        """Test that chain IDs are unique across networks"""
        chain_ids = {}
        
        for network_name, config in NETWORK_FEATURES.items():
            chain_id = config.get("chain_id")
            if chain_id:
                assert chain_id not in chain_ids.values(), \
                    f"Duplicate chain ID {chain_id} for network {network_name}"
                chain_ids[network_name] = chain_id

