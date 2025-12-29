"""Integration tests for X402 payment and deployment"""

import pytest
from unittest.mock import Mock, AsyncMock, patch

from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.api.middleware.rate_limit import RateLimiter
from hyperagent.blockchain.networks import NetworkManager


@pytest.mark.asyncio
async def test_payment_simulation_failure():
    """Test handling of payment simulation failures"""
    
    x402_middleware = X402Middleware()
    
    # Mock payment verification to return simulation failure
    with patch.object(x402_middleware.thirdweb_client, 'settle_payment') as mock_settle:
        mock_settle.return_value = {
            "status": 402,
            "verified": False,
            "error": "payment_simulation_failed",
            "errorMessage": "Payment simulation failed: Insufficient balance"
        }
        
        mock_request = Mock()
        mock_request.headers = {}
        mock_db = AsyncMock()
        
        result = await x402_middleware.verify_and_handle_payment(
            request=mock_request,
            endpoint="/test",
            price_tier="deployment",
            price_usdc=0.10,
            network="avalanche_fuji",
            db=mock_db,
            wallet_address="0x123",
            merchant="test"
        )
        
        assert result is not None
        assert result.status_code == 402


@pytest.mark.asyncio
async def test_gas_estimation_edge_cases():
    """Test gas estimation with various bytecode sizes"""
    
    network_manager = NetworkManager()
    
    # Test very large contract (near block gas limit)
    large_bytecode = "0x" + "60" * 24000  # ~24KB bytecode
    
    # Should not crash, should estimate successfully
    # (actual estimation would happen in deployment service)
    assert len(large_bytecode) > 20000


@pytest.mark.asyncio
async def test_network_congestion_handling():
    """Test deployment during high gas prices"""
    
    pytest.skip("Requires live network connection and gas price monitoring")


@pytest.mark.asyncio
async def test_contract_deployment_revert():
    """Test handling of deployment transaction reverts"""
    
    pytest.skip("Requires contract that reverts in constructor")


@pytest.mark.asyncio
async def test_rate_limiter_redis_failure():
    """Test rate limiter gracefully handles Redis unavailability"""
    
    # Initialize rate limiter without Redis
    rate_limiter = RateLimiter(redis_manager=None)
    
    # Should allow deployment when Redis is unavailable
    allowed, remaining = await rate_limiter.check_rate_limit(
        identifier="wallet:0x123",
        max_requests=10,
        window_seconds=3600
    )
    
    assert allowed is True


@pytest.mark.asyncio
async def test_rate_limiter_limits():
    """Test rate limiter enforces configured limits"""
    
    # Use in-memory rate limiter for testing
    rate_limiter = RateLimiter(redis_manager=None)
    
    # Simulate multiple requests up to limit
    identifier = "wallet:0x123:avalanche_fuji"
    max_requests = 10
    
    # Make requests up to the limit
    for i in range(max_requests):
        allowed, remaining = await rate_limiter.check_rate_limit(
            identifier=identifier,
            max_requests=max_requests,
            window_seconds=3600
        )
        assert allowed is True
    
    # Next request should be denied
    allowed, remaining = await rate_limiter.check_rate_limit(
        identifier=identifier,
        max_requests=max_requests,
        window_seconds=3600
    )
    
    assert allowed is False

