/**
 * Mantle SDK Bridge Service
 * 
 * Provides HTTP bridge to Mantle SDK for cross-chain operations:
 * - L1→L2 token deposits
 * - L2→L1 token withdrawals
 * - Cross-chain messaging
 * - Gas estimation
 * - Contract deployment with cross-chain support
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ethers } from 'ethers';
import { CrossChainMessenger, MessageStatus } from '@mantleio/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// CORS configuration
fastify.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// Environment configuration
const config = {
  port: parseInt(process.env.PORT || '3003'),
  l1RpcUrl: process.env.RPC_URL_ETHEREUM_SEPOLIA || 'https://rpc.sepolia.org',
  l2RpcUrl: process.env.RPC_URL_MANTLE_TESTNET || 'https://rpc.sepolia.mantle.xyz',
  network: process.env.MANTLE_NETWORK || 'mantle_testnet',
  l1ChainId: 11155111, // Sepolia
  l2ChainId: 5003, // Mantle Sepolia
};

// Use mainnet if configured
if (config.network === 'mantle_mainnet') {
  config.l1RpcUrl = process.env.RPC_URL_ETHEREUM_MAINNET || 'https://eth.llamarpc.com';
  config.l2RpcUrl = process.env.RPC_URL_MANTLE_MAINNET || 'https://rpc.mantle.xyz';
  config.l1ChainId = 1;
  config.l2ChainId = 5000;
}

// Initialize providers
const l1Provider = new ethers.JsonRpcProvider(config.l1RpcUrl);
const l2Provider = new ethers.JsonRpcProvider(config.l2RpcUrl);

/**
 * Create CrossChainMessenger instance
 */
function createMessenger(l1Signer: ethers.Wallet, l2Signer: ethers.Wallet) {
  return new CrossChainMessenger({
    l1ChainId: config.l1ChainId,
    l2ChainId: config.l2ChainId,
    l1SignerOrProvider: l1Signer,
    l2SignerOrProvider: l2Signer,
  });
}

/**
 * Health check endpoint
 */
