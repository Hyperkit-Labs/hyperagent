# Hyperkit Studio: Full-Stack DEX (Mantle + SKALE) with x402 & AA

## Project Structure Output

```
dex-hyperkit/
├── .env.local.example              # Template (never commit real secrets)
├── .env.production.example         # Template for prod
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
│
├── contracts/                      # Smart contracts (Solidity)
│   ├── foundry.toml
│   ├── src/
│   │   ├── DEX.sol                 # Main DEX contract (pinned template)
│   │   ├── Token.sol               # ERC-20 token template
│   │   ├── LiquidityPool.sol       # Liquidity pool logic (editable extension)
│   │   └── interfaces/
│   │       ├── IDEX.sol
│   │       └── ILiquidityPool.sol
│   ├── test/
│   │   ├── DEX.t.sol               # Foundry tests (auto-generated)
│   │   ├── LiquidityPool.t.sol
│   │   └── helpers/
│   │       └── MockTokens.sol
│   ├── script/
│   │   ├── Deploy.s.sol            # Deployment script (multi-chain aware)
│   │   ├── DeployMantle.s.sol      # Mantle-specific deploy
│   │   └── DeploySkale.s.sol       # SKALE-specific deploy
│   └── slither.config.json         # Static analysis config
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (header, nav, footer)
│   │   ├── page.tsx                # Home / dashboard
│   │   ├── globals.css             # Tailwind + globals
│   │   ├── icon.png
│   │   │
│   │   ├── swap/
│   │   │   ├── page.tsx            # Swap page (DEX main UI)
│   │   │   ├── layout.tsx
│   │   │   └── components/
│   │   │       ├── SwapForm.tsx    # Input/output, rate, button
│   │   │       ├── SlippageControl.tsx
│   │   │       └── PriceChart.tsx
│   │   │
│   │   ├── liquidity/
│   │   │   ├── page.tsx            # Liquidity provider UI
│   │   │   └── components/
│   │   │       ├── AddLiquidity.tsx
│   │   │       ├── RemoveLiquidity.tsx
│   │   │       └── PoolStats.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── page.tsx            # User dashboard (balances, positions)
│   │   │   └── components/
│   │   │       ├── PortfolioCard.tsx
│   │   │       ├── TransactionHistory.tsx
│   │   │       └── PoolsOverview.tsx
│   │   │
│   │   └── api/                    # API routes (Next.js)
│   │       ├── auth/
│   │       │   ├── nonce/route.ts  # AA + email login
│   │       │   └── verify/route.ts
│   │       │
│   │       ├── x402/
│   │       │   ├── verify/route.ts # x402 receipt verification
│   │       │   └── meter/route.ts  # Bill user for API calls
│   │       │
│   │       ├── quote/
│   │       │   └── route.ts        # Swap price quotes (x402-gated)
│   │       │
│   │       └── liquidity/
│   │           └── route.ts        # Liquidity operations
│   │
│   ├── components/                 # Reusable React components
│   │   ├── ui/                     # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── spinner.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── providers/
│   │   │   ├── WagmiProvider.tsx   # Wagmi config (Mantle + SKALE chains)
│   │   │   ├── AAProvider.tsx      # Alchemy AA provider
│   │   │   ├── ThemeProvider.tsx   # Dark/light mode
│   │   │   └── ToastProvider.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx          # Nav + wallet connect (RainbowKit)
│   │   │   ├── Sidebar.tsx         # Navigation menu
│   │   │   └── Footer.tsx
│   │   │
│   │   └── common/
│   │       ├── ChainSelector.tsx   # Switch between Mantle/SKALE
│   │       ├── WalletBalance.tsx   # Display user balance
│   │       └── LoadingSpinner.tsx
│   │
│   ├── lib/                        # Utilities & helpers
│   │   ├── chains.ts               # Chain configs (Mantle, SKALE, testnet)
│   │   ├── contracts.ts            # Contract ABIs, addresses (per-chain)
│   │   ├── wagmi.ts                # Wagmi client config
│   │   ├── alchemy-aa.ts           # AA wallet config
│   │   ├── x402.ts                 # x402 client (thirdweb SDK)
│   │   ├── prisma.ts               # Prisma client singleton
│   │   ├── db.ts                   # Database helpers
│   │   ├── auth.ts                 # Authentication helpers
│   │   ├── types.ts                # Global TS types & interfaces
│   │   └── utils/
│   │       ├── formatters.ts       # Format prices, addresses, etc.
│   │       ├── validators.ts       # Input validation (amounts, addresses)
│   │       ├── conversions.ts      # Unit conversions (wei, decimals)
│   │       └── errors.ts           # Custom error handling
│   │
│   ├── hooks/                      # React hooks
│   │   ├── useSwap.ts              # Swap logic (write to contract)
│   │   ├── useQuote.ts             # Fetch price quotes (x402-protected)
│   │   ├── useLiquidity.ts         # Add/remove liquidity
│   │   ├── useWallet.ts            # Wrapper around useAccount (Wagmi)
│   │   ├── useChain.ts             # Active chain state
│   │   ├── useUserBalance.ts       # Fetch user balances
│   │   └── useTransactionHistory.ts # Fetch user's past txs
│   │
│   ├── services/                   # Business logic services
│   │   ├── dexService.ts           # DEX operations (price calc, etc.)
│   │   ├── swapService.ts          # Orchestrate swap flow
│   │   ├── liquidityService.ts     # Pool management
│   │   ├── walletService.ts        # AA wallet creation / recovery
│   │   ├── authService.ts          # Email/social login via AA
│   │   ├── x402Service.ts          # x402 payment flows
│   │   └── chainService.ts         # Multi-chain logic
│   │
│   └── middleware/                 # Next.js middleware
│       ├── auth.ts                 # Authentication checks
│       └── x402.ts                 # x402 payment gating
│
├── prisma/                         # Database ORM
│   ├── schema.prisma               # DB schema (auto-generated)
│   │   # Tables:
│   │   #   - User (email, walletAddr, smartAccountAddr, AA-related)
│   │   #   - Transaction (txHash, user, amount, type, chainId, timestamp)
│   │   #   - x402Payment (amountPaid, apiCall, user, timestamp)
│   │   #   - LiquidityPosition (user, poolId, shares, chainId)
│   │
│   └── migrations/                 # DB migration history
│       └── 001_init.sql            # Initial schema
│
├── prisma-seed/                    # (Optional) seed data for dev
│   └── seed.ts
│
├── db/                             # Database queries (server-side)
│   ├── users.ts                    # User CRUD
│   ├── transactions.ts             # Transaction history
│   ├── x402Payments.ts             # x402 billing records
│   └── liquidityPositions.ts       # Pool position tracking
│
├── public/                         # Static assets
│   ├── tokens/                     # Token icons (USDC, MNT, SKL, etc.)
│   │   ├── usdc.png
│   │   ├── mnt.png
│   │   └── skl.png
│   └── chains/                     # Chain logos
│       ├── mantle.png
│       └── skale.png
│
├── tests/                          # Test suites
│   ├── unit/
│   │   ├── swapService.test.ts
│   │   ├── x402Service.test.ts
│   │   └── formatters.test.ts
│   ├── integration/
│   │   ├── swap-flow.test.ts       # E2E swap (mock contract)
│   │   └── auth-flow.test.ts       # Email login flow
│   └── e2e/
│       └── dex.spec.ts             # Playwright E2E (dev/testnet only)
│
├── docs/                           # Documentation
│   ├── README.md                   # Main overview
│   ├── ARCHITECTURE.md             # System design
│   ├── DEPLOYMENT.md               # How to deploy to Mantle / SKALE
│   ├── x402-FLOW.md                # x402 metering explanation
│   ├── AA-FLOW.md                  # Account abstraction flow
│   └── SECURITY.md                 # Security considerations
│
├── docker/                         # (Optional) Docker setup
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .dockerignore
│
└── .husky/                         # (Optional) Git hooks
    ├── pre-commit
    └── pre-push
```

