"""
Unit tests for contract verification
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from hyperagent.blockchain.alith_tools import AlithTools
from hyperagent.blockchain.networks import NetworkManager


@pytest.fixture
def network_manager():
    """Create a mock network manager"""
    return Mock(spec=NetworkManager)


@pytest.fixture
def alith_tools(network_manager):
    """Create AlithTools instance"""
    return AlithTools(network_manager=network_manager)


@pytest.mark.asyncio
async def test_verify_contract_basic_check(alith_tools, network_manager):
    """Test basic contract verification (code existence check)"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52"  # Some bytecode
    network_manager.get_web3.return_value = mock_w3
    
    result = await alith_tools._verify_contract({
        "contract_address": "0x1234567890123456789012345678901234567890",
        "network": "ethereum_mainnet"
    })
    
    assert result["success"] is True
    assert result["has_code"] is True
    assert result["code_length"] > 0


@pytest.mark.asyncio
async def test_verify_contract_no_code(alith_tools, network_manager):
    """Test verification when contract has no code"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b""  # Empty bytecode
    network_manager.get_web3.return_value = mock_w3
    
    result = await alith_tools._verify_contract({
        "contract_address": "0x1234567890123456789012345678901234567890",
        "network": "ethereum_mainnet"
    })
    
    assert result["success"] is False
    assert "no code" in result["error"].lower()


@pytest.mark.asyncio
async def test_verify_contract_with_source_code(alith_tools, network_manager):
    """Test full verification with source code"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52"
    network_manager.get_web3.return_value = mock_w3
    
    # Mock ContractVerifier
    with patch("hyperagent.blockchain.alith_tools.ContractVerifier") as MockVerifier:
        mock_verifier_instance = Mock()
        mock_verifier_instance.verify_contract = AsyncMock(return_value={
            "success": True,
            "verified": True,
            "explorer_url": "https://etherscan.io/address/0x1234"
        })
        MockVerifier.return_value = mock_verifier_instance
        
        result = await alith_tools._verify_contract({
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "ethereum_mainnet",
            "source_code": "pragma solidity ^0.8.0; contract Test {}",
            "contract_name": "Test",
            "compiler_version": "0.8.24"
        })
        
        assert result["success"] is True
        assert result.get("verified") is True


@pytest.mark.asyncio
async def test_verify_contract_missing_params(alith_tools):
    """Test verification with missing parameters"""
    result = await alith_tools._verify_contract({
        "contract_address": "0x1234"
        # Missing network
    })
    
    assert result["success"] is False
    assert "required" in result["error"].lower()