fastify.get('/health', async () => {
  try {
    const [l1Block, l2Block] = await Promise.all([
      l1Provider.getBlockNumber(),
      l2Provider.getBlockNumber(),
    ]);

    return {
      status: 'healthy',
      service: 'mantle-bridge',
      network: config.network,
      l1: {
        chainId: config.l1ChainId,
        blockNumber: l1Block,
        rpcUrl: config.l1RpcUrl,
      },
      l2: {
        chainId: config.l2ChainId,
        blockNumber: l2Block,
        rpcUrl: config.l2RpcUrl,
      },
    };
  } catch (error: any) {
    fastify.log.error('Health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
});

/**
 * Deposit ERC20 tokens from L1 to L2
 */
fastify.post<{
  Body: {
    l1TokenAddress: string;
    l2TokenAddress: string;
    amount: string;
    privateKey: string;
  };
}>('/deposit-erc20', async (request, reply) => {
  try {
    const { l1TokenAddress, l2TokenAddress, amount, privateKey } = request.body;

    // Validate inputs
    if (!l1TokenAddress || !l2TokenAddress || !amount || !privateKey) {
      return reply.status(400).send({
        error: 'Missing required parameters',
        required: ['l1TokenAddress', 'l2TokenAddress', 'amount', 'privateKey'],
      });
    }

    // Create wallets
    const l1Wallet = new ethers.Wallet(privateKey, l1Provider);
    const l2Wallet = new ethers.Wallet(privateKey, l2Provider);

    // Create messenger
    const messenger = createMessenger(l1Wallet, l2Wallet);

    // Approve ERC20 transfer
    const approvalTx = await messenger.approveERC20(l1TokenAddress, l2TokenAddress, amount);
    await approvalTx.wait();

    fastify.log.info(`Approved ERC20 transfer: ${approvalTx.hash}`);

    // Deposit ERC20
    const depositTx = await messenger.depositERC20(l1TokenAddress, l2TokenAddress, amount);
    await depositTx.wait();

    fastify.log.info(`Deposited ERC20: ${depositTx.hash}`);

    return {
      success: true,
      approvalTxHash: approvalTx.hash,
      depositTxHash: depositTx.hash,
      l1TokenAddress,
      l2TokenAddress,
      amount,
    };
  } catch (error: any) {
    fastify.log.error('ERC20 deposit failed:', error);
    return reply.status(500).send({
      error: 'Deposit failed',
      message: error.message,
    });
  }
});

/**
 * Withdraw ERC20 tokens from L2 to L1
 */
fastify.post<{
  Body: {
    l1TokenAddress: string;
    l2TokenAddress: string;
    amount: string;
    privateKey: string;
  };
}>('/withdraw-erc20', async (request, reply) => {
  try {
    const { l1TokenAddress, l2TokenAddress, amount, privateKey } = request.body;

    // Validate inputs
    if (!l1TokenAddress || !l2TokenAddress || !amount || !privateKey) {
      return reply.status(400).send({
        error: 'Missing required parameters',
        required: ['l1TokenAddress', 'l2TokenAddress', 'amount', 'privateKey'],
      });
    }

    // Create wallets
    const l1Wallet = new ethers.Wallet(privateKey, l1Provider);
    const l2Wallet = new ethers.Wallet(privateKey, l2Provider);

    // Create messenger
    const messenger = createMessenger(l1Wallet, l2Wallet);

    // Withdraw ERC20
    const withdrawalTx = await messenger.withdrawERC20(l1TokenAddress, l2TokenAddress, amount);
    await withdrawalTx.wait();

    fastify.log.info(`Withdrawn ERC20: ${withdrawalTx.hash}`);

    return {
      success: true,
      withdrawalTxHash: withdrawalTx.hash,
      l1TokenAddress,
      l2TokenAddress,
      amount,
      note: 'Withdrawal initiated. Wait for message status to finalize on L1.',
    };
  } catch (error: any) {
    fastify.log.error('ERC20 withdrawal failed:', error);
    return reply.status(500).send({
      error: 'Withdrawal failed',
      message: error.message,
    });
  }
});

/**
 * Wait for cross-chain message status
 */
fastify.post<{
  Body: {
    txHash: string;
    targetStatus: string;
  };
}>('/wait-for-message-status', async (request, reply) => {
  try {
    const { txHash, targetStatus } = request.body;

    if (!txHash || !targetStatus) {
      return reply.status(400).send({
        error: 'Missing required parameters',
        required: ['txHash', 'targetStatus'],
      });
    }

    // Create messenger with providers only (no signers needed for status check)
    const messenger = new CrossChainMessenger({
      l1ChainId: config.l1ChainId,
      l2ChainId: config.l2ChainId,
      l1SignerOrProvider: l1Provider,
      l2SignerOrProvider: l2Provider,
    });

    // Map status string to MessageStatus enum
    const statusMap: { [key: string]: MessageStatus } = {
      UNCONFIRMED_L1_TO_L2_MESSAGE: MessageStatus.UNCONFIRMED_L1_TO_L2_MESSAGE,
      FAILED_L1_TO_L2_MESSAGE: MessageStatus.FAILED_L1_TO_L2_MESSAGE,
      STATE_ROOT_NOT_PUBLISHED: MessageStatus.STATE_ROOT_NOT_PUBLISHED,
      READY_TO_PROVE: MessageStatus.READY_TO_PROVE,
      IN_CHALLENGE_PERIOD: MessageStatus.IN_CHALLENGE_PERIOD,
      READY_FOR_RELAY: MessageStatus.READY_FOR_RELAY,
      RELAYED: MessageStatus.RELAYED,
    };

    const status = statusMap[targetStatus.toUpperCase()];
    if (!status) {
      return reply.status(400).send({
        error: 'Invalid target status',
        validStatuses: Object.keys(statusMap),
      });
    }

    // Wait for message status
    await messenger.waitForMessageStatus(txHash, status);

    fastify.log.info(`Message ${txHash} reached status: ${targetStatus}`);

    return {
      success: true,
      txHash,
      status: targetStatus,
    };
  } catch (error: any) {
    fastify.log.error('Wait for message status failed:', error);
    return reply.status(500).send({
      error: 'Status check failed',
      message: error.message,
    });
  }
});

/**
 * Estimate gas for L2 transaction
 */
fastify.post<{
  Body: {
    from: string;
    to: string;
    data: string;
  };
}>('/estimate-gas', async (request, reply) => {
  try {
    const { from, to, data } = request.body;

    if (!from || !to || !data) {
      return reply.status(400).send({
        error: 'Missing required parameters',
        required: ['from', 'to', 'data'],
      });
    }

    const tx = {
      from,
      to,
      data,
    };

    const [estimatedGas, gasPrice] = await Promise.all([
      l2Provider.estimateGas(tx),
      l2Provider.getFeeData(),
    ]);

    const totalCost = estimatedGas * (gasPrice.gasPrice || BigInt(0));

    return {
      estimatedGas: estimatedGas.toString(),
      gasPrice: gasPrice.gasPrice?.toString() || '0',
      totalCost: totalCost.toString(),
      network: config.network,
      chainId: config.l2ChainId,
    };
  } catch (error: any) {
    fastify.log.error('Gas estimation failed:', error);
    return reply.status(500).send({
      error: 'Gas estimation failed',
      message: error.message,
    });
  }
});

/**
 * Deploy contract with cross-chain support
 */
fastify.post<{
  Body: {
    bytecode: string;
    abi: any[];
    constructorArgs: any[];
    l1PrivateKey: string;
    l2PrivateKey: string;
  };
}>('/deploy-with-cross-chain', async (request, reply) => {
  try {
    const { bytecode, abi, constructorArgs, l1PrivateKey, l2PrivateKey } = request.body;

    if (!bytecode || !abi || !l1PrivateKey || !l2PrivateKey) {
      return reply.status(400).send({
        error: 'Missing required parameters',
        required: ['bytecode', 'abi', 'l1PrivateKey', 'l2PrivateKey'],
      });
    }

    // Create wallets
    const l2Wallet = new ethers.Wallet(l2PrivateKey, l2Provider);

    // Deploy contract on L2
    const factory = new ethers.ContractFactory(abi, bytecode, l2Wallet);
    const contract = await factory.deploy(...(constructorArgs || []));
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    const deploymentTx = contract.deploymentTransaction();

    fastify.log.info(`Contract deployed at ${contractAddress}`);

    return {
      success: true,
      contractAddress,
      transactionHash: deploymentTx?.hash,
      network: config.network,
      chainId: config.l2ChainId,
    };
  } catch (error: any) {
    fastify.log.error('Cross-chain deployment failed:', error);
    return reply.status(500).send({
      error: 'Deployment failed',
      message: error.message,
    });
  }
});

/**
 * Start server
 */
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Mantle Bridge Service running on port ${config.port}`);
    fastify.log.info(`Network: ${config.network}`);
    fastify.log.info(`L1 Chain ID: ${config.l1ChainId}`);
    fastify.log.info(`L2 Chain ID: ${config.l2ChainId}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
