"""Integration tests for x402 payment flows with spending controls"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.billing.cost_estimator import CostEstimator
from hyperagent.billing.spending_controls import SpendingControlsManager
from hyperagent.models.spending_control import SpendingControl


class TestX402PaymentFlows:
    """Test x402 payment flows with dynamic pricing and spending controls"""
    
    @pytest.fixture
    def x402_middleware(self):
        return X402Middleware()
    
    @pytest.fixture
    def mock_request(self):
        request = MagicMock(spec=Request)
        request.method = "POST"
        request.base_url = "http://localhost:8000"
        request.headers = {"x-payment": None}
        return request
    
    @pytest.fixture
    def mock_db(self):
        return AsyncMock(spec=AsyncSession)
    
    @pytest.fixture
    def mock_spending_control(self):
        return SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=0.0,
            monthly_spent=0.0,
            is_active=True
        )
    
    def test_cost_estimator_dynamic_pricing(self):
        """Test that cost estimator calculates dynamic prices"""
        estimator = CostEstimator()
        
        cost_small_prompt = estimator.estimate_generation_cost(
            prompt_length=100,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        cost_large_prompt = estimator.estimate_generation_cost(
            prompt_length=1000,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        assert cost_large_prompt > cost_small_prompt
    
    def test_cost_estimator_model_multipliers(self):
        """Test that different models have different costs"""
        estimator = CostEstimator()
        
        cost_cheap = estimator.estimate_generation_cost(
            prompt_length=500,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        cost_expensive = estimator.estimate_generation_cost(
            prompt_length=500,
            model="claude-opus-4.5",
            chain="avalanche_fuji"
        )
        
        assert cost_expensive > cost_cheap
    
    def test_cost_estimator_chain_multipliers(self):
        """Test that different chains have different costs"""
        estimator = CostEstimator()
        
        cost_standard = estimator.estimate_generation_cost(
            prompt_length=500,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        cost_advanced = estimator.estimate_generation_cost(
            prompt_length=500,
            model="gemini-flash",
            chain="mantle_testnet"
        )
        
        assert cost_advanced > cost_standard
    
    @pytest.mark.asyncio
    async def test_spending_controls_block_exceeded_daily(self, mock_db, mock_spending_control):
        """Test that spending controls block payments exceeding daily limit"""
        mock_spending_control.daily_spent = 9.5
        
        manager = SpendingControlsManager()
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_spending_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=1.0,
                merchant="hyperagent",
                db=mock_db
            )
            
            assert allowed is False
            assert "Daily limit exceeded" in error
    
    @pytest.mark.asyncio
    async def test_spending_controls_allow_within_limits(self, mock_db, mock_spending_control):
        """Test that spending controls allow payments within limits"""
        mock_spending_control.daily_spent = 5.0
        
        manager = SpendingControlsManager()
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_spending_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=1.0,
                merchant="hyperagent",
                db=mock_db
            )
            
            assert allowed is True
            assert error is None
    
    @pytest.mark.asyncio
    async def test_spending_controls_merchant_whitelist(self, mock_db, mock_spending_control):
        """Test that spending controls enforce merchant whitelist"""
        mock_spending_control.whitelist_merchants = ["hyperagent", "approved-merchant"]
        
        manager = SpendingControlsManager()
        
        with patch.object(manager, '_get_or_create_controls', return_value=mock_spending_control):
            allowed, error = await manager.check_spending_limit(
                user_wallet="0x1234",
                amount_usdc=1.0,
                merchant="unapproved-merchant",
                db=mock_db
            )
            
            assert allowed is False
            assert "not in whitelist" in error
    
    @pytest.mark.asyncio
    async def test_spending_controls_reset_counters(self, mock_db):
        """Test that spending counters reset after time period"""
        from datetime import datetime, timedelta
        
        control = SpendingControl(
            wallet_address="0x1234",
            daily_limit=10.0,
            monthly_limit=100.0,
            daily_spent=5.0,
            monthly_spent=50.0,
            daily_reset_at=datetime.utcnow() - timedelta(hours=1),
            monthly_reset_at=datetime.utcnow() - timedelta(days=35),
            is_active=True
        )
        
        control.reset_if_needed()
        
        assert control.daily_spent == 0.0
        assert control.monthly_spent == 0.0
    
    def test_x402_middleware_dynamic_pricing_generation(self, x402_middleware):
        """Test x402 middleware integrates dynamic pricing for generation"""
        cost_estimator = x402_middleware.cost_estimator
        
        cost = cost_estimator.estimate_generation_cost(
            prompt_length=200,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        assert cost >= cost_estimator.min_price
    
    def test_x402_middleware_dynamic_pricing_deployment(self, x402_middleware):
        """Test x402 middleware integrates dynamic pricing for deployment"""
        cost_estimator = x402_middleware.cost_estimator
        
        cost = cost_estimator.estimate_deployment_cost(
            contract_size=8000,
            chain="avalanche_fuji",
            use_gasless=True
        )
        
        assert cost >= cost_estimator.min_price

