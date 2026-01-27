import { HyperAgentState } from "../types/agent";
import { APPROVED_MODELS } from "../config/models";
import { getLLM } from "../utils/llm";
import { HumanMessage } from "@langchain/core/messages";

function generateFallbackContract(intent: string): string {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HyperAgentToken {
    string public name = "HyperAgent Token";
    string public symbol = "HYP";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        totalSupply = 1000000 * 10**18;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}`;
}

export async function generateNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    console.log("  → [GenerateNode] Generating deterministic code...");

    // Check transitions
    if (state.status !== "processing" && state.status !== "validating" && state.status !== "failed") {
        throw new Error(`Invalid state transition to GenerateNode from status: ${state.status}`);
    }

    const model = getLLM("generate");
    let contractCode = "";

    if (model) {
        console.log(`  🧠 [GenerateNode] Invoking ${APPROVED_MODELS.generate.provider} (${APPROVED_MODELS.generate.model})...`);
        try {
            const response = await (model as any).invoke([
                {
                    role: "user",
                    content: `Generate ONLY the Solidity smart contract code for the following intent. 
                - Do not include markdown fences (like \`\`\`solidity).
                - Do not include explanations.
                - Start with 'pragma solidity'.
                - Make it robust and secure.
                
                Intent: ${state.intent}`
                }
            ]);
            contractCode = (response.content as string) || "// Fallback generated code";

            // Cleanup markdown if strictly present (Anti-Hallucination sanitization)
            contractCode = contractCode.replace(/```solidity/g, "").replace(/```/g, "");

        } catch (error) {
            console.error("  ❌ [GenerateNode] LLM Error:", error);
            console.log("  🔄 [GenerateNode] Using fallback template...");
            contractCode = generateFallbackContract(state.intent);
        }
    } else {
        console.log("  ⚠️ [GenerateNode] No LLM available. Using fallback template...");
        contractCode = generateFallbackContract(state.intent);
    }

    return {
        contract: contractCode,
        status: "auditing", // Transition to next expected state
        logs: [...state.logs, "GenerateNode: Contract generated."]
    };
}
