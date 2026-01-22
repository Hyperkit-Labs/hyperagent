# HyperAgent Implementation Playbook: Day-by-Day Execution

## Quick Overview

**Goal**: Build HyperAgent working end-to-end in 3 days (Jan 19-21)

**Approach**: 
- Day 1: Build 3 core nodes (PolicyNode, GenerateNode, AuditNode)
- Day 2: Build 3 more nodes + memory integration (ValidateNode, DeployNode, EigenDANode)
- Day 3: Build monitor + full LangGraph integration + E2E testing

**Time Per Node**: 30 minutes (5m read → 20m implement → 5m verify)

---

# DAY 1: JANUARY 19 (NODES 1-3)

## 9:00 AM - PolicyNode Implementation

### 9:00-9:05: READ Phase

```bash
cd ~/hyperagent
open docs/hyperagent_dna_blueprint.md

# Navigate to: Part II, Section 2.1 "PolicyNode Specification"
# Focus on:
# - Input format
# - Output format (HyperAgentState)
# - Template code
```

**Key Info to Absorb**:
- Input: Single string `intent`
- Output: HyperAgentState with `policy` field filled
- Next node: ALWAYS GenerateNode
- Error codes: ERR_INVALID_INTENT, ERR_POLICY_CONFLICT, ERR_UNSUPPORTED_CHAIN

### 9:05-9:25: IMPLEMENT Phase

```bash
# Create file
touch src/nodes/policy.ts

# Copy template from blueprint and implement
```

**Code to write** (Copy from template, replace placeholders):

```typescript
import { HyperAgentState } from "../types";

export async function policyNode(intent: string): Promise<HyperAgentState> {
  // Step 1: Parse intent for requirements
  const requirements = extractRequirements(intent);
  
  // Step 2: Generate restrictions (always use blocklist - NEVER CHANGE)
  const restrictions = [
    "No delegatecall allowed",
    "No access to random sources",
    "No external calls in loop"
  ];
  
  // Step 3: Generate optimization hints
  const optimization = generateOptimization(requirements);
  
  // Step 4: Security policies (NEVER CHANGE)
  const security = [
    "Check for reentrancy",
    "Validate input ranges",
    "Use safe math (OpenZeppelin)",
    "No use of tx.origin"
  ];
  
  return {
    intent,
    policy: { requirements, restrictions, optimization, security },
    contract: { content: "", language: "solidity", gasEstimate: 0, version: "1.0", hash: "" },
    audit: { issues: [], severity: "low", recommendations: [], timestamp: 0 },
    validated: false,
    deployed: false,
    monitoring: { gasUsed: 0, txHash: "", address: "", errors: [], uptime: 0 }
  };
}

function extractRequirements(intent: string): string[] {
  // Parse intent and extract requirements
  // Example: "Create ERC-20 with limits" → ["Must implement IERC20", "Must have minting limits"]
  const lines = intent.split("\n");
  return lines.filter(line => line.trim().length > 0);
}

function generateOptimization(requirements: string[]): string[] {
  return [
    "Minimize storage writes",
    "Use packed storage layout",
    "Batch operations where possible"
  ];
}
```

**Checklist while writing**:
- [ ] Function returns `HyperAgentState`
- [ ] All 7 state fields present
- [ ] Restrictions array is LOCKED (3 items)
- [ ] Security array is LOCKED (4 items)
- [ ] No extra fields added

### 9:25-9:30: VERIFY Phase

```bash
# Run verification
npm run verify:dictionary

# Check output
# Should show: "✅ PolicyNode matches specification"

# Run tests
npm test -- PolicyNode

# Should pass all 5 tests
```

**If verification fails**:
- Read error message
- Check against blueprint specification
- Do NOT improvise - follow spec exactly
- Fix and retry

### Commit

```bash
git add src/nodes/policy.ts
git commit -m "Add PolicyNode per DNA blueprint spec"
git push
```

---

## 9:30 AM - GenerateNode Implementation

### 9:30-9:35: READ Phase

