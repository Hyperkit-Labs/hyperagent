/**
 * Deployment API: prepare, complete.
 */

import { FALLBACK_DEFAULT_CHAIN_ID } from "@/constants/defaults";
import { fetchJsonAuthed } from "./core";

export interface PrepareDeployParams {
  chainId?: number;
  mainnet_confirm?: boolean;
}

export async function prepareDeploymentTransaction(
  workflowId: string,
  params?: PrepareDeployParams,
): Promise<unknown> {
  const chainId = params?.chainId ?? FALLBACK_DEFAULT_CHAIN_ID;
  const mainnet_confirm = params?.mainnet_confirm ?? false;
  const qs = new URLSearchParams({ chain_id: String(chainId) });
  return fetchJsonAuthed(`/workflows/${workflowId}/deploy/prepare?${qs}`, {
    method: "POST",
    body: JSON.stringify({ mainnet_confirm }),
  });
}

export async function completeDeployment(
  workflowId: string,
  body: {
    contractAddress: string;
    transactionHash: string;
    walletAddress: string;
    abi?: unknown[];
    chainId?: number;
  },
): Promise<unknown> {
  return fetchJsonAuthed(`/workflows/${workflowId}/deploy/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
