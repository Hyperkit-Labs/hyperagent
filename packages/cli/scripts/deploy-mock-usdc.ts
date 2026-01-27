import { createWalletClient, http, publicActions, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleTestnet } from "viem/chains";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore
const solc = require("solc");

dotenv.config();

async function main() {
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");

    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
        account,
        chain: mantleTestnet,
        transport: http("https://rpc.sepolia.mantle.xyz"),
    }).extend(publicActions);

    console.log(`Deploying MockUSDC to Mantle Testnet...`);

    const source = fs.readFileSync(path.join(__dirname, "../contracts/MockUSDC.sol"), "utf8");

    const input = {
        language: "Solidity",
        sources: {
            "MockUSDC.sol": {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contract = output.contracts["MockUSDC.sol"]["MockUSDC"];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    const hash = await client.deployContract({
        abi,
        bytecode: `0x${bytecode}`,
        account,
    });

    console.log(`Transaction hash: ${hash}`);

    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`MockUSDC deployed at: ${receipt.contractAddress}`);

    // Update .env
    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf8");
    if (envContent.includes("X402_TOKEN_ADDRESS=")) {
        envContent = envContent.replace(/X402_TOKEN_ADDRESS=.*/, `X402_TOKEN_ADDRESS=${receipt.contractAddress}`);
    } else {
        envContent += `\nX402_TOKEN_ADDRESS=${receipt.contractAddress}`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(`Updated .env with X402_TOKEN_ADDRESS=${receipt.contractAddress}`);
}

main().catch(console.error);
