# Avalanche MVP Demo Script

## Overview
HyperAgent is an AI-powered platform for generating and deploying smart contracts that uses x402 to gate every paid action with on-chain USDC payments on Avalanche. You trigger contract workflows through a simple web app, your wallet signs both the payments and deployments, and HyperAgent tracks every transaction in a clear analytics view on Avalanche Fuji testnet.

---

## Pre-Demo Setup

### 1. Environment Check
- ✅ Backend running on `http://localhost:8000`
- ✅ Frontend running on `http://localhost:3000`
- ✅ Database connected and migrations applied
- ✅ x402 payment service configured
- ✅ Avalanche Fuji testnet RPC configured

### 2. Test Wallet Setup
- Connect Core Wallet or MetaMask to Fuji testnet
- Ensure wallet has test USDC (for x402 payments)
- Note wallet address for demo

---

## Demo Flow: Step-by-Step

### Step 1: Open Application (30 seconds)
**Action**: Navigate to `http://localhost:3000` (or deployed URL)

**What to Show**:
- Dashboard with system health status
- Supported networks (highlight Avalanche Fuji)
- Quick actions section

**Say**: 
> "Welcome to HyperAgent. This is an AI-powered platform for smart contract development with x402 payment gating. Notice the dashboard shows system status and supported networks."

---

### Step 2: Navigate to Payment History (1 minute)
**Action**: Click "Analytics" or navigate to `/avax/payments`

**What to Show**:
- Budget Display component showing:
  - Daily spending limit (if configured)
  - Monthly spending limit (if configured)
  - Remaining budget calculations
  - Visual progress bars
- Payment summary cards:
  - Today's total spending
  - Monthly total spending
  - Transaction count
  - Average transaction amount
- Payment history table showing:
  - Last N payments
  - Transaction hashes (clickable to Snowtrace)
  - Payment status
  - Endpoint that triggered payment

**Say**:
> "Here's the payment analytics dashboard. You can see spending controls with remaining budget, payment summaries, and a complete payment history. Each payment is logged with the endpoint, amount, and transaction hash."

---

### Step 3: Generate Smart Contract with x402 Payment (3 minutes)
**Action**: Navigate to "Avalanche Studio" or `/avax/studio`

**What to Show**:
1. **Contract Generation Form**:
   - Enter NLP description: "Create an ERC20 token called DemoToken with symbol DEMO and initial supply of 1000000"
   - Select network: Avalanche Fuji
   - Click "Generate Contract"

2. **x402 Payment Flow**:
   - Backend returns 402 Payment Required
   - Payment modal appears showing:
     - Endpoint: `/x402/contracts/generate`
     - Price: $0.01 USDC (or configured price)
     - Network: Avalanche Fuji
   - Click "Pay with Wallet"
   - Wallet connection prompt appears
   - User approves wallet connection
   - USDC spend approval prompt appears
   - User approves USDC spend
   - Transaction is signed and broadcast
   - Payment confirmation appears

3. **Contract Generation**:
   - After payment, request retries automatically
   - Contract is generated using AI
   - Generated contract code is displayed
   - ABI and constructor arguments are shown

**Say**:
> "When I request contract generation, the backend checks for payment. Since no payment exists, it returns a 402 Payment Required response. The frontend automatically shows a payment modal. I approve the USDC spend in my wallet, and the payment is processed on-chain. The original request then proceeds, and the contract is generated."

---

### Step 4: View Payment in History (1 minute)
**Action**: Return to `/avax/payments` page

**What to Show**:
- New payment appears in history table
- Transaction hash is clickable (links to Snowtrace)
- Payment amount matches the price shown in modal
- Status shows "completed"
- Budget display updates to show new spending

**Say**:
> "The payment is immediately logged in our database. You can see it in the payment history with the transaction hash, amount, and endpoint. The budget display also updates to reflect the new spending."

---

### Step 5: Test Spending Limits (2 minutes)
**Action**: Set a daily limit and attempt to exceed it

**What to Show**:
1. **Set Spending Limit**:
   - Navigate to spending controls (if UI exists) or use API
   - Set daily limit to $0.05 USDC
   - Show budget display updating

2. **Attempt to Exceed Limit**:
   - Try to generate another contract
   - Payment modal shows error: "Daily limit exceeded"
   - Or backend returns 403 with clear error message

