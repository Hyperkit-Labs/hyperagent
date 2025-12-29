# x402 Payment Popup Fix

This document explains how the x402 payment popup was fixed to properly show wallet signature requests.

## Problem

When deploying a contract, the user would see "Payment required" error but no wallet popup appeared to approve the USDC payment.

**Error shown:**
```
Deployment Error
Payment required: Please approve USDC payment in your wallet
```

**Root Cause:**
The code detected the 402 Payment Required response but didn't trigger Thirdweb's payment flow. It just showed an error message instead of prompting the user's wallet.

## Solution

Integrated Thirdweb's `wrapFetchWithPayment` wrapper to automatically handle 402 responses and show the wallet popup for USDC payment approval.

### Changes Made

**File:** `frontend/components/deployment/DeploymentModal.tsx`

#### 1. Added Import

```typescript
import { wrapFetchWithPayment } from 'thirdweb/pay';
```

#### 2. Updated handleDeploy Function

**Before:**
```typescript
// Direct fetch call - no payment handling
const response = await fetch(`${API_BASE_URL}/x402/deployments/deploy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Wallet-Address': account.address,
  },
  body: JSON.stringify({...}),
});

// Manual 402 check
if (response.status === 402) {
  setError('Payment required...');
  return; // Just shows error, doesn't trigger payment
}
```

**After:**
```typescript
const client = getThirdwebClient();

// Wrap fetch with x402 payment handler
const fetchWithPayment = wrapFetchWithPayment({
  client,
  onPaymentSent: (paymentHash) => {
    console.log('Payment sent:', paymentHash);
    updateStep('payment', 'in_progress', 'Payment confirmed, processing deployment...');
  },
});

// This will automatically handle 402 responses and show wallet popup
const response = await fetchWithPayment(`${API_BASE_URL}/x402/deployments/deploy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Wallet-Address': account.address,
  },
  body: JSON.stringify({...}),
});
```

## How It Works Now

### 1. User Clicks "Deploy"
- Frontend shows "Processing payment" step
- Calls the x402 deployment endpoint

### 2. Backend Returns 402
- Backend detects no payment has been made
- Returns HTTP 402 with payment details (amount, token address, recipient)

### 3. Thirdweb Payment Wrapper Intercepts
- `wrapFetchWithPayment` detects the 402 response
- Automatically triggers wallet popup
- Shows USDC approval request

### 4. User Approves in Wallet
- User sees MetaMask/OKX/Core wallet popup
- Approves USDC transfer (e.g., 0.10 USDC)
- Transaction is submitted on-chain

### 5. Payment Callback Fires
- `onPaymentSent` callback is triggered
- UI updates: "Payment confirmed, processing deployment..."

### 6. Request Retries Automatically
- `wrapFetchWithPayment` automatically retries the original request
- This time with payment proof in headers
- Backend verifies payment and proceeds with deployment

### 7. Deployment Completes
- Backend deploys contract using server wallet (gasless for user)
- Returns transaction hash and contract address
- UI shows success

## Testing

1. **Connect Wallet**: Make sure wallet is connected (MetaMask, OKX, Core, etc.)
2. **Navigate to Studio**: Generate a smart contract
3. **Click Deploy**: The deployment modal opens
4. **Observe Payment Flow**:
   - Step shows "Approve USDC payment in your wallet"
   - Wallet popup appears automatically
   - Shows USDC transfer approval
5. **Approve Payment**: Sign the transaction in your wallet
6. **Deployment Proceeds**: After payment confirmation, deployment starts

## Error Handling

If the wallet popup doesn't appear, check:

1. **Wallet is Connected**: Ensure active wallet connection
2. **Sufficient USDC**: User must have enough USDC for payment
3. **Network Match**: Wallet must be on correct network (Avalanche Fuji)
4. **Backend Running**: x402 endpoint must return proper 402 response
5. **Thirdweb Client**: Client ID must be configured in `.env.local`

## Environment Variables Required

```env
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Backend Requirements

The backend must return a proper x402 response:

```python
# Backend: hyperagent/api/routes/x402/deployments.py
if payment_not_verified:
    return JSONResponse(
        status_code=402,
        content={
            "x402Version": 1,
            "chainId": 43113,  # Avalanche Fuji
            "to": settings.usdc_recipient_address,
            "amount": "100000",  # 0.10 USDC (6 decimals)
            "token": settings.usdc_contract_address,
            "message": "Payment required for contract deployment",
        }
    )
```

## Related Files

- `frontend/components/deployment/DeploymentModal.tsx` - Payment integration
- `frontend/lib/thirdwebClient.ts` - Thirdweb client configuration
- `hyperagent/api/routes/x402/deployments.py` - Backend x402 endpoint
- `hyperagent/api/middleware/x402.py` - x402 middleware

## Troubleshooting

### Wallet popup still doesn't appear

1. **Check browser console** for errors
2. **Verify Thirdweb SDK version**: Should be latest with x402 support
3. **Test with different wallet**: Try MetaMask, then OKX, then Core
4. **Check network**: Switch to Avalanche Fuji testnet
5. **Clear browser cache**: Sometimes helps with SDK issues

### Payment succeeds but deployment fails

1. **Check backend logs**: `docker-compose logs hyperagent`
2. **Verify payment verification**: Check x402 middleware logs
3. **Check server wallet balance**: Server wallet needs gas for deployment

### Multiple payment popups appear

This shouldn't happen with `wrapFetchWithPayment` but if it does:
1. Ensure only one `fetchWithPayment` call per deployment
2. Check for duplicate event handlers
3. Verify payment state is properly managed

## Success Indicators

When working correctly, you'll see:

1. ✅ "Approve USDC payment in your wallet" message
2. ✅ Wallet popup appears within 1-2 seconds
3. ✅ USDC approval shown in wallet
4. ✅ After approval: "Payment confirmed, processing deployment..."
5. ✅ Deployment proceeds without additional prompts
6. ✅ Transaction hash and contract address displayed

The user should only interact with their wallet once (for USDC payment). The actual contract deployment is handled by the server wallet (gasless).

