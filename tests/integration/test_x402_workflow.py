"""
Integration tests for x402 payment workflow

Tests:
- Payment verification
- Workflow creation with payment
- Deployment with user wallet
- Gasless deployment flow
"""
import pytest
import httpx
import asyncio
from typing import Dict, Any


@pytest.mark.asyncio
async def test_x402_service_health():
    """Test x402 verification service health endpoint"""
    from hyperagent.core.config import settings
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(f"{settings.x402_service_url}/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data or "healthy" in str(data).lower()


@pytest.mark.asyncio
async def test_x402_contract_generate_requires_payment():
    """Test that contract generation requires payment (returns 402)"""
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Make request without payment
        response = await client.post(
            f"{base_url}/x402/contracts/generate",
            json={
                "nlp_description": "Create an ERC20 token",
                "contract_type": "ERC20",
                "network": "avalanche_fuji"
            }
        )
        
        # Should return 402 Payment Required
        assert response.status_code == 402
        
        data = response.json()
        assert "error" in data
        assert "Payment Required" in data["error"] or "payment" in data.get("error", "").lower()
        assert "price_usdc" in data or "price" in data
        assert "network" in data


@pytest.mark.asyncio
async def test_x402_workflow_requires_payment():
    """Test that workflow creation from contract requires payment"""
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Make request without payment
        response = await client.post(
            f"{base_url}/x402/workflows/create-from-contract",
            json={
                "contract_code": "pragma solidity ^0.8.0; contract Test {}",
                "contract_type": "ERC20",
                "network": "avalanche_fuji",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        # Should return 402 Payment Required
        assert response.status_code == 402
        
        data = response.json()
        assert "error" in data
        assert "Payment Required" in data["error"] or "payment" in data.get("error", "").lower()


@pytest.mark.asyncio
async def test_x402_deployment_prepare():
    """Test deployment preparation endpoint (should not require payment)"""
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Prepare deployment (preparation doesn't require payment)
        response = await client.post(
            f"{base_url}/x402/deployments/prepare",
            json={
                "compiled_contract": {
                    "bytecode": "0x608060405234801561001057600080fd5b50",
                    "abi": []
                },
                "network": "avalanche_fuji",
                "constructor_args": [],
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        # Should return 200 with unsigned transaction
        # Or 400/422 if validation fails (which is expected without real contract)
        assert response.status_code in [200, 400, 422]


@pytest.mark.asyncio
async def test_x402_middleware_verification():
    """Test x402 middleware payment verification logic"""
    from hyperagent.api.middleware.x402 import X402Middleware
    from hyperagent.core.config import settings
    
    if not settings.x402_enabled:
        pytest.skip("x402 not enabled")
    
    middleware = X402Middleware()
    
    # Test price tier mapping
    basic_price = middleware.get_price_for_tier("basic")
    assert basic_price > 0
    
    premium_price = middleware.get_price_for_tier("premium")
    assert premium_price > basic_price


@pytest.mark.asyncio
async def test_network_supports_x402():
    """Test network x402 support detection"""
    from hyperagent.core.config import settings
    
    # Check Avalanche networks support x402
    x402_networks = [n.strip() for n in settings.x402_enabled_networks.split(",")]
    
    assert "avalanche_fuji" in x402_networks or "avalanche_mainnet" in x402_networks
    
    # Hyperion and Mantle should not be in x402 list
    assert "hyperion_testnet" not in x402_networks
    assert "mantle_testnet" not in x402_networks


@pytest.mark.asyncio
async def test_facilitator_configuration():
    """Test facilitator configuration is valid"""
    from hyperagent.core.config import settings
    
    # If x402 is enabled, facilitator must be configured
    if settings.x402_enabled:
        assert settings.thirdweb_secret_key, "THIRDWEB_SECRET_KEY required when x402 enabled"
        assert settings.thirdweb_server_wallet_address, "THIRDWEB_SERVER_WALLET_ADDRESS required when x402 enabled"
        assert settings.thirdweb_server_wallet_address.startswith("0x"), "Invalid wallet address format"
        assert settings.merchant_wallet_address, "MERCHANT_WALLET_ADDRESS required when x402 enabled"
        assert settings.merchant_wallet_address.startswith("0x"), "Invalid merchant address format"


@pytest.mark.asyncio
async def test_usdc_addresses_configured():
    """Test USDC addresses are configured for x402 networks"""
    from hyperagent.core.config import settings
    
    if not settings.x402_enabled:
        pytest.skip("x402 not enabled")
    
    # Check USDC addresses for Avalanche networks
    assert settings.usdc_address_fuji, "USDC_ADDRESS_FUJI required for x402"
    assert settings.usdc_address_fuji.startswith("0x"), "Invalid USDC address format"
    
    assert settings.usdc_address_avalanche, "USDC_ADDRESS_AVALANCHE required for x402"
    assert settings.usdc_address_avalanche.startswith("0x"), "Invalid USDC address format"


@pytest.mark.skip(reason="Requires real wallet and payment - manual test only")
@pytest.mark.asyncio
async def test_full_x402_workflow_with_payment():
    """Test complete x402 workflow with actual payment (manual test)"""
    # This test requires:
    # 1. Real wallet connection
    # 2. Actual payment transaction
    # 3. Funded facilitator wallet
    # 
    # Should be run manually with:
    # - Connected wallet
    # - Testnet AVAX and USDC
    # - Properly configured facilitator
    pass


@pytest.mark.skip(reason="Requires real wallet and signed transaction - manual test only")
@pytest.mark.asyncio
async def test_user_wallet_deployment():
    """Test user-wallet-based deployment (manual test)"""
    # This test requires:
    # 1. Real wallet connection
    # 2. Signed transaction
    # 3. Network RPC access
    #
    # Should be run manually with:
    # - Connected wallet
    # - Testnet tokens
    # - Properly configured network
    pass

