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
  return new IpfsPinataToolkit(jwt);
}
