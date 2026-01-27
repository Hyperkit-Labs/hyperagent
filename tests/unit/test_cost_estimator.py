"""Unit tests for cost estimator"""

import pytest
from hyperagent.billing.cost_estimator import CostEstimator


class TestCostEstimator:
    """Test cost estimation logic"""
    
    @pytest.fixture
    def estimator(self):
        return CostEstimator()
    
    def test_estimate_generation_cost_basic(self, estimator):
        """Test basic generation cost calculation"""
        cost = estimator.estimate_generation_cost(
            prompt_length=100,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        assert cost >= estimator.min_price
        assert isinstance(cost, float)
    
    def test_estimate_generation_cost_with_multipliers(self, estimator):
        """Test that model and chain multipliers affect price"""
        cost_cheap = estimator.estimate_generation_cost(
            prompt_length=100,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        cost_expensive = estimator.estimate_generation_cost(
            prompt_length=100,
            model="claude-opus-4.5",
            chain="mantle_testnet"
        )
        
        assert cost_expensive > cost_cheap
    
    def test_estimate_generation_cost_prompt_size_matters(self, estimator):
        """Test that larger prompts cost more"""
        cost_small = estimator.estimate_generation_cost(
            prompt_length=100,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        cost_large = estimator.estimate_generation_cost(
            prompt_length=1000,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        assert cost_large > cost_small
    
    def test_estimate_deployment_cost(self, estimator):
        """Test deployment cost calculation"""
        cost = estimator.estimate_deployment_cost(
            contract_size=5000,
            chain="avalanche_fuji",
            use_gasless=True
        )
        
        assert cost >= estimator.min_price
        assert isinstance(cost, float)
    
    def test_estimate_audit_cost(self, estimator):
        """Test audit cost calculation"""
        cost_quick = estimator.estimate_audit_cost(
            contract_lines=100,
            audit_depth="quick"
        )
        
        cost_deep = estimator.estimate_audit_cost(
            contract_lines=100,
            audit_depth="deep"
        )
        
        assert cost_deep > cost_quick
    
    def test_calculate_actual_cost(self, estimator):
        """Test actual cost calculation based on tokens"""
        cost_data = estimator.calculate_actual_cost(
            model="gemini-flash",
            input_tokens=1000,
            output_tokens=500
        )
        
        assert "total_cost_usd" in cost_data
        assert "input_cost_usd" in cost_data
        assert "output_cost_usd" in cost_data
        assert "credits" in cost_data
        assert cost_data["total_cost_usd"] > 0
        assert cost_data["credits"] > 0
    
    def test_calculate_actual_cost_unknown_model(self, estimator):
        """Test that unknown models fall back to default pricing"""
        cost_data = estimator.calculate_actual_cost(
            model="unknown-model-xyz",
            input_tokens=1000,
            output_tokens=500
        )
        
        assert cost_data["total_cost_usd"] > 0
    
    def test_calculate_profit(self, estimator):
        """Test profit calculation"""
        profit_data = estimator.calculate_profit(
            revenue_usdc=0.10,
            actual_cost_usd=0.02
        )
        
        assert profit_data["profit_usd"] == 0.08
        assert profit_data["profit_margin_percent"] == 80.0
    
    def test_calculate_profit_loss(self, estimator):
        """Test profit calculation with loss"""
        profit_data = estimator.calculate_profit(
            revenue_usdc=0.02,
            actual_cost_usd=0.10
        )
        
        assert profit_data["profit_usd"] < 0
        assert profit_data["profit_margin_percent"] < 0
    
    def test_minimum_price_enforced(self, estimator):
        """Test that minimum price is always enforced"""
        cost = estimator.estimate_generation_cost(
            prompt_length=1,
            model="gemini-flash",
            chain="avalanche_fuji"
        )
        
        assert cost >= estimator.min_price

