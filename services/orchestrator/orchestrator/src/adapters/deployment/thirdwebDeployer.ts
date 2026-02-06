/**
 * Thirdweb deployment adapter for TS orchestrator
 * Implements DEPLOYMENT_STEPS from spec
 */

import { ethers } from "ethers";
import { DeploymentNetworkConfig, getDeploymentNetworkConfig } from "./networkConfig";
import { DEPLOYMENT_STEPS } from "../../core/spec/chains";

export interface DeploymentResult {
  contractAddress: string;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
}

export interface DeploymentOptions {
  network: string;
  bytecode: string;
  abi?: any[];
  constructorArgs?: any[];
  privateKey?: string;
  rpcUrl?: string;
}

/**
 * Validate bytecode according to DEPLOYMENT_STEPS[0]
 * - Opcode count < 24576
 * - No SELFDESTRUCT
 */
export function validateBytecode(bytecode: string): { valid: boolean; error?: string } {
  if (!bytecode || !bytecode.startsWith("0x")) {
    return { valid: false, error: "Invalid bytecode format" };
  }

  // Remove 0x prefix and check length (2 chars per byte)
  const bytecodeHex = bytecode.slice(2);
  const bytecodeLength = bytecodeHex.length / 2;

  // Check opcode count (approximate: each byte is potentially an opcode)
  // EIP-170 limit: 24576 bytes max contract size
  if (bytecodeLength > 24576) {
    return { valid: false, error: `Bytecode too large: ${bytecodeLength} bytes (max 24576)` };
  }

  // Check for SELFDESTRUCT opcode (0xFF)
  if (bytecodeHex.includes("ff")) {
    // More precise check: look for 0xFF byte
    const bytes = bytecodeHex.match(/.{2}/g) || [];
    for (const byte of bytes) {
      if (byte.toLowerCase() === "ff") {
        return { valid: false, error: "Bytecode contains SELFDESTRUCT opcode (forbidden)" };
      }
    }
  }

  return { valid: true };
}

/**
 * Create smart account (DEPLOYMENT_STEPS[1])
 * For now, uses standard EOA deployment
 * Future: Integrate thirdweb SDK for smart account creation
 */
export async function createSmartAccount(
  config: DeploymentNetworkConfig,
  userAddress: string,
): Promise<string> {
  // For now, return user address as account address
  // Future: Use thirdweb SDK to create smart account
  // const account = await thirdweb.createSmartAccount({ chain: config.chainId, address: userAddress });
  // return account.address;
  
  return userAddress;
}

/**
 * Deploy contract using ethers.js (DEPLOYMENT_STEPS[2])
 * Implements standard deployment flow
 */
export async function deployWithAccount(
  config: DeploymentNetworkConfig,
  bytecode: string,
  abi: any[],
  constructorArgs: any[],
  privateKey: string,
): Promise<DeploymentResult> {
  if (!privateKey) {
    throw new Error("Private key required for deployment");
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  const wallet = new ethers.Wallet(privateKey as `0x${string}`, provider);

  const factory = new ethers.ContractFactory(abi, bytecode as `0x${string}`, wallet);
  const contract = await factory.deploy(...constructorArgs);

  const tx = contract.deploymentTransaction();
  if (!tx?.hash) {
    throw new Error("Failed to get deployment transaction hash");
  }

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  const receipt = await provider.getTransactionReceipt(tx.hash);
  if (!receipt) {
    throw new Error("Failed to get transaction receipt");
  }

  return {
    contractAddress,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed?.toString(),
  };
}

/**
 * Verify contract on-chain (DEPLOYMENT_STEPS[3])
 * Checks that eth_getCode returns non-empty bytecode
 */
export async function verifyContractOnChain(
  config: DeploymentNetworkConfig,
  contractAddress: string,
  maxRetries: number = 3,
): Promise<{ verified: boolean; error?: string }> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const code = await provider.getCode(contractAddress);
      
      if (code && code !== "0x" && code.length > 2) {
        return { verified: true };
      }

      // Exponential backoff: wait 2^attempt seconds
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === maxRetries) {
        return { verified: false, error: `Verification failed after ${maxRetries} attempts: ${message}` };
      }
      // Wait before retry
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { verified: false, error: `Contract code not found after ${maxRetries} attempts` };
}

/**
 * Execute complete deployment flow following DEPLOYMENT_STEPS
 */
export async function executeDeployment(
  options: DeploymentOptions,
): Promise<DeploymentResult> {
  const config = getDeploymentNetworkConfig(options.network);
  const logs: string[] = [];

  // Step 1: Validate bytecode
  logs.push(`[DEPLOY] Step 1: Validating bytecode`);
  const validation = validateBytecode(options.bytecode);
  if (!validation.valid) {
    throw new Error(`Bytecode validation failed: ${validation.error}`);
  }
  logs.push(`[DEPLOY] ✓ Bytecode validated (${options.bytecode.length} chars)`);

  // Step 2: Create smart account (for now, use provided address or generate)
  logs.push(`[DEPLOY] Step 2: Creating smart account`);
  // For standard deployment, we use the wallet from private key
  // Smart account creation would happen here if using ERC-4337
  const wallet = options.privateKey
    ? new ethers.Wallet(options.privateKey as `0x${string}`)
    : ethers.Wallet.createRandom();
  const accountAddress = wallet.address;
  logs.push(`[DEPLOY] ✓ Account address: ${accountAddress}`);

  // Step 3: Deploy with account
  logs.push(`[DEPLOY] Step 3: Deploying contract`);
  if (!options.privateKey) {
    throw new Error("Private key required for deployment");
  }

  const result = await deployWithAccount(
    config,
    options.bytecode,
    options.abi || [],
    options.constructorArgs || [],
    options.privateKey,
  );
  logs.push(`[DEPLOY] ✓ Contract deployed: ${result.contractAddress}`);
  logs.push(`[DEPLOY] ✓ Transaction hash: ${result.txHash}`);

  // Step 4: Verify on-chain
  logs.push(`[DEPLOY] Step 4: Verifying contract on-chain`);
  const verification = await verifyContractOnChain(config, result.contractAddress);
  if (!verification.verified) {
    throw new Error(`On-chain verification failed: ${verification.error}`);
  }
  logs.push(`[DEPLOY] ✓ Contract verified on-chain`);

  return result;
}

