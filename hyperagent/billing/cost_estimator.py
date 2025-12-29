"""
Cost estimation for HyperAgent operations

Credit System:
- 1 credit = $0.001 USD
- Model multipliers account for varying LLM costs
- Size multipliers based on contract complexity
- Chain multipliers for deployment features
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class CostEstimator:
    """
    Calculate USDC price based on LLM costs, infrastructure, and gas
    
    Credit System:
    - 1 credit = $0.001 (base unit)
    - Model multipliers account for varying LLM costs
    - Size multipliers based on contract complexity
    - Chain multipliers for deployment features
    """
    
    BASE_CREDITS = 10
    
    MODEL_MULTIPLIERS = {
        "gemini-2.5-flash": 1.0,
        "gemini-2.0-flash": 1.0,
        "gemini-flash": 1.0,
        "llama-3.1-405b": 1.5,
        "llama-3-70b": 1.3,
        "gpt-4-turbo": 2.0,
        "gpt-4": 2.0,
        "claude-opus-4.5": 2.5,
        "claude-sonnet-4.5": 2.0,
        "claude-sonnet": 1.8,
    }
    
    CHAIN_MULTIPLIERS = {
        "avalanche_fuji": 1.0,
        "avalanche_mainnet": 1.2,
        "mantle_testnet": 1.3,
        "mantle_mainnet": 1.4,
        "hyperion_testnet": 1.5,
        "hyperion_mainnet": 1.6,
        "ethereum_sepolia": 1.1,
        "ethereum_mainnet": 1.5,
        "polygon_amoy": 1.0,
        "polygon_mainnet": 1.2,
    }
    
    TOKEN_COSTS = {
        "gemini-2.5-flash": {
            "input": 0.000001,
            "output": 0.000002,
        },
        "gemini-2.0-flash": {
            "input": 0.000001,
            "output": 0.000002,
        },
        "gemini-flash": {
            "input": 0.000001,
            "output": 0.000002,
        },
        "gpt-4-turbo": {
            "input": 0.00001,
            "output": 0.00003,
        },
        "gpt-4": {
            "input": 0.00003,
            "output": 0.00006,
        },
        "claude-opus-4.5": {
            "input": 0.000015,
            "output": 0.000075,
        },
        "claude-sonnet-4.5": {
            "input": 0.000003,
            "output": 0.000015,
        },
        "claude-sonnet": {
            "input": 0.000003,
            "output": 0.000015,
        },
        "llama-3.1-405b": {
            "input": 0.000002,
            "output": 0.000004,
        },
        "llama-3-70b": {
            "input": 0.000001,
            "output": 0.000002,
        },
    }
    
    CREDIT_TO_USDC_RATE = 0.001
    MINIMUM_PRICE_USDC = 0.01
    
    # Task-based pricing (base USDC prices per task)
    TASK_BASE_PRICES = {
        "generation": 0.1,
        "audit": 0.1,
        "testing": 0.1,
        "deployment": 0.1,
    }
    
    def __init__(
        self,
        base_credits: Optional[int] = None,
        credit_rate: Optional[float] = None,
        min_price: Optional[float] = None,
    ):
        """
        Initialize cost estimator
        
        Args:
            base_credits: Base credit cost for operations (default: 10)
            credit_rate: USDC per credit (default: 0.001)
            min_price: Minimum price in USDC (default: 0.01)
        """
        self.base_credits = base_credits or self.BASE_CREDITS
        self.credit_rate = credit_rate or self.CREDIT_TO_USDC_RATE
        self.min_price = min_price or self.MINIMUM_PRICE_USDC
    
    def estimate_generation_cost(
        self,
        prompt_length: int,
        model: str,
        chain: str
    ) -> float:
        """
        Estimate cost in USDC for contract generation
        
        Args:
            prompt_length: Length of user prompt in characters
            model: LLM model identifier
            chain: Target blockchain network
        
        Returns:
            USDC amount (e.g., 0.15)
        """
        credits = self.base_credits
        
        size_credits = prompt_length // 100
        credits += size_credits
        
        model_multiplier = self.MODEL_MULTIPLIERS.get(model, 1.5)
        credits *= model_multiplier
        
        chain_multiplier = self.CHAIN_MULTIPLIERS.get(chain, 1.0)
        credits *= chain_multiplier
        
        usdc_price = credits * self.credit_rate
        
        return max(self.min_price, usdc_price)
    
    def estimate_deployment_cost(
        self,
        contract_size: int,
        chain: str,
        use_gasless: bool = True
    ) -> float:
        """
        Estimate cost for contract deployment
        
        Args:
            contract_size: Size of compiled contract in bytes
            chain: Target blockchain network
            use_gasless: Whether using gasless deployment
        
        Returns:
            USDC amount
        """
        credits = self.base_credits * 0.5
        
        size_credits = contract_size // 1000
        credits += size_credits
        
        chain_multiplier = self.CHAIN_MULTIPLIERS.get(chain, 1.0)
        credits *= chain_multiplier
        
        if not use_gasless:
            credits *= 0.5
        
        usdc_price = credits * self.credit_rate
        
        return max(self.min_price, usdc_price)
    
    def estimate_audit_cost(
        self,
        contract_lines: int,
        audit_depth: str = "standard"
    ) -> float:
        """
        Estimate cost for security audit
        
        Args:
            contract_lines: Number of lines in contract
            audit_depth: Audit depth level (quick, standard, deep)
        
        Returns:
            USDC amount
        """
        depth_multipliers = {
            "quick": 0.5,
            "standard": 1.0,
            "deep": 2.0,
        }
        
        credits = self.base_credits * 2
        
        line_credits = contract_lines // 10
        credits += line_credits
        
        depth_multiplier = depth_multipliers.get(audit_depth, 1.0)
        credits *= depth_multiplier
        
        usdc_price = credits * self.credit_rate
        
        return max(self.min_price, usdc_price)
    
    def calculate_token_split(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int
    ) -> Dict[str, float]:
        """
        Calculate input/output token split and costs with percentages
        
        Provides detailed breakdown of context (input) vs generation (output) costs
        for transparency into RAG context costs vs actual code generation costs
        
        Args:
            model: LLM model identifier
            input_tokens: Number of input tokens (RAG templates + system prompt)
            output_tokens: Number of output tokens (generated code)
        
        Returns:
            Dictionary with split percentages and individual costs
        """
        costs = self.TOKEN_COSTS.get(model)
        if not costs:
            logger.warning(f"Unknown model '{model}', using gemini-flash costs")
            costs = self.TOKEN_COSTS["gemini-flash"]
        
        total_tokens = input_tokens + output_tokens
        
        input_cost = (input_tokens / 1000) * costs["input"]
        output_cost = (output_tokens / 1000) * costs["output"]
        total_cost = input_cost + output_cost
        
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "input_percentage": (input_tokens / total_tokens * 100) if total_tokens > 0 else 0,
            "output_percentage": (output_tokens / total_tokens * 100) if total_tokens > 0 else 0,
            "input_cost_usd": input_cost,
            "output_cost_usd": output_cost,
            "total_cost_usd": total_cost,
            "cost_breakdown": {
                "context_cost": input_cost,
                "generation_cost": output_cost
            }
        }
    
    def calculate_actual_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int
    ) -> Dict[str, float]:
        """
        Calculate actual costs based on token usage
        
        Args:
            model: LLM model identifier
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens used
        
        Returns:
            Dictionary with cost breakdown
        """
        costs = self.TOKEN_COSTS.get(model)
        if not costs:
            logger.warning(f"Unknown model '{model}', using gemini-flash costs")
            costs = self.TOKEN_COSTS["gemini-flash"]
        
        input_cost = (input_tokens / 1000) * costs["input"]
        output_cost = (output_tokens / 1000) * costs["output"]
        total_cost = input_cost + output_cost
        
        total_tokens = input_tokens + output_tokens
        cost_per_token = total_cost / total_tokens if total_tokens > 0 else 0
        credits = int(total_cost / self.credit_rate)
        
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "input_cost_usd": input_cost,
            "output_cost_usd": output_cost,
            "total_cost_usd": total_cost,
            "cost_per_token": cost_per_token,
            "credits": credits,
        }
    
    def calculate_profit(
        self,
        revenue_usdc: float,
        actual_cost_usd: float
    ) -> Dict[str, float]:
        """
        Calculate profit from a transaction
        
        Args:
            revenue_usdc: Revenue collected from user
            actual_cost_usd: Actual cost of operation
        
        Returns:
            Profit metrics
        """
        profit_usd = revenue_usdc - actual_cost_usd
        profit_margin = (profit_usd / revenue_usdc * 100) if revenue_usdc > 0 else 0
        
        return {
            "revenue_usdc": revenue_usdc,
            "cost_usd": actual_cost_usd,
            "profit_usd": profit_usd,
            "profit_margin_percent": profit_margin,
        }
    
    def estimate_testing_cost(
        self,
        contract_lines: int,
        test_coverage: str = "standard"
    ) -> float:
        """
        Estimate cost for contract testing
        
        Args:
            contract_lines: Number of lines in contract
            test_coverage: Test coverage level (basic, standard, comprehensive)
        
        Returns:
            USDC amount
        """
        coverage_multipliers = {
            "basic": 0.5,
            "standard": 1.0,
            "comprehensive": 1.5,
        }
        
        credits = self.base_credits * 1.5
        
        line_credits = contract_lines // 20
        credits += line_credits
        
        coverage_multiplier = coverage_multipliers.get(test_coverage, 1.0)
        credits *= coverage_multiplier
        
        usdc_price = credits * self.credit_rate
        
        return max(self.min_price, usdc_price)
    
    def calculate_task_cost(
        self,
        selected_tasks: List[str],
        network: str,
        model: str = "gemini-2.5-flash",
        contract_complexity: str = "standard",
        prompt_length: Optional[int] = None,
        contract_lines: Optional[int] = None,
        contract_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calculate total cost for selected tasks
        
        Args:
            selected_tasks: List of task names ["generation", "audit", "testing", "deployment"]
            network: Target blockchain network
            model: LLM model for generation (only affects generation task)
            contract_complexity: "simple", "standard", "complex" (affects all tasks)
            prompt_length: Length of prompt in characters (for generation cost)
            contract_lines: Number of contract lines (for audit/testing cost)
            contract_size: Size of contract in bytes (for deployment cost)
        
        Returns:
            {
                "total_usdc": 0.4,
                "breakdown": {
                    "generation": {"base": 0.1, "multiplier": 1.0, "final": 0.1},
                    "audit": {"base": 0.1, "multiplier": 1.2, "final": 0.12},
                    ...
                },
                "network_multiplier": 1.0,
                "model_multiplier": 1.0,
                "selected_tasks": ["generation", "audit"],
                "network": "avalanche_fuji"
            }
        """
        # Validate selected tasks
        valid_tasks = ["generation", "audit", "testing", "deployment"]
        selected_tasks = [task.lower() for task in selected_tasks if task.lower() in valid_tasks]
        
        if not selected_tasks:
            raise ValueError("At least one valid task must be selected")
        
        # Get network multiplier
        network_multiplier = self.CHAIN_MULTIPLIERS.get(network, 1.0)
        
        # Get model multiplier (only applies to generation)
        model_multiplier = self.MODEL_MULTIPLIERS.get(model, 1.5) if "generation" in selected_tasks else 1.0
        
        # Complexity multipliers
        complexity_multipliers = {
            "simple": 0.8,
            "standard": 1.0,
            "complex": 1.2,
        }
        complexity_multiplier = complexity_multipliers.get(contract_complexity, 1.0)
        
        breakdown = {}
        total_usdc = 0.0
        
        # Calculate cost for each selected task
        for task in selected_tasks:
            base_price = self.TASK_BASE_PRICES.get(task, 0.1)
            
            # Calculate task-specific cost
            if task == "generation":
                if prompt_length:
                    task_cost = self.estimate_generation_cost(
                        prompt_length=prompt_length,
                        model=model,
                        chain=network
                    )
                else:
                    # Use base price with multipliers
                    task_cost = base_price * model_multiplier * network_multiplier * complexity_multiplier
            elif task == "audit":
                if contract_lines:
                    task_cost = self.estimate_audit_cost(
                        contract_lines=contract_lines,
                        audit_depth=contract_complexity if contract_complexity in ["quick", "standard", "deep"] else "standard"
                    )
                else:
                    task_cost = base_price * network_multiplier * complexity_multiplier
            elif task == "testing":
                if contract_lines:
                    task_cost = self.estimate_testing_cost(
                        contract_lines=contract_lines,
                        test_coverage=contract_complexity if contract_complexity in ["basic", "standard", "comprehensive"] else "standard"
                    )
                else:
                    task_cost = base_price * network_multiplier * complexity_multiplier
            elif task == "deployment":
                if contract_size:
                    task_cost = self.estimate_deployment_cost(
                        contract_size=contract_size,
                        chain=network,
                        use_gasless=True
                    )
                else:
                    task_cost = base_price * network_multiplier * complexity_multiplier
            else:
                # Fallback for unknown tasks
                task_cost = base_price * network_multiplier * complexity_multiplier
            
            # Ensure minimum price
            task_cost = max(self.min_price, task_cost)
            
            # Calculate multipliers applied
            task_multiplier = 1.0
            if task == "generation":
                task_multiplier = model_multiplier * network_multiplier * complexity_multiplier
            else:
                task_multiplier = network_multiplier * complexity_multiplier
            
            breakdown[task] = {
                "base": base_price,
                "multiplier": task_multiplier,
                "final": round(task_cost, 4)
            }
            
            total_usdc += task_cost
        
        return {
            "total_usdc": round(total_usdc, 4),
            "breakdown": breakdown,
            "network_multiplier": network_multiplier,
            "model_multiplier": model_multiplier if "generation" in selected_tasks else 1.0,
            "complexity_multiplier": complexity_multiplier,
            "selected_tasks": selected_tasks,
            "network": network
        }

