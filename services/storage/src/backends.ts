/**
 * Storage service backend: uses shared toolkit from @hyperagent/web3-utils.
 * IPFSStorage interface kept for route handler; implementation is IpfsPinataToolkit.
 */
import type { PinResult } from "@hyperagent/core-types";
import { IpfsPinataToolkit } from "@hyperagent/web3-utils";

export type { PinResult };

export interface IPFSStorage {
  pin(content: string, name: string): Promise<PinResult>;
  unpin(cid: string): Promise<void>;
}

export function createDefaultStorage(): IPFSStorage | null {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;
  const gatewayBase = process.env.PINATA_GATEWAY_BASE?.trim();
  const gatewayDomain = process.env.PINATA_GATEWAY_DOMAIN?.trim();
  return new IpfsPinataToolkit(jwt, {
    baseUrl: process.env.PINATA_API_URL || "https://api.pinata.cloud",
    gatewayBase: gatewayBase || undefined,
    gatewayDomain: gatewayDomain || "gateway.pinata.cloud",
  });
}
