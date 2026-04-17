/**
 * ERC-1066 status code utilities for the API gateway.
 *
 * Uses the hyperkit-erc1066 SDK to:
 * 1. Map ERC-1066 status codes returned by the orchestrator to gateway actions.
 * 2. Build standard 402 challenge headers when the gateway itself issues challenges.
 *
 * The gateway does not re-verify payment proofs (the orchestrator handles
 * cryptographic verification via x402_verifier.py). The gateway's role is:
 * - Rate limiting before the request reaches the orchestrator.
 * - Forwarding X-Payment headers to the orchestrator unchanged.
 * - Surfacing ERC-1066 action hints back to the client in 402 responses.
 */

import { ERC1066Client } from "hyperkit-erc1066";
import type { StatusCode, Action } from "hyperkit-erc1066";

// ERC-1066 status codes used in x402 payment flows.
export const ERC1066 = {
  SUCCESS: "0x01" as StatusCode,
  FAILURE: "0x00" as StatusCode,
  DISALLOWED: "0x10" as StatusCode,
  EXPIRED: "0x21" as StatusCode,
  REPLAY: "0x22" as StatusCode,
  INSUFFICIENT: "0x54" as StatusCode,
} as const;

/**
 * Singleton ERC1066Client for the API gateway.
 * Pointed at the orchestrator so the gateway can validate/execute intents on
 * behalf of the client when the orchestrator acts as the ERC-1066 gateway.
 */
let _client: ERC1066Client | null = null;

export function getERC1066Client(): ERC1066Client | null {
  const url = process.env.ORCHESTRATOR_URL?.trim();
  if (!url) return null;
  if (!_client) {
    _client = new ERC1066Client(url);
  }
  return _client;
}

/**
 * Map an ERC-1066 status code to the action the client should take.
 * Mirrors ERC1066Client.mapStatusToAction() without needing the class instance.
 */
export function mapStatusToAction(status: string): Action {
  switch (status as StatusCode) {
    case ERC1066.SUCCESS:
      return "execute";
    case "0x20":
      return "retry";
    case ERC1066.INSUFFICIENT:
      return "request_payment";
    default:
      return "deny";
  }
}

/**
 * Build a standard ERC-1066-annotated 402 response body for the gateway.
 * Used when the gateway itself detects payment is required (e.g. rate limit
 * bypass or pre-orchestrator payment check).
 */
export function buildGateway402Body(opts: {
  path: string;
  priceUsd: number;
  payTo?: string;
}): Record<string, unknown> {
  const { path, priceUsd, payTo = "" } = opts;
  const amountMicro = String(Math.round(priceUsd * 1_000_000));

  return {
    erc1066_code: ERC1066.INSUFFICIENT,
    action: "request_payment",
    error: "payment_required",
    code: "x402",
    message: `API requires payment: $${priceUsd.toFixed(2)} USD`,
    price_usd: priceUsd,
    settlement: "USDC on SKALE Base",
    paymentRequirements: {
      scheme: "exact",
      network: "skale-base-mainnet",
      maxAmountRequired: amountMicro,
      resource: path,
      description: `HyperAgent API Gateway: ${path}`,
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: 300,
      asset: "USDC",
    },
  };
}
