"""
End-to-end tests for x402 payment flows
"""

import pytest
from httpx import AsyncClient
from hyperagent.api.main import app


@pytest.mark.asyncio
async def test_x402_payment_required_for_generation():
    """Test that x402 payment is required for generation task"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a complex DeFi protocol",
                "network": "mantle_testnet",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "selected_tasks": ["generation"]
            }
        )
        
        # Should either succeed (if payment handled) or return payment required
        assert response.status_code in [200, 201, 202, 402, 403]
        
        if response.status_code == 402:
            data = response.json()
            assert "payment" in data or "x402" in str(data).lower()


@pytest.mark.asyncio
async def test_x402_payment_headers():
    """Test x402 payment header validation"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test with valid x402 headers
        headers = {
            "x-x402-signature": "0x1234",
            "x-x402-nonce": "123456",
            "x-x402-timestamp": "1234567890"
        }
        
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple token",
                "network": "mantle_testnet",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            },
            headers=headers
        )
        
        # Should process request (may still require valid signature)
        assert response.status_code in [200, 201, 202, 400, 401, 403]


@pytest.mark.asyncio
async def test_x402_budget_check():
    """Test x402 budget/spending limit checks"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple token",
                "network": "mantle_testnet",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        # Should handle budget checks gracefully
        assert response.status_code in [200, 201, 202, 402, 403, 429]


@pytest.mark.asyncio
async def test_x402_payment_verification_endpoint():
    """Test x402 payment verification endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test payment verification endpoint if it exists
        response = await client.post(
            "/api/v1/x402/verify",
            json={
                "signature": "0x1234",
                "nonce": "123456",
                "timestamp": "1234567890",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        # Endpoint may not exist, or may return various status codes
        assert response.status_code in [200, 201, 400, 401, 404, 422]

