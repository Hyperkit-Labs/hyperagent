#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { version } from "../package.json";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import figlet from "figlet";

dotenv.config();

const program = new Command();

console.log(chalk.magenta(figlet.textSync("HyperAgent v4.0")));
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
        // In LangGraph JS, invoke returns the final state
        const finalState = await agentGraph.invoke(initialState);

        console.log(chalk.green("\n--- Execution Complete ---"));
        console.log(chalk.white(`Status: ${finalState.status}`));
        console.log(chalk.white(`Refined Intent: ${finalState.intent}`));
        console.log(chalk.cyan("\n[Generated Contract]:"));
        console.log(finalState.contract);

        if (finalState.status === "failed") {
            console.error(chalk.red("Generation Failed due to audit/validation errors."));
        }
    });

program
    .command("audit")
    .description("Audit a smart contract")
    .argument("<file>", "Path to solidity file")
    .action((file) => {
        console.log(chalk.blue(`Auditing ${file}...`));
        // Trigger Audit Node
    });

program
    .command("deploy")
    .description("Deploy a smart contract")
    .argument("<file>", "Path to solidity file")
    .option("--network <network>", "Network to deploy to", "mantle-testnet")
    .action((file, options) => {
        console.log(chalk.blue(`Deploying ${file} to ${options.network}...`));
        // Trigger Deploy Node
    });

program.parse();
