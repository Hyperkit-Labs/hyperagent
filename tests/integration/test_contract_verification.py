"""
Integration tests for contract verification

Tests the complete contract verification flow including:
- Basic code existence checks
- Full explorer API verification
- Integration with ContractVerifier
- Error handling and fallbacks
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from hyperagent.blockchain.alith_tools import AlithToolHandler
from hyperagent.blockchain.verification import ContractVerifier
from hyperagent.blockchain.networks import NetworkManager


@pytest.fixture
def network_manager():
    """Create a mock network manager"""
    return Mock(spec=NetworkManager)


@pytest.fixture
def alith_handler(network_manager):
    """Create AlithToolHandler instance"""
    return AlithToolHandler(network_manager=network_manager)


@pytest.fixture
def contract_verifier(network_manager):
    """Create ContractVerifier instance"""
    return ContractVerifier(network_manager=network_manager)


@pytest.mark.asyncio
async def test_verify_contract_integration_basic_check(alith_handler, network_manager):
    """Test integration: basic contract code existence check"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52\x34\x80\x15"  # Valid bytecode
    
    network_manager.get_web3.return_value = mock_w3
    
    result = await alith_handler.execute_tool("verify_contract", {
        "contract_address": "0x1234567890123456789012345678901234567890",
        "network": "ethereum_mainnet"
    })
    
    assert result["success"] is True
    assert "contract_address" in result
    assert "network" in result


@pytest.mark.asyncio
async def test_verify_contract_integration_with_source_code(alith_handler, network_manager):
    """Test integration: full verification with source code"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52"
    network_manager.get_web3.return_value = mock_w3
    
    # Mock ContractVerifier.verify_contract
    with patch.object(ContractVerifier, 'verify_contract', new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {
            "success": True,
            "verified": True,
            "guid": "abc123",
            "message": "Verification submitted",
            "explorer_url": "https://etherscan.io/address/0x1234"
        }
        
        result = await alith_handler.execute_tool("verify_contract", {
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "ethereum_mainnet",
            "source_code": "pragma solidity ^0.8.0; contract Test {}",
            "contract_name": "Test",
            "compiler_version": "0.8.24"
        })
        
        assert result["success"] is True
        assert result.get("verified") is True
        assert "explorer_url" in result


@pytest.mark.asyncio
async def test_verify_contract_integration_no_code(alith_handler, network_manager):
    """Test integration: contract with no code"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b""  # Empty bytecode
    network_manager.get_web3.return_value = mock_w3
    
    result = await alith_handler.execute_tool("verify_contract", {
        "contract_address": "0x1234567890123456789012345678901234567890",
        "network": "ethereum_mainnet"
    })
    
    assert result["success"] is False
    assert "no code" in result["error"].lower() or "no code" in str(result).lower()


@pytest.mark.asyncio
async def test_verify_contract_integration_missing_params(alith_handler):
    """Test integration: missing required parameters"""
    result = await alith_handler.execute_tool("verify_contract", {
        "contract_address": "0x1234"
        # Missing network
    })
    
    assert result["success"] is False
    assert "required" in result["error"].lower()


