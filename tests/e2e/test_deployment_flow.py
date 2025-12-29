"""End-to-end deployment flow tests"""

import pytest
import httpx
from web3 import Web3
from eth_account import Account

from hyperagent.core.config import settings


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_server_wallet_deployment_flow():
    """Test complete server-wallet deployment on Avalanche Fuji"""
    
    # 1. Setup test wallet and compiled contract
    test_wallet = Account.create()
    wallet_address = test_wallet.address
    
    # Simple ERC20 token for testing
    compiled_contract = {
        "contract_name": "TestToken",
        "source_code": """
        pragma solidity ^0.8.0;
        contract TestToken {
            string public name = "Test";
            string public symbol = "TST";
        }
        """,
        "bytecode": "0x608060405234801561001057600080fd5b50...",  # Simplified
        "abi": [
            {"inputs": [], "name": "name", "outputs": [{"type": "string"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "symbol", "outputs": [{"type": "string"}], "stateMutability": "view", "type": "function"}
        ]
    }
    
    # 2. Simulate x402 USDC payment and deployment
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.api_url}/api/v1/x402/deployments/deploy",
            headers={
                "X-Wallet-Address": wallet_address,
                "Content-Type": "application/json"
            },
            json={
                "compiled_contract": compiled_contract,
                "network": "avalanche_fuji",
                "wallet_address": wallet_address,
                "use_gasless": True
            }
        )
        
        # 3. Verify payment and deployment response
        assert response.status_code in [200, 402], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 402:
            # X402 payment required - this is expected for first deployment
            payment_data = response.json()
            assert "x402Version" in payment_data
            assert payment_data.get("error") == "payment_required"
            pytest.skip("X402 payment required - manual payment needed for e2e test")
        
        # 4. Verify successful deployment
        deployment = response.json()
        assert "contract_address" in deployment
        assert deployment["contract_address"].startswith("0x")
        assert "transaction_hash" in deployment
        assert deployment["transaction_hash"].startswith("0x")
        
        contract_address = deployment["contract_address"]
        tx_hash = deployment["transaction_hash"]
        
        # 5. Verify on-chain via Web3
        fuji_rpc = "https://api.avax-test.network/ext/bc/C/rpc"
        w3 = Web3(Web3.HTTPProvider(fuji_rpc))
        
        # Check contract code exists
        contract_code = w3.eth.get_code(Web3.to_checksum_address(contract_address))
        assert len(contract_code) > 0, "Contract code not found on-chain"
        
        # Check transaction receipt
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        assert receipt["status"] == 1, "Transaction failed on-chain"
        assert receipt["contractAddress"].lower() == contract_address.lower()


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_payment_verification():
    """Test X402 USDC payment flow"""
    
    test_wallet = Account.create()
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Attempt deployment without payment
        response = await client.post(
            f"{settings.api_url}/api/v1/x402/deployments/deploy",
            headers={"X-Wallet-Address": test_wallet.address},
            json={
                "compiled_contract": {
                    "contract_name": "Test",
                    "bytecode": "0x6080...",
                    "abi": []
                },
                "network": "avalanche_fuji",
                "wallet_address": test_wallet.address,
                "use_gasless": True
            }
        )
        
        # Should return 402 Payment Required
        assert response.status_code == 402
        payment_data = response.json()
        assert payment_data.get("x402Version") == 2
        assert "price" in payment_data


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_rate_limiting():
    """Test deployment rate limits are enforced"""
    
    test_wallet = Account.create()
    
    # Get rate limit info
    async with httpx.AsyncClient() as client:
        # Make deployments until rate limit hit
        deployment_count = 0
        max_attempts = 12  # Should hit limit at 10
        
        for i in range(max_attempts):
            response = await client.post(
                f"{settings.api_url}/api/v1/x402/deployments/deploy",
                headers={"X-Wallet-Address": test_wallet.address},
                json={
                    "compiled_contract": {
                        "contract_name": f"Test{i}",
                        "bytecode": "0x6080...",
                        "abi": []
                    },
                    "network": "avalanche_fuji",
                    "wallet_address": test_wallet.address,
                    "use_gasless": True
                }
            )
            
            if response.status_code == 429:
                # Rate limit hit
                error_data = response.json()
                assert "Rate limit exceeded" in error_data.get("detail", "")
                break
            
            deployment_count += 1
        
        # Should hit rate limit before max_attempts
        assert deployment_count < max_attempts, "Rate limit not enforced"


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_contract_ownership():
    """Verify user owns deployed contract"""
    
    pytest.skip("Requires actual USDC payment - manual test only")
    
    # This test requires:
    # 1. Actual USDC payment
    # 2. Contract with owner() function
    # 3. On-chain verification that user is owner


@pytest.mark.asyncio
@pytest.mark.e2e
async def test_concurrent_deployments():
    """Test handling multiple users deploying simultaneously"""
    
    import asyncio
    
    async def deploy_for_user(user_id: int):
        """Deploy contract for a test user"""
        test_wallet = Account.create()
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.api_url}/api/v1/x402/deployments/deploy",
                headers={"X-Wallet-Address": test_wallet.address},
                json={
                    "compiled_contract": {
                        "contract_name": f"ConcurrentTest{user_id}",
                        "bytecode": "0x6080...",
                        "abi": []
                    },
                    "network": "avalanche_fuji",
                    "wallet_address": test_wallet.address,
                    "use_gasless": True
                }
            )
            
            return response.status_code, user_id
    
    # Deploy for 5 users concurrently
    tasks = [deploy_for_user(i) for i in range(5)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # All should either succeed or require payment (not crash)
    for result in results:
        if isinstance(result, Exception):
            pytest.fail(f"Concurrent deployment failed: {result}")
        
        status_code, user_id = result
        assert status_code in [200, 402, 429], f"User {user_id} got unexpected status: {status_code}"

