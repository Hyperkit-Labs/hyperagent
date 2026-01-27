# Cost Estimation and Dynamic Pricing

HyperAgent uses a credit-based cost estimation system to calculate service prices dynamically based on actual resource consumption.

## Credit System

The cost estimation system is built on a credit-based model:

- **1 credit = $0.001 USD**
- Base operation cost: 10 credits ($0.01)
- Minimum price: $0.01 USDC
- Prices adjust based on model costs, prompt size, and target chain

## Cost Factors

### Model Multipliers

Different LLM models have varying token costs:

| Model | Multiplier | Use Case |
|-------|-----------|----------|
| gemini-2.5-flash | 1.0x | Primary (cheapest) |
| llama-3.1-405b | 1.5x | Fallback |
| gpt-4-turbo | 2.0x | Expensive fallback |
| claude-opus-4.5 | 2.5x | Most expensive |

### Chain Multipliers

Deployment complexity varies by network:

| Network | Multiplier | Features |
|---------|-----------|----------|
| avalanche_fuji | 1.0x | Standard testnet |
| avalanche_mainnet | 1.2x | Production network |
| mantle_testnet | 1.3x | Mantle testnet |

### Size Multipliers

Larger requests cost more:

- **Generation**: +1 credit per 100 characters
- **Deployment**: +1 credit per 1000 bytes
- **Audit**: +1 credit per 10 lines of code

## Pricing Examples

### Contract Generation

```python
# Small prompt on cheap model
prompt_length = 100
model = "gemini-flash"
chain = "avalanche_fuji"

credits = 10 (base) + 1 (size) = 11
cost = 11 * 1.0 (model) * 1.0 (chain) * 0.001 = $0.011
```

### Large Contract on Expensive Model

```python
prompt_length = 1000
model = "claude-opus-4.5"
chain = "mantle_testnet"

credits = 10 (base) + 10 (size) = 20
cost = 20 * 2.5 (model) * 1.3 (chain) * 0.001 = $0.065
```

## Token Cost Tracking

HyperAgent tracks actual token usage and calculates real costs:

```python
# Gemini Flash pricing (per 1K tokens)
input_cost = $0.001
output_cost = $0.002

# Example calculation
input_tokens = 1000
output_tokens = 500

total_cost = (1000/1000 * 0.001) + (500/1000 * 0.002)
           = $0.001 + $0.001
           = $0.002
```

## Profit Tracking

All builds are logged to MLflow with profit metrics:

- **Revenue USDC**: Amount charged to user
- **Cost USD**: Actual LLM token costs
- **Profit USD**: Revenue - Cost
- **Profit Margin**: (Profit / Revenue) * 100

Example:
```
Revenue: $0.10
Cost: $0.02
Profit: $0.08
Margin: 80%
```

## Configuration

Set custom pricing in `.env`:

```bash
# Credit system
CREDIT_TO_USDC_RATE=0.001
BASE_OPERATION_CREDITS=10

# Token costs (per 1K tokens)
GEMINI_INPUT_COST_PER_1K=0.000001
GEMINI_OUTPUT_COST_PER_1K=0.000002
GPT4_INPUT_COST_PER_1K=0.00001
GPT4_OUTPUT_COST_PER_1K=0.00003
```

## API Usage

### Estimate Generation Cost

```python
from hyperagent.billing.cost_estimator import CostEstimator

estimator = CostEstimator()

cost = estimator.estimate_generation_cost(
    prompt_length=500,
    model="gemini-flash",
    chain="avalanche_fuji"
)
print(f"Estimated cost: ${cost:.4f}")
```

### Calculate Actual Cost

```python
cost_data = estimator.calculate_actual_cost(
    model="gemini-flash",
    input_tokens=1000,
    output_tokens=500
)

print(f"Total cost: ${cost_data['total_cost_usd']:.4f}")
print(f"Credits burned: {cost_data['credits']}")
```

### Calculate Profit

```python
profit_data = estimator.calculate_profit(
    revenue_usdc=0.10,
    actual_cost_usd=0.02
)

print(f"Profit: ${profit_data['profit_usd']:.4f}")
print(f"Margin: {profit_data['profit_margin_percent']:.1f}%")
```

## Revenue Model

HyperAgent generates revenue through pay-per-use billing:

1. User requests contract generation
2. Cost estimator calculates dynamic price
3. x402 payment verified on-chain
4. Service executes and tracks actual costs
5. Profit logged to MLflow

### Operational Costs

- **LLM Tokens**: $20,000 per 90-day sprint
- **Cloud Infrastructure**: $10,000 per month
- **Total Burn**: ~$40,000 per quarter

### Target Margins

- Minimum profit margin: 50%
- Target profit margin: 80%+
- Average transaction: $0.10 - $0.15

## Best Practices

1. **Track All Costs**: Log every model call to MLflow
2. **Monitor Margins**: Set alerts for low-margin builds
3. **Optimize Models**: Use cheapest model that meets quality requirements
4. **Review Pricing**: Adjust multipliers based on actual costs
5. **Budget Tracking**: Monitor quarterly burn rate vs revenue

## See Also

- [Spending Controls](./spending-controls.md)
- [MLflow Dashboard](../monitoring/mlflow.md)
- [x402 Payment Protocol](../api/x402-protocol.md)

