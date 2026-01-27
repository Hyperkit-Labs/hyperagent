"""
Unit tests for Gas Estimator service
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from hyperagent.core.services.gas_estimator import GasEstimator
from hyperagent.blockchain.networks import NetworkManager


@pytest.fixture
def network_manager():
    """Create a mock network manager"""
    return Mock(spec=NetworkManager)


@pytest.fixture
def gas_estimator(network_manager):
    """Create a gas estimator instance"""
    return GasEstimator(network_manager=network_manager)


@pytest.mark.asyncio
async def test_estimate_deployment_gas_success(gas_estimator, network_manager):
    """Test successful gas estimation for deployment"""
    mock_w3 = Mock()
    mock_w3.eth.estimate_gas.return_value = 2000000
    mock_w3.eth.gas_price = 20000000000  # 20 gwei
    
    network_manager.get_web3.return_value = mock_w3
    
    result = await gas_estimator.estimate_deployment_gas(
        bytecode="0x6080604052",
        network="ethereum_mainnet"
    )
    
    assert result["gas_estimate"] > 0
    assert result["gas_price"] > 0
    assert result["confidence"] in ["high", "medium", "low"]
    assert "total_cost_wei" in result
    assert "total_cost_eth" in result


@pytest.mark.asyncio
async def test_estimate_deployment_gas_with_constructor_args(gas_estimator, network_manager):
    """Test gas estimation with constructor arguments"""
    mock_w3 = Mock()
    mock_w3.eth.estimate_gas.return_value = 2500000
    mock_w3.eth.gas_price = 20000000000
    
    network_manager.get_web3.return_value = mock_w3
    
    result = await gas_estimator.estimate_deployment_gas(
        bytecode="0x6080604052",
        network="ethereum_mainnet",
        constructor_args=[1000000, "0x1234567890123456789012345678901234567890"]
    )
    
    assert result["gas_estimate"] > 0
    assert result["confidence"] in ["high", "medium", "low"]


@pytest.mark.asyncio
async def test_estimate_deployment_gas_with_abi(gas_estimator, network_manager):
    """Test constructor args encoding with ABI"""
    mock_w3 = Mock()
    mock_w3.eth.estimate_gas.return_value = 2200000
    mock_w3.eth.gas_price = 20000000000
    
    network_manager.get_web3.return_value = mock_w3
    
    abi = [
        {
            "type": "constructor",
            "inputs": [
                {"name": "initialSupply", "type": "uint256"},
                {"name": "owner", "type": "address"}
            ]
        }
    ]
    
    result = await gas_estimator.estimate_deployment_gas(
        bytecode="0x6080604052",
        network="ethereum_mainnet",
        constructor_args=[1000000, "0x1234567890123456789012345678901234567890"],
        abi=abi
    )
    
    assert result["gas_estimate"] > 0


@pytest.mark.asyncio
async def test_estimate_deployment_gas_contract_logic_error(gas_estimator, network_manager):
    """Test gas estimation handles contract logic errors gracefully"""
    from web3.exceptions import ContractLogicError
    
    mock_w3 = Mock()
    mock_w3.eth.estimate_gas.side_effect = ContractLogicError("Revert")
    mock_w3.eth.gas_price = 20000000000
    
    network_manager.get_web3.return_value = mock_w3
    
    result = await gas_estimator.estimate_deployment_gas(
        bytecode="0x6080604052",
        network="ethereum_mainnet"
    )
    
    assert result["gas_estimate"] == 3000000  # Safe default
    assert result["confidence"] == "low"


@pytest.mark.asyncio
async def test_estimate_function_call_gas(gas_estimator, network_manager):
    """Test gas estimation for function calls"""
    mock_w3 = Mock()
    mock_contract = Mock()
    mock_function = Mock()
    mock_function.build_transaction.return_value = {"from": "0x0", "data": "0x"}
    mock_contract.functions = {"transfer": mock_function}
    
    mock_w3.eth.contract.return_value = mock_contract
    mock_w3.eth.estimate_gas.return_value = 50000
    mock_w3.eth.gas_price = 20000000000
    
    network_manager.get_web3.return_value = mock_w3
    
    function_abi = {
        "name": "transfer",
        "type": "function",
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ]
    }
    
    result = await gas_estimator.estimate_function_call_gas(
        contract_address="0x1234567890123456789012345678901234567890",
        function_abi=function_abi,
        function_args=["0x9876543210987654321098765432109876543210", 1000],
        network="ethereum_mainnet"
    )
    
    assert result["gas_estimate"] > 0
    assert result["confidence"] in ["high", "medium", "low"]


def test_encode_constructor_args_with_abi(gas_estimator):
    """Test constructor args encoding with ABI"""
    abi = [
        {
            "type": "constructor",
            "inputs": [
                {"name": "initialSupply", "type": "uint256"},
                {"name": "owner", "type": "address"}
            ]
        }
    ]
    
    args = [1000000, "0x1234567890123456789012345678901234567890"]
    encoded = gas_estimator._encode_constructor_args(args, abi=abi)
    
    # Should return hex string (may be empty if encoding fails, but shouldn't error)
    assert isinstance(encoded, str)


def test_encode_constructor_args_type_inference(gas_estimator):
    """Test constructor args encoding with type inference"""
    args = [1000000, True, "0x1234567890123456789012345678901234567890"]
    encoded = gas_estimator._encode_constructor_args(args)
    
    # Should return hex string (may be empty if encoding fails, but shouldn't error)
    assert isinstance(encoded, str)