---

## Key Files Deep Dive

### 1. **Chain Configuration** (`src/lib/chains.ts`)

```typescript
// Multi-chain aware config
export const CHAINS = {
  mantle: {
    id: 5000,
    name: 'Mantle',
    nativeToken: 'MNT',
    rpcUrl: process.env.NEXT_PUBLIC_MANTLE_RPC,
    explorer: 'https://explorer.mantle.xyz',
    dex: {
      routerAddress: process.env.MANTLE_DEX_ROUTER,
      factoryAddress: process.env.MANTLE_DEX_FACTORY,
    },
    aa: {
      entrypointAddress: '0x...',
      paymasterAddress: process.env.MANTLE_PAYMASTER,
    },
    x402: {
      settlementChain: 'mantle',
      stablecoin: 'USDC',
    },
  },
  skale: {
    id: 1301,
    name: 'SKALE Calypso',
    nativeToken: 'sFUEL', // Zero-cost
    rpcUrl: process.env.NEXT_PUBLIC_SKALE_RPC,
    explorer: 'https://explorer.calypso.skale.network',
    dex: {
      routerAddress: process.env.SKALE_DEX_ROUTER,
      factoryAddress: process.env.SKALE_DEX_FACTORY,
    },
    aa: {
      entrypointAddress: '0x...',
      // SKALE: no paymaster needed (gasless by design)
    },
    x402: {
      settlementChain: 'skale',
      stablecoin: 'USDC',
    },
  },
};

export const DEFAULT_CHAIN = 'skale'; // Gasless by default
export const SUPPORTED_CHAINS = Object.keys(CHAINS);
```

