#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { version } from "../package.json";
import { loadRootEnv } from "@hyperagent/env";
import * as fs from "fs";
import * as path from "path";
import figlet from "figlet";

loadRootEnv();

const program = new Command();

console.log(chalk.magenta(figlet.textSync("Hyperkit V1.0")));
console.log(chalk.dim("The Anti-Hallucination AI Agent for Web3"));
console.log(chalk.dim("----------------------------------------\n"));

program
    .name("hyperagent")
    .description("HyperAgent CLI - Anti-Hallucination Smart Contract Agent")
    .version(version);

program
    .command("init")
    .description("Initialize a new HyperAgent workspace")
    .action(() => {
        console.log(chalk.green("Initializing HyperAgent workspace..."));

        const configPath = path.join(process.cwd(), "hyperagent.config.json");
        if (fs.existsSync(configPath)) {
            console.log(chalk.red("Error: hyperagent.config.json already exists."));
            return;
        }

        const defaultConfig = {
            "project": {
                "name": path.basename(process.cwd()),
                "network": "mantle-testnet"
            },
            "agent": {
                "model": "claude-3-5-sonnet-20241022",
                "autoApprove": false
            },
            "x402": {
                "paymentRequired": true,
                "maxSpendPerRun": 1.00
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(chalk.blue("Created hyperagent.config.json"));
        console.log(chalk.green("Done! Run 'hyperagent generate' to start."));
    });

import { agentGraph } from "./graph";
import { INITIAL_STATE } from "./types/agent";

program
    .command("generate")
    .description("Generate a smart contract from a prompt")
    .argument("<prompt>", "The natural language prompt")
    .action(async (prompt) => {
        console.log(chalk.blue(`Received prompt: "${prompt}"`));
        console.log(chalk.yellow("Starting Anti-Hallucination Engine..."));

        // Initialize State (Partially, as LangGraph will fill defaults)
        const initialState = {
            intent: prompt,
            status: "processing" as const,
            logs: [`User Input: ${prompt}`]
        };

        console.log(chalk.dim("Initializing Graph..."));

        // Execute Graph
        try {
            const finalState = await agentGraph.invoke(initialState);
            console.log(chalk.green("\n--- Execution Complete ---"));
            console.log(chalk.white(`Status: ${finalState.status}`));
            console.log(chalk.white(`Refined Intent: ${finalState.intent}`));
            console.log(chalk.cyan("\n[Generated Contract]:"));
            console.log(finalState.contract);

            if (finalState.status === "failed") {
                console.error(chalk.red("Generation Failed due to audit/validation errors."));
            }
        } catch (err: any) {
            console.error(chalk.red("\n❌ Graph Execution Error:"));
            console.error(err);
            process.exit(1);
        }
    });

program
    .command("audit")
    .description("Audit a smart contract")
    .argument("<file>", "Path to solidity file")
    .action(async (file) => {
        console.log(chalk.blue(`Auditing ${file}...`));
        
        try {
            if (!fs.existsSync(file)) {
                console.error(chalk.red(`Error: File not found: ${file}`));
                process.exit(1);
            }

            const contractCode = fs.readFileSync(file, "utf8");
            const { SlitherAdapter } = await import("./nodes/audit");
            
            console.log(chalk.yellow("Running security audit..."));
            const result = await SlitherAdapter.runAudit(contractCode);
            
            console.log(chalk.cyan("\n--- Audit Results ---"));
            console.log(chalk.white(`Total findings: ${result.findings.length}`));
            
            if (result.findings.length > 0) {
                console.log(chalk.yellow("\nFindings:"));
                result.findings.forEach(finding => {
                    const isCritical = finding.includes("CRITICAL");
                    console.log(isCritical ? chalk.red(`  ❌ ${finding}`) : chalk.yellow(`  ⚠️  ${finding}`));
                });
            }
            
            if (result.passed) {
                console.log(chalk.green("\n✅ Audit passed!"));
            } else {
                console.log(chalk.red("\n❌ Audit failed - critical issues found"));
                process.exit(1);
            }
        } catch (err: any) {
            console.error(chalk.red("\n❌ Audit Error:"));
            console.error(err);
            process.exit(1);
        }
    });

program
    .command("deploy")
    .description("Deploy a smart contract")
    .argument("<file>", "Path to solidity file")
    .option("--network <network>", "Network to deploy to", "mantle-testnet")
    .action(async (file, options) => {
        console.log(chalk.blue(`Deploying ${file} to ${options.network}...`));
        
        try {
            if (!fs.existsSync(file)) {
                console.error(chalk.red(`Error: File not found: ${file}`));
                process.exit(1);
            }

            const contractCode = fs.readFileSync(file, "utf8");
            const { ChainAdapter } = await import("./adapters/chain");
            
            console.log(chalk.yellow(`Deploying to ${options.network}...`));
            const { address, txHash } = await ChainAdapter.deployContract(contractCode, options.network);
            
            console.log(chalk.green("\n✅ Deployment successful!"));
            console.log(chalk.cyan(`Contract Address: ${address}`));
            console.log(chalk.cyan(`Transaction Hash: ${txHash}`));
            
            // Get explorer URL based on network
            const explorerUrls: Record<string, string> = {
                "mantle-testnet": "https://explorer.testnet.mantle.xyz",
                "mantle-mainnet": "https://explorer.mantle.xyz",
                "avalanche-fuji": "https://testnet.snowtrace.io",
                "avalanche-mainnet": "https://snowtrace.io"
            };
            
            const explorerUrl = explorerUrls[options.network];
            if (explorerUrl) {
                console.log(chalk.dim(`\nView on explorer: ${explorerUrl}/address/${address}`));
            }
        } catch (err: any) {
            console.error(chalk.red("\n❌ Deployment Error:"));
            console.error(err.message || err);
            process.exit(1);
        }
    });

program.parse();