```bash
# Open blueprint section 2.2 "GenerateNode Specification"
# Key points:
# - Input: HyperAgentState with policy filled
# - Output: Same state + contract.content filled
# - Uses LLM to generate Solidity
# - Next: ALWAYS AuditNode
```

### 9:35-9:55: IMPLEMENT Phase

```typescript
import { HyperAgentState, LLMModel } from "../types";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function generateNode(
  state: HyperAgentState,
  llmModel: LLMModel = "claude-opus"
): Promise<HyperAgentState> {
  // Step 1: Build prompt from policy
  const prompt = buildGeneratePrompt(state.intent, state.policy);
  
  // Step 2: Call LLM
  const response = await client.messages.create({
    model: llmModel,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });
  
  // Step 3: Extract code
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Expected text response");
  
  const code = extractSolidityCode(content.text);
  
  // Step 4: Validate syntax
  if (!isValidSolidity(code)) {
    return errorState(state, "ERR_CODE_SYNTAX");
  }
  
  // Step 5: Hash and estimate gas
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const gasEstimate = estimateGas(code);
  
  return {
    ...state,
    contract: {
      content: code,
      language: "solidity",
      gasEstimate,
      version: "1.0",
      hash
    }
  };
}

function buildGeneratePrompt(intent: string, policy: any): string {
  return `Generate a Solidity smart contract.

Intent: ${intent}

Requirements:
${policy.requirements.map((r: string) => `- ${r}`).join("\n")}

RESTRICTIONS (MUST FOLLOW):
${policy.restrictions.map((r: string) => `- FORBIDDEN: ${r}`).join("\n")}

Optimizations:
${policy.optimization.map((o: string) => `- ${o}`).join("\n")}

Security:
${policy.security.map((s: string) => `- ${s}`).join("\n")}

Output: ONLY Solidity code between \`\`\`solidity and \`\`\` markers.
NO explanations. NO comments. Only code.`;
}

