import { HyperAgentState } from "../types/agent";
import { APPROVED_MODELS } from "../config/models";
import { getLLM } from "../utils/llm";
import { HumanMessage } from "@langchain/core/messages";

export async function generateNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    console.log("  → [GenerateNode] Generating deterministic code...");

    // Check transitions
    if (state.status !== "processing") {
        throw new Error("Invalid state transition to GenerateNode");
    }

    const model = getLLM("generate");
    let contractCode = "";

    if (model) {
        console.log("  🧠 [GenerateNode] Invoking Claude 3.5 Sonnet (Opus)...");
        try {
            const response = await (model as any).invoke([
                new HumanMessage(`Generate ONLY the Solidity smart contract code for the following intent. 
                - Do not include markdown fences (like \`\`\`solidity).
                - Do not include explanations.
                - Start with 'pragma solidity'.
                - Make it robust and secure.
                
                Intent: ${state.intent}`)
            ]);
            contractCode = response.content as string;

            // Cleanup markdown if strictly present (Anti-Hallucination sanitization)
            contractCode = contractCode.replace(/```solidity/g, "").replace(/```/g, "");

        } catch (error) {
            console.error("  ❌ [GenerateNode] LLM Error:", error);
            // Fallback to mock if error
            contractCode = `// Error generating code. Fallback.`;
        }
    } else {
        // MOCK GENERATION for MVP Scaffold
        contractCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HyperAgentToken is ERC20 {
    constructor() ERC20("HyperAgent", "HYP") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}`;
    }

    return {
        contract: contractCode,
        status: "auditing", // Transition to next expected state
        logs: [...state.logs, "GenerateNode: Contract generated."]
    };
}
