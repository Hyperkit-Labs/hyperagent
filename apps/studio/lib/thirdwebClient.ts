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
 * Returns a fetch-like function for requests that may require x402 payment.
 * When Thirdweb is configured, use useFetchWithPayment(client) from "thirdweb/react" in components for full 402 handling.
 * This implementation uses native fetch so the app builds; wire to hook-based flow for production x402.
 */
export function createFetchWithPayment(
  _wallet: unknown,
  _maxPayment?: number
): (url: string, init?: RequestInit) => Promise<Response> {
  return async (url: string, init?: RequestInit) => {
    return fetch(url, init);
  };
}
