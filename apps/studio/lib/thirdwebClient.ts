'use client';

import { createThirdwebClient } from 'thirdweb';

const clientId = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID : undefined;

export const thirdwebClient = clientId ? createThirdwebClient({ clientId }) : null;

export function isThirdwebConfigured(): boolean {
  return !!clientId;
}

export function getThirdwebClient() {
  return thirdwebClient;
}

/**
 * Returns a fetch-like function that handles HTTP 402 (Payment Required) responses
 * via the x402 protocol. On a 402, extracts the payment-required header/body,
 * attempts the payment via the wallet, and retries the original request with the
 * payment receipt. Falls back to plain fetch when no wallet is provided.
 */
export function createFetchWithPayment(
  wallet: { address?: string; signMessage?: (msg: string) => Promise<string> } | null | undefined,
  maxPaymentUsd?: number
): (url: string, init?: RequestInit) => Promise<Response> {
  const maxCents = (maxPaymentUsd ?? 1) * 100;

  return async (url: string, init?: RequestInit): Promise<Response> => {
    const res = await fetch(url, init);

    if (res.status !== 402 || !wallet?.address || !wallet?.signMessage) {
      return res;
    }

    let paymentRequirements: {
      scheme?: string;
      network?: string;
      maxAmountRequired?: string;
      resource?: string;
      payTo?: string;
      description?: string;
    } | null = null;

    const headerPayload = res.headers.get('x-payment') || res.headers.get('payment-required');
    if (headerPayload) {
      try {
        paymentRequirements = JSON.parse(headerPayload);
      } catch { /* fall through to body parse */ }
    }

    if (!paymentRequirements) {
      try {
        const body = await res.clone().json();
        paymentRequirements = body?.paymentRequirements ?? body?.requirements ?? body;
      } catch {
        return res;
      }
    }

    if (!paymentRequirements?.payTo) {
      return res;
    }

    const amount = parseInt(paymentRequirements.maxAmountRequired || '0', 10);
    if (amount > maxCents) {
      throw new Error(
        `x402 payment of ${amount} exceeds max allowed (${maxCents}). Increase maxPaymentUsd or reject.`
      );
    }

    const receipt = JSON.stringify({
      payer: wallet.address,
      payTo: paymentRequirements.payTo,
      amount: paymentRequirements.maxAmountRequired,
      network: paymentRequirements.network,
      timestamp: Date.now(),
    });
    const signature = await wallet.signMessage(receipt);

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set('x-payment-response', JSON.stringify({ receipt, signature }));

    return fetch(url, { ...init, headers: retryHeaders });
  };
}
