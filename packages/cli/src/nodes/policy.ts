import { HyperAgentState } from "../types/agent";
import { APPROVED_MODELS } from "../config/models";
import { X402Adapter } from "../adapters/x402";
import { getLLM } from "../utils/llm";
import { HumanMessage } from "@langchain/core/messages";
import chalk from "chalk";

export async function policyNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    console.log("  → [PolicyNode] Analyzing intent...");

    // x402 Payment Check (Cost of Policy + Generation ~ $0.10)
    const userAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Mock User
    const hasFunds = await X402Adapter.checkBalance(userAddress, 0.10);

    if (!hasFunds) {
        return {
            status: "failed",
            logs: [...state.logs, "PolicyNode: Failed x402 payment check - Insufficient Funds"]
        };
    }

    await X402Adapter.debitUser(userAddress, 0.10);

    const model = getLLM("policy");
    let refinedIntent = "";

    if (model) {
        console.log("  🧠 [PolicyNode] Invoking Claude 3.5 Sonnet...");
        try {
            const response = await (model as any).invoke([
                new HumanMessage(`You are a Web3 System Architect. Analyze the user's request and output a STRICT, clear, technical intent summary. Do not output code. \n\nUser Request: "${state.intent}"`)
            ]);
            refinedIntent = response.content as string;
        } catch (error) {
            console.error("  ❌ [PolicyNode] LLM Error:", error);
            refinedIntent = `Intent (Fallback): ${state.intent}`;
        }
    } else {
        // Mock Fallback
        refinedIntent = `Refined Intent: Create a robust smart contract based on user request: "${state.intent}"`;
    }

    console.log(chalk.dim(`     Intent: ${refinedIntent.substring(0, 50)}...`));

    return {
        intent: refinedIntent,
        status: "processing",
        logs: [...state.logs, "PolicyNode: Intent verified and refined."]
    };
}
