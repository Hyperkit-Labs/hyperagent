import './env';

import { createThirdwebClient } from "thirdweb";
import { smartWallet } from "thirdweb/wallets";
import { defineChain } from "thirdweb/chains";

interface UserOp {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export class PaymasterService {
  private client: any;
  private facilitatorWallet: any;
  
  constructor() {
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    const clientId = process.env.THIRDWEB_CLIENT_ID;
    
    if (!secretKey) {
      throw new Error("THIRDWEB_SECRET_KEY required for paymaster service");
    }
    
    this.client = createThirdwebClient({
      clientId: clientId,
      secretKey: secretKey
    });
  }
  
  async sponsorDeployment(
    userOp: UserOp,
    network: string
  ): Promise<{ paymasterAndData: string; paymaster: string; sponsor: string }> {
    const chain = this.getChainConfig(network);
    
    // Initialize facilitator as Smart Account (paymaster)
    const factoryAddress = process.env.FACTORY_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    
    const facilitator = smartWallet({
      chain,
      factoryAddress: factoryAddress as `0x${string}`,
      gasless: true
    });
    
    await facilitator.connect({ client: this.client });
    
    console.log(`Paymaster facilitator initialized: ${await facilitator.getAddress()}`);
    
    // Sponsor user operation (sign paymasterAndData)
    // Note: Thirdweb SDK v5 handles sponsorship automatically with gasless: true
    // The paymasterAndData is computed by the SDK
    
    const paymasterAddress = await facilitator.getAddress();
    
    // For simplicity, we'll return the paymaster address
    // In production, this would call Thirdweb's bundler service
    const paymasterAndData = `${paymasterAddress}${"0".repeat(128)}`;  // Placeholder signature
    
    return {
      paymasterAndData: paymasterAndData,
      paymaster: paymasterAddress,
      sponsor: "hyperagent"
    };
  }
  
  private getChainConfig(network: string): any {
    const chains: Record<string, any> = {
      "avalanche_fuji": defineChain(43113),
      "avalanche_mainnet": defineChain(43114)
    };
    
    const chain = chains[network];
    if (!chain) {
      throw new Error(`Unsupported network for paymaster: ${network}`);
    }
    
    return chain;
  }
}

