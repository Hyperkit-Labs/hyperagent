"""
Unit tests for ERC4337 deployment service
"""

import pytest
from unittest.mock import Mock, patch
from hyperagent.core.services.deployment.erc4337_deployment import ERC4337DeploymentHelper
from hyperagent.blockchain.networks import NetworkManager


@pytest.fixture
def network_manager():
    """Create a mock network manager"""
    return Mock(spec=NetworkManager)


@pytest.fixture
def erc4337_helper(network_manager):
    """Create an ERC4337 deployment helper"""
    return ERC4337DeploymentHelper(network_manager=network_manager)


def test_extract_contract_address_from_receipt_with_address(erc4337_helper):
    """Test extracting contract address when receipt has contractAddress"""
    receipt = {
        "contractAddress": "0x1234567890123456789012345678901234567890",
        "network": "ethereum_mainnet"
    }
    
    address = erc4337_helper._extract_contract_address_from_receipt(receipt)
    assert address == "0x1234567890123456789012345678901234567890"


def test_extract_contract_address_from_receipt_with_contract_deployed_event(erc4337_helper, network_manager):
    """Test extracting contract address from ContractDeployed event"""
    from web3 import Web3
    
    mock_w3 = Mock()
    network_manager.get_web3.return_value = mock_w3
    
    # Create ContractDeployed event signature
    event_signature = Web3.keccak(text="ContractDeployed(address,address)").hex()
    contract_address = "0x1234567890123456789012345678901234567890"
    address_topic = "0x000000000000000000000000" + contract_address[2:].lower()
    
    receipt = {
        "network": "ethereum_mainnet",
        "logs": [
            {
                "topics": [
                    event_signature,
                    address_topic,
                    "0x0000000000000000000000009876543210987654321098765432109876543210"
                ]
            }
        ]
    }
    
    address = erc4337_helper._extract_contract_address_from_receipt(receipt)
    assert address.lower() == contract_address.lower()


def test_extract_contract_address_from_receipt_no_address(erc4337_helper, network_manager):
    """Test fallback when no contract address found"""
    mock_w3 = Mock()
    network_manager.get_web3.return_value = mock_w3
    
    receipt = {
        "network": "ethereum_mainnet",
        "logs": []
    }
    
    address = erc4337_helper._extract_contract_address_from_receipt(receipt)
    assert address == "0x0000000000000000000000000000000000000000"


def test_get_entrypoint_abi(erc4337_helper):
    """Test EntryPoint ABI includes events"""
    abi = erc4337_helper._get_entrypoint_abi()
    
    # Should have handleOps function
    functions = [item for item in abi if item.get("type") == "function"]
    assert any(f.get("name") == "handleOps" for f in functions)
    
    # Should have UserOperationEvent
    events = [item for item in abi if item.get("type") == "event"]
    assert any(e.get("name") == "UserOperationEvent" for e in events)
    
    # Should have ContractDeployed
    assert any(e.get("name") == "ContractDeployed" for e in events)

