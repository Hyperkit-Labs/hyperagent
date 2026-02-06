/**
 * HTTP client for x402-verifier service
 */
import { loadEnv } from "../config/env";

const env = loadEnv();

export interface X402VerifierClient {
  settlePayment(paymentInfo: unknown): Promise<unknown>;
}

export function createX402VerifierClient(): X402VerifierClient {
  const baseUrl = env.X402_VERIFIER_URL || "http://localhost:3001";

  return {
    async settlePayment(paymentInfo: unknown): Promise<unknown> {
      const response = await fetch(`${baseUrl}/settle-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentInfo),
      });

      if (!response.ok) {
        throw new Error(`x402 verifier error: ${response.statusText}`);
      }

      return response.json();
    },
  };
}

