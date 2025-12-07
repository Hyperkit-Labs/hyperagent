import { ethers } from "ethers";
import * as mantleSDK from "@mantleio/sdk";
import { env } from "./env";

export class CrossChainMessengerService {
  private l1Provider: ethers.providers.JsonRpcProvider;
  private l2Provider: ethers.providers.JsonRpcProvider;
  
  constructor() {
    this.l1Provider = new ethers.providers.JsonRpcProvider(env.L1_RPC);
    this.l2Provider = new ethers.providers.JsonRpcProvider(env.L2_RPC);
  }
  
  private createCrossChainMessenger(
    l1PrivateKey: string,
    l2PrivateKey: string
  ): mantleSDK.CrossChainMessenger {
    const l1Wallet = new ethers.Wallet(l1PrivateKey, this.l1Provider);
    const l2Wallet = new ethers.Wallet(l2PrivateKey, this.l2Provider);
    
    return new mantleSDK.CrossChainMessenger({
      l1ChainId: parseInt(env.L1_CHAIN_ID),
      l2ChainId: parseInt(env.L2_CHAIN_ID),
      l1SignerOrProvider: l1Wallet,
      l2SignerOrProvider: l2Wallet,
      bedrock: true,
    });
  }
  
  async deployWithCrossChain(
    bytecode: string,
    abi: any[],
    constructorArgs: any[],
    l1PrivateKey: string,
    l2PrivateKey: string
  ): Promise<any> {
    const messenger = this.createCrossChainMessenger(l1PrivateKey, l2PrivateKey);
    const l1Wallet = new ethers.Wallet(l1PrivateKey, this.l1Provider);
    const l2Wallet = new ethers.Wallet(l2PrivateKey, this.l2Provider);
    
    const factory = new ethers.ContractFactory(abi, bytecode, l1Wallet);
    const contract = await factory.deploy(...constructorArgs);
    await contract.deployTransaction.wait();
    
    return {
      l1ContractAddress: contract.address,
      l1TransactionHash: contract.deployTransaction.hash,
      network: "l1",
      requiresL2Bridge: true
    };
  }
  
  async depositERC20(
    l1TokenAddress: string,
    l2TokenAddress: string,
    amount: string,
    privateKey: string
  ): Promise<any> {
    const messenger = this.createCrossChainMessenger(privateKey, privateKey);
    const wallet = new ethers.Wallet(privateKey, this.l1Provider);
    
    const amountBN = ethers.utils.parseEther(amount);
    
    const approveTx = await messenger.approveERC20(
      l1TokenAddress,
      l2TokenAddress,
      amountBN
    );
    await approveTx.wait();
    
    const depositTx = await messenger.depositERC20(
      l1TokenAddress,
      l2TokenAddress,
      amountBN
    );
    await depositTx.wait();
    
    return {
      approveTransactionHash: approveTx.hash,
      depositTransactionHash: depositTx.hash,
      status: "deposited",
      messageHash: depositTx.hash
    };
  }
  
  async withdrawERC20(
    l1TokenAddress: string,
    l2TokenAddress: string,
    amount: string,
    privateKey: string
  ): Promise<any> {
    const messenger = this.createCrossChainMessenger(privateKey, privateKey);
    const amountBN = ethers.utils.parseEther(amount);
    
    const withdrawTx = await messenger.withdrawERC20(
      l1TokenAddress,
      l2TokenAddress,
      amountBN
    );
    await withdrawTx.wait();
    
    return {
      withdrawTransactionHash: withdrawTx.hash,
      status: "withdrawn",
      messageHash: withdrawTx.hash
    };
  }
  
  async waitForMessageStatus(txHash: string, targetStatus: string): Promise<any> {
    const messenger = this.createCrossChainMessenger("", "");
    
    const statusMap: { [key: string]: mantleSDK.MessageStatus } = {
      "UNCONFIRMED_L1_TO_L2_MESSAGE": mantleSDK.MessageStatus.UNCONFIRMED_L1_TO_L2_MESSAGE,
      "FAILED_L1_TO_L2_MESSAGE": mantleSDK.MessageStatus.FAILED_L1_TO_L2_MESSAGE,
      "STATE_ROOT_NOT_PUBLISHED": mantleSDK.MessageStatus.STATE_ROOT_NOT_PUBLISHED,
      "READY_TO_PROVE": mantleSDK.MessageStatus.READY_TO_PROVE,
      "IN_CHALLENGE_PERIOD": mantleSDK.MessageStatus.IN_CHALLENGE_PERIOD,
      "READY_FOR_RELAY": mantleSDK.MessageStatus.READY_FOR_RELAY,
      "RELAYED": mantleSDK.MessageStatus.RELAYED,
    };
    
    const targetStatusEnum = statusMap[targetStatus] || mantleSDK.MessageStatus.RELAYED;
    
    await messenger.waitForMessageStatus(txHash, targetStatusEnum);
    
    return {
      txHash,
      status: targetStatus,
      completed: true
    };
  }
  
  async estimateGas(from: string, to: string, data: string): Promise<any> {
    const feeData = await this.l2Provider.getFeeData();
    
    const tx = {
      from,
      to,
      data,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    };
    
    const estimatedGas = await this.l2Provider.estimateGas(tx);
    const totalCost = estimatedGas.mul(feeData.maxFeePerGas || 0);
    
    return {
      estimatedGas: estimatedGas.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      totalCost: ethers.utils.formatEther(totalCost),
    };
  }
}