### 2. **Prisma Schema** (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  walletAddress   String?   @unique // EOA or AA wallet
  smartAccountAddr String?  @unique // ERC-4337 smart account
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  transactions      Transaction[]
  x402Payments      X402Payment[]
  liquidityPositions LiquidityPosition[]
}

model Transaction {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  txHash      String   @unique
  chainId     Int      // 5000 (Mantle) or 1301 (SKALE)
  type        String   // 'swap', 'addLiquidity', 'removeLiquidity'
  amountIn    String   // wei as string
  amountOut   String   // wei as string
  tokenIn     String   // contract address
  tokenOut    String   // contract address
  
  status      String   // 'pending', 'confirmed', 'failed'
  gasUsed     String?  // wei
  timestamp   DateTime @default(now())
  
  @@index([userId])
  @@index([chainId])
  @@index([timestamp])
}

model X402Payment {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  apiEndpoint String   // e.g., '/api/quote', '/api/swap'
  amountUSDC  String   // Wei
  txHash      String?  // On-chain settlement
  status      String   // 'pending', 'settled', 'refunded'
  
  createdAt   DateTime @default(now())
  settledAt   DateTime?
  
  @@index([userId])
  @@index([createdAt])
}

model LiquidityPosition {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  poolId      String   // pool contract address
  chainId     Int
  sharesAmount String  // LP token balance
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([userId, poolId, chainId])
  @@index([userId])
}
```

### 3. **API Route with x402 Gating** (`src/app/api/quote/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { x402Middleware } from '@/middleware/x402';
import { dexService } from '@/services/dexService';
import { prisma } from '@/lib/prisma';

