/**
 * x402 payment client types and helpers.
 *
 * Protocol contract: the orchestrator's X402EnforcementMiddleware validates
 * X-Payment headers using _validate_proof_structure + x402_verifier (x402_middleware.py).
 * Required fields: nonce, amount, payer, signature, valid_before.
 * The header value must be base64-encoded JSON.
 *
 * ERC-1066 status codes (source: hyperkit-erc1066 TypeScript SDK):
 *   0x01 → execute (payment accepted)
 *   0x54 → request_payment (payment required / insufficient funds)
 *   0x21 → deny (proof expired)
 *   0x22 → deny (replay / already used)
 *   0x10 → deny (invalid signature / disallowed)
 *   0x00 → deny (generic failure)
 */

// ---------------------------------------------------------------------------
// ERC-1066 status codes — re-exported from hyperkit-erc1066 SDK types
// ---------------------------------------------------------------------------
export type {
  StatusCode as ERC1066StatusCode,
  Action as ERC1066Action,
} from "hyperkit-erc1066";

/** Map an ERC-1066 status code to its human-readable action (matches SDK mapStatusToAction). */
export function erc1066ToAction(
  code: string,
): "execute" | "retry" | "request_payment" | "deny" {
  switch (code) {
    case "0x01":
      return "execute";
    case "0x20":
      return "retry";
    case "0x54":
      return "request_payment";
    default:
      return "deny";
  }
}

// ---------------------------------------------------------------------------
// Payment proof types
// ---------------------------------------------------------------------------

/** Generic payment metadata (e.g. for UI display). */
export interface PaymentInfo {
  endpoint: string;
  amount?: string;
  currency?: string;
  tokenAddress?: string;
  chainId?: number;
}

/**
 * Proof object sent in the X-Payment header.
 * Field contract mirrors _validate_proof_structure in x402_middleware.py.
 */
export interface X402PaymentProof {
  /** Replay-protection token (UUID). Must be >= 8 chars and unique per request. */
  nonce: string;
  /** Payment amount in USD as a string (e.g. "0.15"). Must be >= endpoint price. */
  amount: string;
  /** Wallet address of the payer. */
  payer: string;
  /** EIP-191 signature of the canonical receipt string. */
  signature: string;
  /** Unix timestamp (seconds) after which this proof is invalid. */
  valid_before: number;
  /** Optional payee address from the challenge. */
  pay_to?: string;
  /** Settlement network slug (e.g. "skale-base"). */
  network?: string;
  /** Optional resource ID for metering (e.g. "pipeline.run"). */
  resource?: string;
}

/**
 * 402 challenge body returned by the orchestrator when payment is required.
 * Shape of billing.x402_challenge_response() in billing.py.
 */
export interface X402Challenge {
  error: "payment_required";
  /** ERC-1066 status code. "0x54" = INSUFFICIENT_FUNDS / request_payment. */
  erc1066_code?: string;
  /** Action to take based on erc1066_code (matches mapStatusToAction). */
  action?: "execute" | "retry" | "request_payment" | "deny";
  code: "x402";
  message: string;
  price_usd: number;
  payment_url?: string | null;
  settlement?: string;
  /** Standard x402 paymentRequirements for compliant clients. */
  paymentRequirements?: {
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description?: string;
    mimeType?: string;
    payTo?: string;
    maxTimeoutSeconds?: number;
    asset?: string;
  };
}

/** How long (seconds) a generated proof is valid. Must be < REPLAY_WINDOW_SECONDS on server (300). */
export const PROOF_VALID_SECONDS = 270;

/**
 * Build the canonical receipt string that the wallet signs.
 * This string is what gets passed to wallet.signMessage().
 *
 * Key order MUST match _rebuild_receipt() in x402_verifier.py:
 *   nonce → amount → payer → valid_before → [pay_to] → [network]
 */
export function buildX402Receipt(params: {
  nonce: string;
  amount: string;
  payer: string;
  valid_before: number;
  pay_to?: string;
  network?: string;
}): string {
  return JSON.stringify({
    nonce: params.nonce,
    amount: params.amount,
    payer: params.payer,
    valid_before: params.valid_before,
    ...(params.pay_to ? { pay_to: params.pay_to } : {}),
    ...(params.network ? { network: params.network } : {}),
  });
}

/**
 * Base64-encode a proof object for the X-Payment header.
 * The server parses this via base64.b64decode → json.loads.
 */
export function encodeX402Proof(proof: X402PaymentProof): string {
  return btoa(JSON.stringify(proof));
}

/**
 * Attempt to parse a 402 response body as an x402 challenge.
 * Returns null when the body is not a valid x402 challenge (e.g. credits-exhausted 402).
 */
export async function parseX402Challenge(
  response: Response,
): Promise<X402Challenge | null> {
  try {
    const body = await response.clone().json();
    if (
      body?.code === "x402" &&
      typeof body.price_usd === "number" &&
      body.error === "payment_required"
    ) {
      return body as X402Challenge;
    }
    return null;
  } catch {
    return null;
  }
}
