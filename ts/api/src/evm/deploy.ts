import { ethers } from "ethers";
import { Env } from "../config/env";
import { getNetworkConfig } from "./networkConfig";

export async function deployContract(args: {
  env: Env;
  network: string;
  abi: any[];
  bytecode: `0x${string}`;
  constructorArgs?: any[];
}): Promise<{
  chainId: number;
  txHash: string;
  contractAddress: string;
  blockNumber?: number;
  gasUsed?: string;
}> {
  if (!args.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "Deployment is not configured (DEPLOYER_PRIVATE_KEY not set on the API server)",
    );
  }

  const net = getNetworkConfig(args.env, args.network);
  const provider = new ethers.JsonRpcProvider(net.rpcUrl, net.chainId);
  const wallet = new ethers.Wallet(args.env.DEPLOYER_PRIVATE_KEY as `0x${string}`, provider);

  const factory = new ethers.ContractFactory(args.abi, args.bytecode, wallet);
  const contract = await factory.deploy(...(args.constructorArgs ?? []));

  const tx = contract.deploymentTransaction();
  if (!tx?.hash) {
    throw new Error("Failed to get deployment transaction hash");
  }

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  const receipt = await provider.getTransactionReceipt(tx.hash);

  return {
    chainId: net.chainId,
    txHash: tx.hash,
    contractAddress,
    blockNumber: receipt?.blockNumber ?? undefined,
    gasUsed: receipt?.gasUsed?.toString?.() ?? undefined,
  };
}

export async function waitForContractAddress(args: {
  env: Env;
  network: string;
  txHash: string;
  timeoutMs?: number;
}): Promise<{ contractAddress: string; blockNumber?: number; gasUsed?: string }> {
  const net = getNetworkConfig(args.env, args.network);
  const provider = new ethers.JsonRpcProvider(net.rpcUrl, net.chainId);

  const timeoutMs = args.timeoutMs ?? 60_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = await provider.getTransactionReceipt(args.txHash);
    if (receipt?.contractAddress) {
      return {
        contractAddress: receipt.contractAddress,
        blockNumber: receipt.blockNumber ?? undefined,
        gasUsed: receipt.gasUsed?.toString?.() ?? undefined,
      };
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  throw new Error("Timed out waiting for contract deployment confirmation");
}
