/**
 * Deployment API: prepare, complete.
 */

import { FALLBACK_DEFAULT_CHAIN_ID } from "@/constants/defaults";
import {
  workflowDeployCompletePath,
  workflowDeployPreparePath,
} from "@hyperagent/api-contracts";
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
  return fetchJsonAuthed(workflowDeployPreparePath(workflowId, qs.toString()), {
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
  return fetchJsonAuthed(workflowDeployCompletePath(workflowId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
