# API Client Architecture

This document explains the architecture of the frontend API client modules and why certain files are separated.

## Overview

The frontend API client is organized into multiple modules, each serving a specific purpose:

- `lib/api.ts` - Main API client for workflow operations
- `lib/x402Client.ts` - x402 payment-specific utilities
- `lib/payment.ts` - Payment signature normalization utilities
- `lib/thirdwebClient.ts` - Thirdweb SDK integration

## File Separation Rationale

### `x402Client.ts` vs `payment.ts`

These files serve different purposes and are intentionally separated:

#### `x402Client.ts`
**Purpose**: x402 payment header creation and parsing

**Responsibilities**:
- Creating x402 payment headers (`X-PAYMENT` header format)
- Parsing payment information from API responses
- Handling x402-specific payment verification flows
- Integration with x402 verifier service

**Key Functions**:
- `createX402Fetch()` - Creates fetch wrapper with x402 headers (deprecated, use `thirdwebClient.ts`)
- `parsePaymentInfo()` - Parses payment info from API responses

**Why Separate**: x402 is a specific payment protocol with its own header format and verification flow. This module encapsulates all x402-specific logic.

#### `payment.ts`
**Purpose**: Payment signature normalization utilities

**Responsibilities**:
- Normalizing signature `v` values (EIP-155 compatibility)
- Converting between different signature formats
- Handling signature validation utilities

**Key Functions**:
- `normalizeSignatureV()` - Normalizes signature `v` value for EIP-155

**Why Separate**: Signature normalization is a low-level utility that may be used by multiple payment systems, not just x402. It's a pure utility function with no dependencies on x402-specific logic.

### `api.ts` - Main API Client

**Purpose**: Core API client for workflow operations

**Responsibilities**:
- Workflow creation and management (v1 and v2 APIs)
- Network and template retrieval
- Workflow status polling
- Error handling and response parsing

**Key Functions**:
- `createWorkflow()` - Create workflow via v1 API
- `createWorkflowV2()` - Create workflow via v2 API
- `getWorkflow()`, `getWorkflowV2()` - Retrieve workflow status
- `listWorkflows()`, `listWorkflowsV2()` - List workflows

**Why Centralized**: All workflow operations share common patterns (error handling, base URLs, response parsing). Centralizing them reduces duplication.

### `thirdwebClient.ts` - Thirdweb Integration

**Purpose**: Thirdweb SDK integration for wallet and payment operations

**Responsibilities**:
- Wallet connection via Thirdweb
- Payment header creation using Thirdweb SDK
- Smart account operations
- Gasless transaction handling

**Key Functions**:
- `createFetchWithPayment()` - Creates fetch wrapper with Thirdweb payment headers
- Wallet connection utilities

**Why Separate**: Thirdweb is a third-party SDK with its own patterns and abstractions. Isolating it makes it easier to swap out or update the SDK version.

## Migration Path

### Deprecated: `createX402Fetch()` in `x402Client.ts`

The `createX402Fetch()` function in `x402Client.ts` is deprecated in favor of `createFetchWithPayment()` from `thirdwebClient.ts`.

**Reason**: Thirdweb SDK provides better integration with wallet providers and handles payment signing more robustly.

**Migration**:
```typescript
// Old (deprecated)
import { createX402Fetch } from '@/lib/x402Client';
const fetchWithPayment = createX402Fetch(wallet);

// New (recommended)
import { createFetchWithPayment } from '@/lib/thirdwebClient';
const fetchWithPayment = createFetchWithPayment(wallet);
```

## Type Definitions

All shared types are consolidated in `lib/types.ts`:

- `Workflow` - Workflow data structure
- `PaymentInfo` - Payment information
- `SpendingControlWithBudget` - Budget and spending limits
- `Network`, `Template` - Network and template types

**Why Consolidated**: Types are shared across multiple modules. Centralizing them prevents duplication and ensures consistency.

## Best Practices

1. **Use `thirdwebClient.ts` for new payment integrations** - It provides better wallet integration
2. **Use `payment.ts` for signature utilities** - Pure functions with no side effects
3. **Use `api.ts` for workflow operations** - Centralized API client
4. **Import types from `types.ts`** - Single source of truth for type definitions
5. **Avoid direct x402 header manipulation** - Use the provided utilities

## Future Considerations

- Consider consolidating `x402Client.ts` into `thirdwebClient.ts` once all x402 operations use Thirdweb
- Keep `payment.ts` as a pure utility module (no external dependencies)
- Maintain `api.ts` as the main API client entry point

