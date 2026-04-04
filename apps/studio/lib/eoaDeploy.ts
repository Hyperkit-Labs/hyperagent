/**
 * EOA (externally owned account) contract deployment.
 * Deploys contract bytecode from a connected wallet.
 */

import type { Chain } from "thirdweb/chains";
import { prepareDirectDeployTransaction } from "thirdweb/deploys";
import { sendTransaction, waitForReceipt } from "thirdweb";
import { getThirdwebClient } from "@/lib/thirdwebClient";

export interface DeployUserContractEoaParams {
  account: { address: string; type?: string; [key: string]: unknown };
  chain: Chain;
  abi: unknown[];
  bytecode: string;
  constructorArgs?: unknown[];
}

export interface DeployUserContractEoaResult {
  contractAddress: string;
  transactionHash: string;
}

export async function deployUserContractEoa(
  params: DeployUserContractEoaParams,
): Promise<DeployUserContractEoaResult> {
  const client = getThirdwebClient();
  if (!client) throw new Error("Thirdweb client not configured");

  const bytecode = params.bytecode.startsWith("0x")
    ? params.bytecode
    : `0x${params.bytecode}`;
  const tx = prepareDirectDeployTransaction({
    client,
    chain: params.chain,
    bytecode: bytecode as `0x${string}`,
    abi: params.abi as unknown as Parameters<
      typeof prepareDirectDeployTransaction
    >[0]["abi"],
    constructorParams: params.constructorArgs as
      | Record<string, unknown>
      | undefined,
  });

  const result = await sendTransaction({
    transaction: tx,
    account: params.account as unknown as Parameters<
      typeof sendTransaction
    >[0]["account"],
  });

  const receipt = await waitForReceipt({
    client,
    chain: params.chain,
    transactionHash: result.transactionHash,
  });
  const contractAddress = receipt.contractAddress ?? "";
  if (!contractAddress) throw new Error("Contract address not in receipt");

  return {
    contractAddress,
    transactionHash: result.transactionHash,
  };
}
