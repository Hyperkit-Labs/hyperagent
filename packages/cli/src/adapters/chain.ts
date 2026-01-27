import { createThirdwebClient, defineChain } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { ethers } from "ethers";
import * as solc from "solc";

const MANTLE_TESTNET = defineChain({
    id: 5003,
    rpc: "https://rpc.sepolia.mantle.xyz"
});

const AVALANCHE_FUJI = defineChain({
    id: 43113,
    rpc: "https://api.avax-test.network/ext/bc/C/rpc"
});

const NETWORKS: Record<string, any> = {
    "mantle-testnet": MANTLE_TESTNET,
    "mantle-mainnet": defineChain({ id: 5000, rpc: "https://rpc.mantle.xyz" }),
    "avalanche-fuji": AVALANCHE_FUJI,
    "avalanche-mainnet": defineChain({ id: 43114, rpc: "https://api.avax.network/ext/bc/C/rpc" })
};

// Default Mock Key for MVP (DO NOT USE IN PRODUCTION)
const MOCK_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export class ChainAdapter {
    static async compile(contractCode: string): Promise<{ abi: any[]; bytecode: string }> {
        console.log("  🔨 [ChainAdapter] Compiling contract...");
        const input = {
            language: "Solidity",
            sources: { "Contract.sol": { content: contractCode } },
            settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } }
        };

        const output = JSON.parse((solc as any).compile(JSON.stringify(input)));
        
        if (output.errors) {
            const errors = output.errors.filter((e: any) => e.severity === "error");
            if (errors.length > 0) {
                throw new Error(`Compilation failed: ${errors[0].message}`);
            }
        }

        const contractName = Object.keys(output.contracts["Contract.sol"])[0];
        const contract = output.contracts["Contract.sol"][contractName];

        return {
            abi: contract.abi,
            bytecode: contract.evm.bytecode.object
        };
    }

    static async deployContract(contractCode: string, networkName: string): Promise<{ address: string; txHash: string; }> {
        console.log(`  🚀 [ChainAdapter] Initializing deployment to ${networkName}...`);

        const privateKey = process.env.PRIVATE_KEY || MOCK_PRIVATE_KEY;
        const isMock = !process.env.PRIVATE_KEY;

        if (isMock) {
            console.log("  ⚠️ [ChainAdapter] No PRIVATE_KEY found. Falling back to Mock simulation.");
            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
                address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                txHash: "0x" + Math.random().toString(16).substring(2, 64)
            };
        }

        const network = NETWORKS[networkName] || MANTLE_TESTNET;
        const provider = new ethers.JsonRpcProvider(network.rpc);
        const wallet = new ethers.Wallet(privateKey, provider);

        const { abi, bytecode } = await this.compile(contractCode);
        
        console.log(`  🔑 [ChainAdapter] Deploying from: ${wallet.address}`);
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy();
        
        const tx = contract.deploymentTransaction();
        console.log(`  📡 [ChainAdapter] Transaction sent: ${tx?.hash}`);
        
        await contract.waitForDeployment();
        const address = await contract.getAddress();

        console.log(`  ✅ [ChainAdapter] Deployed at: ${address}`);

        return {
            address,
            txHash: tx?.hash || ""
        };
    }
}