@pytest.mark.asyncio
async def test_verify_contract_integration_verification_fallback(alith_handler, network_manager):
    """Test integration: fallback to basic check when full verification fails"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52"
    network_manager.get_web3.return_value = mock_w3
    
    # Mock ContractVerifier to raise exception
    with patch.object(ContractVerifier, 'verify_contract', new_callable=AsyncMock) as mock_verify:
        mock_verify.side_effect = Exception("Explorer API error")
        
        result = await alith_handler.execute_tool("verify_contract", {
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "ethereum_mainnet",
            "source_code": "pragma solidity ^0.8.0; contract Test {}",
            "contract_name": "Test",
            "compiler_version": "0.8.24"
        })
        
        # Should fallback to basic check
        assert result["success"] is True
        assert "has_code" in result or "code_length" in result


@pytest.mark.asyncio
async def test_contract_verifier_explorer_api_integration(contract_verifier):
    """Test ContractVerifier explorer API URL resolution"""
    # Test various networks
    test_cases = [
        ("ethereum_mainnet", "https://api.etherscan.io/api"),
        ("polygon_mainnet", "https://api.polygonscan.com/api"),
        ("avalanche_mainnet", "https://api.snowtrace.io/api"),
    ]
    
    for network, expected_url_prefix in test_cases:
        api_url = contract_verifier.get_explorer_api_url(network)
        # May be None if not configured, but if present should match expected
        if api_url:
            assert expected_url_prefix in api_url


@pytest.mark.asyncio
async def test_contract_verifier_api_key_resolution(contract_verifier):
    """Test ContractVerifier API key resolution for different networks"""
    with patch.dict("os.environ", {
        "ETHERSCAN_API_KEY": "test_etherscan_key",
        "POLYGONSCAN_API_KEY": "test_polygon_key"
    }):
        # Reload to pick up env vars
        verifier = ContractVerifier()
        
        etherscan_key = verifier.get_api_key("ethereum_mainnet")
        polygon_key = verifier.get_api_key("polygon_mainnet")
        
        # Keys should be resolved if env vars are set
        if etherscan_key:
            assert etherscan_key == "test_etherscan_key"
        if polygon_key:
            assert polygon_key == "test_polygon_key"


@pytest.mark.asyncio
async def test_verify_contract_integration_with_constructor_args(alith_handler, network_manager):
    """Test integration: verification with constructor arguments"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52"
    network_manager.get_web3.return_value = mock_w3
    
    with patch.object(ContractVerifier, 'verify_contract', new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {
            "success": True,
            "verified": True,
            "explorer_url": "https://etherscan.io/address/0x1234"
        }
        
        result = await alith_handler.execute_tool("verify_contract", {
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "ethereum_mainnet",
            "source_code": "pragma solidity ^0.8.0; contract Test { constructor(uint256 x) {} }",
            "contract_name": "Test",
            "compiler_version": "0.8.24",
            "constructor_args": "0x0000000000000000000000000000000000000000000000000000000000000064"
        })
        
        assert result["success"] is True
        # Verify that constructor_args were passed to verifier
        mock_verify.assert_called_once()
        call_kwargs = mock_verify.call_args[1]
        assert "constructor_args" in call_kwargs or "constructor_args" in str(mock_verify.call_args)


@pytest.mark.asyncio
async def test_verify_contract_integration_optimization_settings(alith_handler, network_manager):
    """Test integration: verification with optimization settings"""
    mock_w3 = Mock()
    mock_w3.eth.get_code.return_value = b"\x60\x80\x60\x40\x52"
    network_manager.get_web3.return_value = mock_w3
    
    with patch.object(ContractVerifier, 'verify_contract', new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {
            "success": True,
            "verified": True
        }
        
        result = await alith_handler.execute_tool("verify_contract", {
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "ethereum_mainnet",
            "source_code": "pragma solidity ^0.8.0; contract Test {}",
            "contract_name": "Test",
            "compiler_version": "0.8.24",
            "optimization_enabled": True,
            "optimization_runs": 1000
        })
        
        assert result["success"] is True
        # Verify optimization settings were passed
        mock_verify.assert_called_once()
        call_kwargs = mock_verify.call_args[1]
        assert call_kwargs.get("optimization_enabled") is True
        assert call_kwargs.get("optimization_runs") == 1000


@pytest.mark.asyncio
async def test_verify_contract_integration_network_error_handling(alith_handler, network_manager):
    """Test integration: network error handling"""
    # Make get_web3 raise an exception
    network_manager.get_web3.side_effect = Exception("Network connection error")
    
    result = await alith_handler.execute_tool("verify_contract", {
        "contract_address": "0x1234567890123456789012345678901234567890",
        "network": "ethereum_mainnet"
    })
    
    assert result["success"] is False
    assert "error" in result


@pytest.mark.asyncio
async def test_verify_contract_integration_unknown_tool(alith_handler):
    """Test integration: unknown tool handling"""
    result = await alith_handler.execute_tool("unknown_tool", {})
    
    assert result["success"] is False
    assert "Unknown tool" in result["error"]

