"""Integration tests for user-wallet-based deployment"""
import pytest
from typing import Dict, Any
from hyperagent.core.exceptions import WalletError, DeploymentError
from hyperagent.utils.helpers import validate_wallet_address, normalize_wallet_address


class TestWalletAddressValidation:
    """Test wallet address validation utilities"""
    
    def test_validate_valid_wallet_address(self):
        """Test validation of valid wallet address"""
        address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        is_valid, error = validate_wallet_address(address)
        assert is_valid is True
        assert error is None
    
    def test_validate_invalid_wallet_address_short(self):
        """Test validation rejects short address"""
        address = "0x123"
        is_valid, error = validate_wallet_address(address)
        assert is_valid is False
        assert "length" in error.lower()
    
    def test_validate_invalid_wallet_address_no_prefix(self):
        """Test validation rejects address without 0x prefix"""
        address = "742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        is_valid, error = validate_wallet_address(address)
        assert is_valid is False
        assert "0x" in error.lower()
    
    def test_validate_zero_address(self):
        """Test validation rejects zero address"""
        address = "0x0000000000000000000000000000000000000000"
        is_valid, error = validate_wallet_address(address)
        assert is_valid is False
        assert "zero" in error.lower()
    
    def test_normalize_wallet_address(self):
        """Test wallet address normalization to checksum"""
        address = "0x742d35cc6634c0532925a3b844bc9e7595f0beb"
        normalized = normalize_wallet_address(address)
        assert normalized == "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        assert normalized != address  # Should be different (checksum)


class TestWorkflowWalletRequirement:
    """Test that workflows require wallet address"""
    
    @pytest.mark.asyncio
    async def test_workflow_requires_wallet_address(self):
        """Test that workflow creation fails without wallet address"""
        from hyperagent.core.orchestrator import WorkflowCoordinator
        from hyperagent.architecture.soa import ServiceRegistry
        from hyperagent.events.event_bus import EventBus
        
        # Create coordinator
        service_registry = ServiceRegistry()
        event_bus = EventBus()
        coordinator = WorkflowCoordinator(service_registry, event_bus)
        
        # Try to create workflow without wallet address
        with pytest.raises(ValueError) as exc_info:
            await coordinator.execute_workflow(
                workflow_id="test-123",
                nlp_input="Create an ERC20 token",
                network="avalanche_fuji",
                wallet_address=None  # Missing wallet address
            )
        
        assert "wallet_address is required" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_workflow_validates_wallet_address_format(self):
        """Test that workflow validates wallet address format"""
        from hyperagent.core.orchestrator import WorkflowCoordinator
        from hyperagent.architecture.soa import ServiceRegistry
        from hyperagent.events.event_bus import EventBus
        
        # Create coordinator
        service_registry = ServiceRegistry()
        event_bus = EventBus()
        coordinator = WorkflowCoordinator(service_registry, event_bus)
        
        # Try to create workflow with invalid wallet address
        with pytest.raises(ValueError) as exc_info:
            await coordinator.execute_workflow(
                workflow_id="test-123",
                nlp_input="Create an ERC20 token",
                network="avalanche_fuji",
                wallet_address="invalid-address"  # Invalid format
            )
        
        assert "invalid wallet address" in str(exc_info.value).lower()