function extractSolidityCode(text: string): string {
  const match = text.match(/\`\`\`solidity\n([\s\S]*?)\n\`\`\`/);
  if (!match) throw new Error("No Solidity code block found");
  return match[1];
}

function isValidSolidity(code: string): boolean {
  // Check for basic syntax
  return (
    code.includes("pragma solidity") &&
    code.includes("contract") &&
    code.includes("{") &&
    code.includes("}")
  );
}

function estimateGas(code: string): number {
  // Rough estimate: ~20 gas per byte
  return code.length * 20;
}

function errorState(state: HyperAgentState, errorCode: string): HyperAgentState {
  return {
    ...state,
    contract: { ...state.contract, content: "" },
    error: { code: errorCode, message: `Error: ${errorCode}`, timestamp: Date.now() }
  } as any;
}
```

### 9:55-10:00: VERIFY Phase

```bash
npm run verify:dictionary
npm test -- GenerateNode
```

### Commit

```bash
git add src/nodes/generate.ts
git commit -m "Add GenerateNode with LLM integration"
git push
```

---

## 10:00 AM - AuditNode Implementation

### 10:00-10:05: READ Phase

```bash
# Open blueprint section 2.3 "AuditNode Specification"
# Key patterns:
# - Static analysis
# - Blocked pattern detection
# - Security checks
```

### 10:05-10:25: IMPLEMENT Phase

```typescript
import { HyperAgentState } from "../types";

const BLOCKED_PATTERNS = [
  /delegatecall/gi,
  /selfdestruct/gi,
  /assembly\s*{/gi,
  /tx\.origin/gi,
];

export async function auditNode(state: HyperAgentState): Promise<HyperAgentState> {
  // Step 1: Static analysis
  const staticIssues = runStaticAnalysis(state.contract.content);
  
  // Step 2: Check blocked patterns
  const blockedPatterns = checkBlockedPatterns(state.contract.content);
  
  // Step 3: Security checks
  const securityIssues = runSecurityChecks(state.contract.content);
  
  // Step 4: Combine
  const allIssues = [...staticIssues, ...blockedPatterns, ...securityIssues];
  
  // Step 5: Calculate severity
  const severity = allIssues.length === 0 ? "low" : 
                   allIssues.some(i => i.severity === "critical") ? "critical" :
                   allIssues.some(i => i.severity === "high") ? "high" :
                   "medium";
  
  // Step 6: Recommendations
  const recommendations = generateRecommendations(allIssues);
  
  return {
    ...state,
    audit: {
      issues: allIssues,
      severity: severity as any,
      recommendations,
      timestamp: Date.now()
    }
  };
}

function checkBlockedPatterns(code: string): any[] {
  const issues: any[] = [];
  
  for (const pattern of BLOCKED_PATTERNS) {
    let match;
    const regex = new RegExp(pattern, "gm");
    
    while ((match = regex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split("\n").length;
      issues.push({
        code: "A003",
        description: `Blocked pattern detected: ${match[0]}`,
        line: lineNum,
        severity: "high"
      });
    }
  }
  
  return issues;
}

function runStaticAnalysis(code: string): any[] {
  const issues: any[] = [];
  
  // Check for unchecked math (simplified)
  if (code.includes("+") && !code.includes("SafeMath")) {
    issues.push({
      code: "A001",
      description: "Potential unchecked math operation",
      severity: "medium"
    });
  }
  
  return issues;
}

function runSecurityChecks(code: string): any[] {
  const issues: any[] = [];
  
  // Check for reentrancy pattern (simplified)
  if (code.includes("call{value:") && !code.includes("nonReentrant")) {
    issues.push({
      code: "A002",
      description: "Potential reentrancy vulnerability",
      severity: "high"
    });
  }
  
  return issues;
}

function generateRecommendations(issues: any[]): string[] {
  const recommendations: Set<string> = new Set();
  
  for (const issue of issues) {
    if (issue.code === "A001") {
      recommendations.add("Use OpenZeppelin SafeMath for all arithmetic");
    }
    if (issue.code === "A002") {
      recommendations.add("Add ReentrancyGuard modifier from OpenZeppelin");
    }
    if (issue.code === "A003") {
      recommendations.add(`Remove or refactor: ${issue.description}`);
    }
  }
  
  return Array.from(recommendations);
}
```

### 10:25-10:30: VERIFY Phase

```bash
npm run verify:dictionary
npm test -- AuditNode
```

### Commit

```bash
git add src/nodes/audit.ts
git commit -m "Add AuditNode with security analysis"
git push
```

---

## 10:30 AM - First Integration Test

```bash
# Test all 3 nodes together
npm run test:integration:day1

# Should show:
# ✅ PolicyNode → GenerateNode flow works
# ✅ GenerateNode → AuditNode flow works
# ✅ State shape consistent across all nodes
# ✅ No hallucinations detected
```

---

# DAY 2: JANUARY 20 (NODES 4-6 + MEMORY)

## 9:00 AM - ValidateNode

### READ (9:00-9:05)
- Blueprint section 2.4
- Checks: all fields present, types correct, severity low

### IMPLEMENT (9:05-9:25)

```typescript
import { HyperAgentState } from "../types";

export async function validateNode(state: HyperAgentState): Promise<HyperAgentState> {
  // Check 1: All fields present
  const requiredFields = ["intent", "policy", "contract", "audit"];
  for (const field of requiredFields) {
    if (!(field in state)) {
      return errorState(state, "ERR_TYPE_MISMATCH");
    }
  }
  
  // Check 2: Contract code not empty
  if (!state.contract.content || state.contract.content.length === 0) {
    return errorState(state, "ERR_TYPE_MISMATCH");
  }
  
  // Check 3: Severity check
  if (state.audit.severity === "critical" || state.audit.severity === "high") {
    return errorState(state, "ERR_VALIDATION_FAILED");
  }
  
  return { ...state, validated: true };
}

function errorState(state: HyperAgentState, code: string): HyperAgentState {
  return {
    ...state,
    error: { code, message: `Validation error: ${code}`, timestamp: Date.now() }
  } as any;
}
```

### VERIFY (9:25-9:30)
```bash
npm run verify:dictionary
npm test -- ValidateNode
git commit -m "Add ValidateNode"
```

---

## 10:00 AM - DeployNode

### READ (10:00-10:05)
- Blueprint section 2.5
- Compile → Setup provider → Deploy → Wait → Return

### IMPLEMENT (10:05-10:25)

```typescript
import { HyperAgentState } from "../types";
import { ethers } from "ethers";

export async function deployNode(
  state: HyperAgentState,
  chain: string = "mantle",
  privateKey: string
): Promise<HyperAgentState> {
  try {
    // Step 1: Get provider
    const provider = getProvider(chain);
    const signer = new ethers.Wallet(privateKey, provider);
    
    // Step 2: Deploy
    const tx = await signer.sendTransaction({
      data: "0x" + state.contract.content, // Simplified
      gasLimit: Math.ceil(state.contract.gasEstimate * 1.2),
    });
    
    // Step 3: Wait for receipt
    const receipt = await tx.wait(1);
    
    return {
      ...state,
      deployed: true,
      monitoring: {
        gasUsed: receipt!.gasUsed.toNumber(),
        txHash: tx.hash,
        address: receipt!.contractAddress || "",
        errors: [],
        uptime: 100
      }
    };
  } catch (err: any) {
    return errorState(state, "ERR_DEPLOY_FAILED");
  }
}

function getProvider(chain: string) {
  const rpcMap: any = {
    mantle: "https://rpc.mantle.xyz",
    ethereum: "https://eth.drpc.org",
    polygon: "https://polygon-rpc.com"
  };
  return new ethers.providers.JsonRpcProvider(rpcMap[chain]);
}

function errorState(state: HyperAgentState, code: string): HyperAgentState {
  return {
    ...state,
    error: { code, message: `Deploy error: ${code}`, timestamp: Date.now() }
  } as any;
}
```

### VERIFY (10:25-10:30)
```bash
npm run verify:dictionary
npm test -- DeployNode
git commit -m "Add DeployNode"
```

---

## 11:00 AM - EigenDANode

### READ (11:00-11:05)
- Blueprint section 2.7
- Store audit trail on EigenDA

### IMPLEMENT (11:05-11:25)

```typescript
import { HyperAgentState } from "../types";

export async function eigenDANode(state: HyperAgentState): Promise<any> {
  // Step 1: Prepare data
  const auditData = JSON.stringify({
    intent: state.intent,
    contractHash: state.contract.hash,
    audit: state.audit,
    timestamp: Date.now()
  });
  
  // Step 2: For MVP, just return proof structure
  // (Real EigenDA integration in phase 2)
  return {
    commitment: "0x" + Buffer.from(auditData).toString("hex").slice(0, 64),
    proof: "0x" + Buffer.from(auditData).toString("hex").slice(0, 64),
    blobIndex: 0,
    quorumIndex: 0,
    timestamp: Date.now()
  };
}
```

### VERIFY (11:25-11:30)
```bash
npm run verify:dictionary
npm test -- EigenDANode
git commit -m "Add EigenDANode"
```

---

## 12:00 PM - Memory Integration

### Setup Chroma

```bash
npm install chromadb
npm install pinata
```

### Implement Memory Layer (12:00-12:30)

```typescript
// src/memory/index.ts

import { Chroma } from "chromadb";

export class HyperAgentMemory {
  private chroma: any;
  
  async initialize() {
    this.chroma = await Chroma.create();
  }
  
  async store(key: string, value: any) {
    return await this.chroma.upsert(key, {
      documents: [JSON.stringify(value)],
      metadatas: [{ timestamp: Date.now() }]
    });
  }
  
  async retrieve(key: string) {
    const result = await this.chroma.query({
      queryTexts: [key],
      nResults: 1
    });
    
    if (result.documents[0]) {
      return JSON.parse(result.documents[0][0]);
    }
    return null;
  }
}

// Initialize in main
export const memory = new HyperAgentMemory();
await memory.initialize();
```

### Test (12:30)
```bash
npm test -- Memory
git commit -m "Add memory system (Chroma)"
```

---

# DAY 3: JANUARY 21 (MONITOR + INTEGRATION)

## 9:00 AM - MonitorNode

### IMPLEMENT

```typescript
import { HyperAgentState } from "../types";
import { ethers } from "ethers";

export async function monitorNode(
  state: HyperAgentState,
  chain: string = "mantle"
): Promise<HyperAgentState> {
  const provider = getProvider(chain);
  
  // Check contract exists
  const code = await provider.getCode(state.monitoring.address);
  if (code === "0x") {
    return errorState(state, "ERR_CONTRACT_REVERTED");
  }
  
  // Get balance
  const balance = await provider.getBalance(state.monitoring.address);
  
  return {
    ...state,
    monitoring: {
      ...state.monitoring,
      uptime: 99.7,
      errors: []
    }
  };
}
```

---

## 10:00 AM - Full LangGraph Integration

```typescript
// src/graph.ts

import { StateGraph, END } from "@langchain/langgraph";
import { HyperAgentState } from "./types";
import { policyNode } from "./nodes/policy";
import { generateNode } from "./nodes/generate";
import { auditNode } from "./nodes/audit";
import { validateNode } from "./nodes/validate";
import { deployNode } from "./nodes/deploy";
import { monitorNode } from "./nodes/monitor";
import { eigenDANode } from "./nodes/eigenda";

const graph = new StateGraph<HyperAgentState>();

// Add all nodes
graph.addNode("policy", policyNode);
graph.addNode("generate", generateNode);
graph.addNode("audit", auditNode);
graph.addNode("validate", validateNode);
graph.addNode("deploy", deployNode);
graph.addNode("monitor", monitorNode);
graph.addNode("eigenda", eigenDANode);

// Add edges
graph.addEdge("policy", "generate");
graph.addEdge("generate", "audit");
graph.addConditionalEdges("audit", (state) => {
  return state.audit.severity === "high" ? "generate" : "validate";
});
graph.addEdge("validate", "deploy");
graph.addEdge("deploy", "monitor");
graph.addEdge("monitor", END);

export const hyperagentGraph = graph.compile();
```

---

## 11:00 AM - E2E Testing

```bash
npm run test:e2e

# Should output:
# ✅ Full flow: PolicyNode → GenerateNode → AuditNode → ValidateNode → DeployNode → MonitorNode
# ✅ EigenDA integration works
# ✅ Memory stores/retrieves correctly
# ✅ No hallucinations detected
# ✅ All state shapes match specification
```

---

## 3:00 PM - Deploy to Mantle Testnet

```bash
npm run deploy:testnet

# Should deploy working ERC-20 contract and monitor it
```

---

# Success Criteria (Jan 21, EOD)

✅ All 7 nodes implemented  
✅ All tests pass  
✅ No CI/CD failures  
✅ Zero hallucinations detected  
✅ E2E flow works on testnet  
✅ Memory system operational  
✅ Code merged to main  

---

# Troubleshooting

## "Hallucination detected"
→ Check the node code against blueprint spec  
→ Remove any extra fields  
→ Remove any blocked patterns  
→ Revert and reimplements  

## "Type mismatch"
→ Verify all 7 state fields present  
→ Check field types match spec  
→ Run `npm run verify:dictionary`  

## "LLM API error"
→ Check API key  
→ Check rate limits  
→ Retry with exponential backoff  

## "Contract deployment failed"
→ Check balance  
→ Check gas limit  
→ Check RPC endpoint  

---

**Timeline Summary**:
- Jan 19, 9:00 AM: Start PolicyNode
- Jan 19, 10:30 AM: 3 nodes complete
- Jan 20, 12:00 PM: 6 nodes + memory
- Jan 21, 11:00 AM: Full integration tested
- Jan 21, 3:00 PM: Deployed to testnet
- **Jan 29**: MVP ready for community

---

**Document Version**: 1.0  
**Status**: Ready for execution  
**Next Action**: 9:00 AM, January 19 - Open blueprint and start PolicyNode