**Say**:
> "Spending controls allow users to set daily or monthly limits. If a payment would exceed the limit, the system blocks it with a clear error message. This prevents accidental overspending."

---

### Step 6: Deploy Contract with x402 (3 minutes)
**Action**: Deploy the generated contract

**What to Show**:
1. **Deployment Preparation**:
   - Click "Deploy" on generated contract
   - Backend prepares deployment transaction
   - Returns transaction data for signing

2. **User Signs Deployment**:
   - User signs deployment transaction in wallet
   - Transaction is broadcast

3. **x402 Payment for Deployment**:
   - Backend checks for deployment payment
   - If not paid, returns 402
   - Payment modal appears
   - User approves payment
   - Deployment proceeds

4. **Deployment Success**:
   - Contract address is returned
   - Transaction hash is shown
   - Contract is verified on Snowtrace

**Say**:
> "Deployment also uses x402 payment gating. The user signs the deployment transaction with their wallet, and separately pays for the deployment service via x402. This ensures users maintain control of their wallets while paying for services."

---

### Step 7: Error Handling Demo (1 minute)
**Action**: Show error scenarios

**What to Show**:
1. **Wallet Not Connected**:
   - Try to generate contract without wallet
   - Clear error: "Connect your wallet to proceed"

2. **Insufficient Balance**:
   - Try payment with insufficient USDC
   - Clear error: "Insufficient USDC balance"

3. **Payment Service Down**:
   - Simulate 502/503 error
   - Clear error: "Payment service temporarily unavailable. Please try again later."

**Say**:
> "The system provides clear error messages for all failure scenarios. Users know exactly what went wrong and how to fix it."

---

## Key Points to Emphasize

### 1. x402 Integration
- **Seamless**: Payment happens automatically when needed
- **On-chain**: All payments are verified on-chain via x402 protocol
- **Transparent**: Payment history is fully visible

### 2. Spending Controls
- **User-controlled**: Users set their own limits
- **Real-time**: Budget updates immediately after payments
- **Protective**: Prevents accidental overspending

### 3. Payment Analytics
- **Complete history**: All payments logged with full details
- **Visual feedback**: Progress bars and summaries
- **Transaction links**: Direct links to blockchain explorers

### 4. Error Handling
- **Clear messages**: Users understand what went wrong
- **Actionable**: Errors include instructions for resolution
- **Graceful**: System handles failures without crashing

---

## Demo Checklist

Before starting:
- [ ] Backend is running and healthy
- [ ] Frontend is running and connected
- [ ] Test wallet is connected with USDC
- [ ] Database has payment history (optional, for showing existing data)
- [ ] Spending limits are configured (optional)

During demo:
- [ ] Show dashboard and system status
- [ ] Navigate to payment history page
- [ ] Generate contract with x402 payment
- [ ] Show payment in history
- [ ] Test spending limits
- [ ] Deploy contract with x402
- [ ] Show error handling

After demo:
- [ ] Answer questions about architecture
- [ ] Show code structure if requested
- [ ] Explain x402 protocol integration

---

## Troubleshooting

### Payment Modal Doesn't Appear
- Check browser console for errors
- Verify x402 middleware is enabled in backend
- Check network tab for 402 response

### Payment Fails
- Verify wallet has USDC balance
- Check x402 payment service is running
- Verify network is Avalanche Fuji

### Budget Not Updating
- Refresh page (auto-refresh every 30s)
- Check database connection
- Verify payment was logged

---

## Architecture Highlights

### Frontend
- React/Next.js with TypeScript
- Thirdweb for wallet integration
- Framer Motion for animations
- Tailwind CSS for styling

### Backend
- FastAPI with async/await
- x402 middleware for payment gating
- PostgreSQL for payment logging
- SQLAlchemy for database access

### x402 Flow
1. Request → Backend checks payment
2. No payment → 402 response with JWT token
3. Frontend → Shows payment modal
4. User → Approves USDC spend
5. Payment → On-chain transaction
6. Retry → Original request with payment proof
7. Success → Service proceeds, payment logged

---

## Conclusion

This demo showcases:
- ✅ x402 payment integration
- ✅ Spending controls and budget tracking
- ✅ Payment history and analytics
- ✅ Clear error handling
- ✅ Seamless user experience

The system is production-ready for Avalanche Fuji testnet and can be easily extended to mainnet.