// Middleware: verify x402 payment BEFORE executing
async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // 1. Extract x402 proof from headers
    const x402Proof = req.headers.get('x402-proof');
    const userId = req.headers.get('x-user-id'); // From AA session

    if (!x402Proof || !userId) {
      return NextResponse.json(
        { error: 'Missing x402-proof or user session' },
        { status: 402 } // HTTP 402 Payment Required
      );
    }

    // 2. Verify x402 payment with thirdweb
    const isValid = await x402Service.verifyProof(x402Proof);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired x402 proof' },
        { status: 402 }
      );
    }

    // 3. Record payment in DB
    await prisma.x402Payment.create({
      data: {
        userId,
        apiEndpoint: '/api/quote',
        amountUSDC: '100000000', // 1 USDC in wei
        status: 'settled',
        txHash: x402Proof, // Simplified; real impl would have txHash
      },
    });

    // 4. Business logic: get swap quote
    const { tokenIn, tokenOut, amount, chainId } = req.body;
    const quote = await dexService.getQuote({
      tokenIn,
      tokenOut,
      amount,
      chainId,
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json(
      { error: 'Failed to get quote' },
      { status: 500 }
    );
  }
}

export const POST = handler;
```

### 4. **React Component: Swap Form** (`src/app/swap/components/SwapForm.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { useChain } from '@/hooks/useChain';
import { useSwap } from '@/hooks/useSwap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChainSelector } from '@/components/common/ChainSelector';

