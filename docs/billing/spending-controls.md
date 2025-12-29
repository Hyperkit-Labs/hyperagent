# Spending Controls

HyperAgent provides user spending controls to protect against accidental overspending and enable budgeting for x402 payments.

## Overview

Spending controls allow users to set:

- **Daily spending limits** in USDC
- **Monthly spending limits** in USDC
- **Merchant whitelists** to restrict approved services
- **Time-based restrictions** for payment windows

Controls are enforced before every payment and automatically reset at configured intervals.

## Features

### Automatic Limit Enforcement

When a user attempts a payment, the system checks:

1. Is the user within their daily limit?
2. Is the user within their monthly limit?
3. Is the merchant on the whitelist (if configured)?
4. Are we within allowed time windows (if configured)?

If any check fails, the payment is blocked with a clear error message.

### Automatic Counter Reset

Spending counters reset automatically:

- **Daily counters**: Reset 24 hours after the last reset
- **Monthly counters**: Reset on the 1st of each month

Users don't need to manually reset their budgets.

### Real-Time Budget Tracking

Users can query their current spending status at any time:

```json
{
  "daily_spent": 5.25,
  "daily_limit": 10.0,
  "daily_remaining": 4.75,
  "monthly_spent": 52.50,
  "monthly_limit": 100.0,
  "monthly_remaining": 47.50
}
```

## Default Limits

New users get default spending controls:

- **Daily limit**: $10.00 USDC
- **Monthly limit**: $100.00 USDC
- **Whitelist**: None (all merchants allowed)
- **Status**: Active

Users can adjust these limits at any time via the API.

## API Endpoints

### Get Spending Controls

```bash
GET /api/v1/x402/spending-controls/{wallet_address}
```

Response:
```json
{
  "id": "uuid",
  "wallet_address": "0x1234...",
  "daily_limit": 10.0,
  "monthly_limit": 100.0,
  "whitelist_merchants": ["hyperagent"],
  "is_active": true,
  "created_at": "2025-01-22T10:00:00Z",
  "updated_at": "2025-01-22T10:00:00Z"
}
```

### Get Spending Controls with Budget

```bash
GET /api/v1/x402/spending-controls/{wallet_address}/budget
```

Response:
```json
{
  "id": "uuid",
  "wallet_address": "0x1234...",
  "daily_limit": 10.0,
  "monthly_limit": 100.0,
  "daily_spent": 5.25,
  "daily_remaining": 4.75,
  "monthly_spent": 52.50,
  "monthly_remaining": 47.50,
  "whitelist_merchants": ["hyperagent"],
  "is_active": true
}
```

### Update Spending Limits

```bash
POST /api/v1/x402/spending-controls
Content-Type: application/json

{
  "wallet_address": "0x1234...",
  "daily_limit": 20.0,
  "monthly_limit": 200.0
}
```

### Update Merchant Whitelist

```bash
POST /api/v1/x402/spending-controls
Content-Type: application/json

{
  "wallet_address": "0x1234...",
  "whitelist_merchants": ["hyperagent", "approved-merchant"]
}
```

### Delete Spending Controls

```bash
DELETE /api/v1/x402/spending-controls/{wallet_address}
```

## Usage Examples

### Python SDK

```python
import httpx

client = httpx.AsyncClient()

# Get current spending
response = await client.get(
    "https://api.hyperagent.xyz/api/v1/x402/spending-controls/0x1234.../budget"
)
budget = response.json()
print(f"Daily remaining: ${budget['daily_remaining']:.2f}")

# Update limits
await client.post(
    "https://api.hyperagent.xyz/api/v1/x402/spending-controls",
    json={
        "wallet_address": "0x1234...",
        "daily_limit": 20.0,
        "monthly_limit": 200.0
    }
)
```

### JavaScript SDK

```javascript
const response = await fetch(
  'https://api.hyperagent.xyz/api/v1/x402/spending-controls/0x1234.../budget'
);
const budget = await response.json();

console.log(`Daily remaining: $${budget.daily_remaining.toFixed(2)}`);

// Update whitelist
await fetch('https://api.hyperagent.xyz/api/v1/x402/spending-controls', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet_address: '0x1234...',
    whitelist_merchants: ['hyperagent', 'trusted-service']
  })
});
```

## Error Handling

When spending limits are exceeded, the API returns a 403 Forbidden:

```json
{
  "error": "Spending control violation",
  "message": "Daily limit exceeded. Remaining: $0.50"
}
```

Common error messages:

- "Daily limit exceeded. Remaining: $X.XX"
- "Monthly limit exceeded. Remaining: $X.XX"
- "Merchant 'xyz' not in whitelist"
- "Payment not allowed at this time"

## Configuration

Environment variables:

```bash
# Default spending limits for new users
DEFAULT_DAILY_LIMIT_USDC=10.0
DEFAULT_MONTHLY_LIMIT_USDC=100.0
```

## Database Schema

Spending controls are stored in the `spending_controls` table:

```sql
CREATE TABLE hyperagent.spending_controls (
    id UUID PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    daily_limit FLOAT NOT NULL DEFAULT 10.0,
    monthly_limit FLOAT NOT NULL DEFAULT 100.0,
    daily_spent FLOAT NOT NULL DEFAULT 0.0,
    monthly_spent FLOAT NOT NULL DEFAULT 0.0,
    daily_reset_at TIMESTAMP NOT NULL,
    monthly_reset_at TIMESTAMP NOT NULL,
    whitelist_merchants TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

## Best Practices

1. **Set Conservative Limits**: Start with low limits and increase as needed
2. **Use Whitelists**: Restrict payments to known, trusted merchants
3. **Monitor Regularly**: Check spending history weekly
4. **Enable Notifications**: Set up alerts when limits are approached
5. **Review Monthly**: Adjust limits based on actual usage patterns

## Security Features

- **Rate Limiting**: Prevents rapid spending
- **Atomic Updates**: Spending counters updated atomically
- **Audit Trail**: All payments logged to `payment_history` table
- **Automatic Reset**: Counters reset without user intervention
- **Disable Option**: Users can temporarily disable controls

## FAQ

**Q: What happens if I exceed my limit mid-payment?**  
A: The payment is blocked before processing. No USDC is charged.

**Q: Can I set different limits for different merchants?**  
A: Not currently. Use the whitelist to restrict approved merchants.

**Q: Do limits apply to failed payments?**  
A: No. Only successful payments count toward limits.

**Q: Can I disable spending controls entirely?**  
A: Yes, but this is not recommended for production use.

**Q: How do I track my spending history?**  
A: Query the `/api/v1/x402/analytics/payment-history` endpoint.

## See Also

- [Cost Estimation](./cost-estimation.md)
- [x402 Payment Protocol](../api/x402-protocol.md)
- [Payment History API](../api/payment-history.md)