class TestDeploymentServiceWalletRequirement:
    """Test that deployment service requires wallet address"""
    
    @pytest.mark.asyncio
    async def test_deployment_requires_wallet_address(self):
        """Test that deployment fails without wallet address"""
        from hyperagent.core.services.deployment_service import DeploymentService
        from hyperagent.blockchain.networks import NetworkManager
        from hyperagent.blockchain.alith_client import AlithClient
        from hyperagent.blockchain.eigenda_client import EigenDAClient
        
        # Create deployment service
        network_manager = NetworkManager()
        alith_client = AlithClient()
        eigenda_client = EigenDAClient()
        deployment_service = DeploymentService(
            network_manager,
            alith_client,
            eigenda_client
        )
        
        # Try to deploy without wallet address
        with pytest.raises(WalletError) as exc_info:
            await deployment_service.process({
                "compiled_contract": {"bytecode": "0x1234", "abi": []},
                "network": "avalanche_fuji",
                "wallet_address": None  # Missing wallet address
            })
        
        assert "wallet_address is required" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_deployment_validates_wallet_address(self):
        """Test that deployment validates wallet address format"""
        from hyperagent.core.services.deployment_service import DeploymentService
        from hyperagent.blockchain.networks import NetworkManager
        from hyperagent.blockchain.alith_client import AlithClient
        from hyperagent.blockchain.eigenda_client import EigenDAClient
        
        # Create deployment service
        network_manager = NetworkManager()
        alith_client = AlithClient()
        eigenda_client = EigenDAClient()
        deployment_service = DeploymentService(
            network_manager,
            alith_client,
            eigenda_client
        )
        
        # Try to deploy with invalid wallet address
        with pytest.raises(WalletError) as exc_info:
            await deployment_service.process({
                "compiled_contract": {"bytecode": "0x1234", "abi": []},
                "network": "avalanche_fuji",
                "wallet_address": "invalid"  # Invalid format
            })
        
        assert "invalid wallet address" in str(exc_info.value).lower()


class TestNetworkFeatureDetection:
    """Test network feature detection"""
    
    def test_is_x402_network_avalanche_fuji(self):
        """Test that Avalanche Fuji is detected as x402 network"""
        from hyperagent.blockchain.network_features import NetworkFeatureManager
        from hyperagent.core.config import settings
        
        is_x402 = NetworkFeatureManager.is_x402_network(
            "avalanche_fuji",
            True,  # x402 enabled
            "avalanche_fuji,avalanche_mainnet"
        )
        assert is_x402 is True
    
    def test_is_x402_network_hyperion(self):
        """Test that Hyperion is not detected as x402 network"""
        from hyperagent.blockchain.network_features import NetworkFeatureManager
        
        is_x402 = NetworkFeatureManager.is_x402_network(
            "hyperion_testnet",
            True,  # x402 enabled
            "avalanche_fuji,avalanche_mainnet"
        )
        assert is_x402 is False
    
    def test_network_name_normalization(self):
        """Test that network names are normalized"""
        from hyperagent.blockchain.network_features import NetworkFeatureManager
        
        # Test with hyphen
        normalized1 = NetworkFeatureManager.normalize_network_name("avalanche-fuji")
        # Test with underscore
        normalized2 = NetworkFeatureManager.normalize_network_name("avalanche_fuji")
        
        assert normalized1 == normalized2
        assert normalized1 == "avalanche_fuji"


class TestDeploymentErrorHandling:
    """Test deployment error handling with custom exceptions"""
    
    @pytest.mark.asyncio
    async def test_deployment_error_includes_details(self):
        """Test that DeploymentError includes helpful details"""
        from hyperagent.core.exceptions import DeploymentError
        
        error = DeploymentError(
            "Deployment failed",
            details={"network": "avalanche_fuji", "error_type": "NetworkError"}
        )
        
        error_dict = error.to_dict()
        assert error_dict["error"] == "DeploymentError"
        assert error_dict["message"] == "Deployment failed"
        assert error_dict["details"]["network"] == "avalanche_fuji"
    
    @pytest.mark.asyncio
    async def test_wallet_error_includes_details(self):
        """Test that WalletError includes helpful details"""
        from hyperagent.core.exceptions import WalletError
        
        error = WalletError(
            "Invalid wallet address",
            details={"field": "wallet_address", "value": "invalid"}
        )
        
        error_dict = error.to_dict()
        assert error_dict["error"] == "WalletError"
        assert error_dict["message"] == "Invalid wallet address"
        assert error_dict["details"]["field"] == "wallet_address"