export function SwapForm() {
  const { chain } = useChain();
  const { swap, isLoading } = useSwap();
  
  const [tokenIn, setTokenIn] = useState('USDC');
  const [tokenOut, setTokenOut] = useState('MNT');
  const [amountIn, setAmountIn] = useState('');

  const handleSwap = async () => {
    try {
      // 1. On SKALE: gasless, direct call
      // 2. On Mantle: AA + paymaster or user pays gas + x402 bills API
      const tx = await swap({
        tokenIn,
        tokenOut,
        amount: amountIn,
        chainId: chain.id,
      });

      console.log('Swap successful:', tx.hash);
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <ChainSelector /> {/* Switch between Mantle/SKALE */}
      
      <div>
        <label>From</label>
        <Input
          placeholder="Amount"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
        />
      </div>

      <div>
        <label>To</label>
        <select value={tokenOut} onChange={(e) => setTokenOut(e.target.value)}>
          <option>MNT</option>
          <option>USDC</option>
          <option>SKL</option>
        </select>
      </div>

      <Button
        onClick={handleSwap}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Swapping...' : 'Swap'}
      </Button>
    </div>
  );
}
```

### 5. **Service Layer: Swap** (`src/services/swapService.ts`)

```typescript
import { dexService } from './dexService';
import { walletService } from './walletService';
import { x402Service } from './x402Service';
import { chainService } from './chainService';

export const swapService = {
  async executeSwap(params: {
    userAddr: string;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    chainId: number;
  }) {
    const { userAddr, tokenIn, tokenOut, amount, chainId } = params;

    // 1. Get swap route & quote
    const quote = await dexService.getQuote({
      tokenIn,
      tokenOut,
      amount,
      chainId,
    });

    // 2. Build contract call
    const dexRouterAddr = chainService.getDEXRouter(chainId);
    const calldata = dexService.encodeSwap({
      tokenIn,
      tokenOut,
      amount,
      minOut: quote.expectedOut, // slippage applied
      recipient: userAddr,
    });

    // 3. Determine UX path based on chain
    if (chainId === SKALE_ID) {
      // SKALE: gasless, direct execution via AA
      return await walletService.executeAATransaction({
        target: dexRouterAddr,
        data: calldata,
        chainId,
      });
    } else if (chainId === MANTLE_ID) {
      // Mantle option A: Paymaster sponsors (if available)
      // Mantle option B: User pays gas + x402 bills API call
      return await walletService.executeAATransaction({
        target: dexRouterAddr,
        data: calldata,
        chainId,
        paymaster: true, // Try paymaster; fall back to user if unavailable
      });
    }

    throw new Error('Unsupported chain');
  },
};
```

---

## Generation & Specialization Roles

### **HyperAgent Sub-Agents for This Project**

1. **PlannerAgent**
   - Input: `"Build a DEX on Mantle + SKALE, email login, x402 metering, AA wallets"`
   - Output: Plan JSON with chains, auth method, db schema, contract templates, pages
   - **Responsibility**: No code; just structure and config

2. **ContractAgent**
   - Input: Plan JSON + templates
   - Output: `/contracts/src/DEX.sol`, `/contracts/test/`, `/contracts/script/Deploy.s.sol`
   - **Safety**: Pinned OpenZeppelin templates, editable only in extension hooks
   - **Validation**: Foundry tests + Slither static analysis

3. **BackendAgent**
   - Input: Plan JSON + API design
   - Output: `/src/app/api/`, `/prisma/schema.prisma`, `/src/services/`
   - **Safety**: Strict x402 verification, no secrets in code
   - **Validation**: Type-checks, auth flow tests

4. **FrontendAgent**
   - Input: Plan JSON + page list + component design
   - Output: `/src/app/` pages, `/src/components/`, `/src/hooks/`
   - **Pattern**: Tailwind + shadcn/ui exclusively
   - **Validation**: TypeScript strict, Prettier formatting

5. **QAAgent**
   - Input: Generated code from all 4 agents
   - Output: Test suites, fixes for obvious bugs, linting
   - **AutoFix**: Simple refactors, missing imports, type corrections

---

## Chain-Specific Configs

### **Mantle Config** (`contracts/script/DeployMantle.s.sol`)
```solidity
// Mantle setup: standard EVM, requires gas (MNT)
// Optional paymaster for sponsor txs
contract DeployMantle is Script {
    address constant MANTLE_ENTRYPOINT = 0x...;
    address constant MANTLE_PAYMASTER = 0x...; // May be address(0) if not funded

    function run() public {
        // Deploy contracts, register on Mantle
    }
}
```

### **SKALE Config** (`contracts/script/DeploySkale.s.sol`)
```solidity
// SKALE setup: gasless by design (sFUEL costs subscribed, not per-tx)
// No paymaster needed
contract DeploySkale is Script {
    address constant SKALE_ENTRYPOINT = 0x...;

    function run() public {
        // Deploy same contracts, register on SKALE
        // sFUEL is auto-funded by chain for users
    }
}
```

---

## Summary: What HyperAgent Generates

| Layer | Output | Safety | Notes |
|-------|--------|--------|-------|
| **Contracts** | `/contracts/src/` (templated) | Pinned versions, Slither | Foundry tests auto-gen |
| **Backend API** | `/src/app/api/` (x402, auth, routes) | No secrets, auth gating | Prisma schema, migrations |
| **Frontend** | `/src/app/` pages + `/components/` | Tailwind + shadcn only | React hooks, Wagmi config |
| **Config** | `/src/lib/chains.ts`, `.env.example` | Env vars only | Multi-chain aware |
| **Tests** | `/tests/` (unit, integration, E2E) | Foundry + Jest + Playwright | Auto-generated + mocked |
| **Docs** | `/docs/ARCHITECTURE.md`, etc. | For users to understand | Clear security boundaries |

This structure **separates concerns**, makes it easy for users to **audit and modify**, and ensures **production readiness without Hyperkit in the runtime loop**.

---

## Next Steps to Implement

1. **Define the Plan JSON schema** (what HyperAgent's PlannerAgent outputs)
2. **Lock contract templates** (which OpenZeppelin/thirdweb examples, which regions are editable)
3. **Build the ContractAgent** (generate + test + validate Solidity)
4. **Build the BackendAgent** (API routes + Prisma schema)
5. **Build the FrontendAgent** (React pages + shadcn components)
6. **Integrate QAAgent** (tests + static checks + autofixes)
7. **Wire sub-agents together** in HyperAgent orchestration
8. **Test end-to-end**: Prompt → Full repo → Run locally → Deploy to testnet
