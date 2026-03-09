/**
 * x402 payment client types and helpers.
 */

export interface PaymentInfo {
  endpoint: string;
  amount?: string;
  currency?: string;
  tokenAddress?: string;
  chainId?: number;
}
