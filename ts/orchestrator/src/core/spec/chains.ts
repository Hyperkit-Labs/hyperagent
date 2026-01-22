/**
 * DESIGN TOKEN: Supported Chains
 * These are the ONLY chains. Others are INVALID.
 */
export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  explorer: string;
  aa_entrypoint: string;
  paymaster: string;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  mantle: {
    rpcUrl: "https://sepolia.mantle.xyz",
    chainId: 5003,
    explorer: "https://explorer.sepolia.mantle.xyz",
    aa_entrypoint: "0x5FF137D4b0FDCD49DcA30c7B5Fb0e97ee356842",
    paymaster: "0x", // Thirdweb paymaster
  },
  avalanche: {
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    aa_entrypoint: "0x5FF137D4b0FDCD49DcA30c7B5Fb0e97ee356842",
    paymaster: "0x",
  },
  skale: {
    rpcUrl: "https://testnet.skalenodes.com/fs/testnet-chaos",
    chainId: 1444673419,
    explorer: "https://testnet-chaos.explorer.skale.network",
    aa_entrypoint: "0x5FF137D4b0FDCD49DcA30c7B5Fb0e97ee356842",
    paymaster: "0x",
  },
};

/**
 * DESIGN TOKEN: Deployment Protocol
 * EXACTLY this sequence. Nothing else.
 */
export interface DeploymentStep {
  step: number;
  name: string;
  input: string;
  validation?: string;
  call?: string;
  output?: string;
  onFail?: string;
}

export const DEPLOYMENT_STEPS: DeploymentStep[] = [
  {
    step: 1,
    name: "validate_bytecode",
    input: "contract: string",
    validation: "Opcode count < 24576, no SELFDESTRUCT",
    onFail: "revert to generate node",
  },
  {
    step: 2,
    name: "create_smart_account",
    input: "chain: string, userId: string",
    call: "thirdweb.createSmartAccount({ chain, address: userId })",
    output: "accountAddress: string",
  },
  {
    step: 3,
    name: "deploy_with_aa",
    input: "bytecode, accountAddress, chain",
    call: "thirdweb.deploy({ bytecode, account })",
    output: "contractAddress: string, txHash: string",
  },
  {
    step: 4,
    name: "verify_on_chain",
    input: "contractAddress, chain",
    validation: "eth_getCode returns non-empty",
    onFail: "retry with exponential backoff (3x)",
  },
];

/**
 * Get chain config by name
 * Throws if chain is not supported
 */
export function getChainConfig(chainName: string): ChainConfig {
  const config = SUPPORTED_CHAINS[chainName.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainName}. Supported: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`);
  }
  return config;
}

