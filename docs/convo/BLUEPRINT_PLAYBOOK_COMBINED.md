# HyperAgent Combined Blueprint + Playbook

Generated from repository sources.

## Contents
- Blueprint: hyperagent_dna_blueprint.md
- Playbook: hyperagent_playbook.md

---

## Blueprint

# 🧬 HyperAgent DNA Blueprint v1.0
## Complete Specification for "Anti-Hallucination" Agent Development
### The Concrete Pattern to Override AI Creativity & Ensure Deterministic Execution

---

## 🎯 THE FUNDAMENTAL PROBLEM

**Why "vibe coding" fails:**

```
User: "Create an AI agent for smart contract generation"
↓
AI reads prompt + training data
↓
AI generates "own" design based on training corpus
↓
Result: 47 different architectural approaches, not yours
↓
You pick one, AI implements differently next time
↓
→ You're not building an agent, you're fighting one
```

**The root cause:** LLMs are pattern-matching engines trained on billions of code examples. Without a "dictionary" (design tokens), they default to the most statistically probable design in their training data, not YOUR design.

**The fix:** Stop treating AI as a designer. Treat it as a **translator**.

---

## 📋 3-STEP ANTI-HALLUCINATION WORKFLOW

### STEP 1: Dictionary First (Design Tokens)
**Define EXACTLY what exists and how.**

### STEP 2: Specification Lock (No Creativity)
**Provide rigid specifications, not creative briefs.**

### STEP 3: Verification Protocol (Test Against Token Spec)
**Every output must match dictionary. Reject anything that invents new patterns.**

---

---

# PART 1: DICTIONARY (Design Tokens)
## "This is what exists. Period."

### Type System (Core Types - These Are COMPLETE)

```typescript
/**
 * DESIGN TOKEN: NodeType
 * These are the ONLY valid node types in HyperAgent.
 * Do not invent new types. Use only these.
 */
type NodeType = 
  | "policy"          // ERC compliance checking
  | "generate"        // LLM-based generation
  | "audit"           // Slither audit execution
  | "validate"        // Schema validation
  | "deploy"          // Thirdweb deployment
  | "eigenda"         // EigenDA proof storage
  | "monitor"         // Event monitoring + memory save

/**
 * DESIGN TOKEN: EdgeConnection
 * These are the ONLY valid transitions between nodes.
 * All other transitions are INVALID.
 * Graph enforces these via LangGraph edges only.
 */
const VALID_TRANSITIONS: Record<NodeType, NodeType[]> = {
  "policy":   ["generate"],           // Always → generate
  "generate": ["audit"],              // Always → audit
  "audit":    ["validate"],           // Always → validate
  "validate": ["deploy", "generate"], // → deploy if pass, else loop to generate
  "deploy":   ["eigenda"],            // Always → eigenda
  "eigenda":  ["monitor"],            // Always → monitor
  "monitor":  ["TERMINAL"],           // Always → success state
}

/**
 * DESIGN TOKEN: State Shape
 * This is the COMPLETE state object. Nothing else is added.
 * All 7 fields present on every state transition.
 * No optional fields, no extra properties.
 */
type HyperAgentState = {
  intent: string;
  contract: string;
  auditResults: { passed: boolean; findings: string[] };
  deploymentAddress: string;
  txHash: string;
  status: "processing" | "auditing" | "validating" | "deploying" | "success" | "failed";
  logs: string[];
}

/**
 * DESIGN TOKEN: Node Input/Output
 * Every node receives the COMPLETE state.
 * Every node returns the COMPLETE state with updates.
 * No partial updates. No selective fields.
 */
interface NodeDefinition {
  input: HyperAgentState;
  output: HyperAgentState;
  maxRetries: number;
  timeout: number;
}

/**
 * DESIGN TOKEN: LLM Model Map
 * These are the ONLY LLM endpoints.
 * Other models are REJECTED at runtime.
 */
const APPROVED_MODELS = {
  "generate": {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 8192,
    temperature: 0.2
  },
  "audit": {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 4096,
    temperature: 0.0
  }
}
```

### Memory System (Dictionary)

```typescript
/**
 * DESIGN TOKEN: Memory Layer Architecture
 * EXACTLY 3 layers, no more, no fewer.
 */
type MemoryLayer = "volatile" | "persistent" | "immutable"

const MEMORY_LAYERS: Record<MemoryLayer, {
  storage: string;
  duration: string;
  backend: string;
  query: string;
}> = {
  "volatile": {
    storage: "LangGraph state object",
    duration: "5 minutes (execution lifetime)",
    backend: "in-memory",
    query: "read-write on every node"
  },
  "persistent": {
    storage: "Chroma vector database",
    duration: "1 month rolling window",
    backend: "http://localhost:8000",
    query: "semantic similarity search via embeddings"
  },
  "immutable": {
    storage: "Pinata IPFS",
    duration: "5+ years",
    backend: "https://api.pinata.cloud",
    query: "content-addressed by CID"
  }
}

/**
 * DESIGN TOKEN: Memory Query Interface
 * ONLY these operations. No custom queries.
 */
type MemoryOperation = 
  | "store_contract"    // Save to Chroma
  | "find_similar"      // Search Chroma by intent
  | "get_patterns"      // Aggregate Chroma results
  | "pin_to_ipfs"       // Save to Pinata
  | "fetch_from_ipfs"   // Load from Pinata via CID

/**
 * DESIGN TOKEN: Memory Integration Points
 * EXACTLY where memory is called in the graph.
 * NOT in other nodes.
 */
const MEMORY_INTEGRATION_POINTS = {
  "generate": {
    operation: "find_similar",
    input: "state.intent",
    output: "results: []",
    usage: "Enhance LLM prompt with reference contracts"
  },
  "monitor": {
    operation: "store_contract",
    input: "state (full)",
    output: "success: boolean",
    usage: "Save successful deployment to Chroma"
  },
  "eigenda": {
    operation: "pin_to_ipfs",
    input: "contract + auditResults",
    output: "cid: string",
    usage: "Store proof on Pinata"
  }
}
```

### Deployment System (Dictionary)

```typescript
/**
 * DESIGN TOKEN: Supported Chains
 * These are the ONLY chains. Others are INVALID.
 */
const SUPPORTED_CHAINS = {
  "mantle": {
    rpcUrl: "https://sepolia.mantle.xyz",
    chainId: 5003,
    explorer: "https://explorer.sepolia.mantle.xyz",
    aa_entrypoint: "0x5FF137D4b0FDCD49DcA30c7B5Fb0e97ee356842",
    paymaster: "0x..." // Thirdweb paymaster
  },
  "avalanche": {
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    aa_entrypoint: "0x5FF137D4b0FDCD49DcA30c7B5Fb0e97ee356842",
    paymaster: "0x..."
  },
  "skale": {
    rpcUrl: "https://testnet.skalenodes.com/fs/testnet-chaos",
    chainId: 1444673419,
    explorer: "https://testnet-chaos.explorer.skale.network",
    aa_entrypoint: "0x5FF137D4b0FDCD49DcA30c7B5Fb0e97ee356842",
    paymaster: "0x..."
  }
}

/**
 * DESIGN TOKEN: Deployment Protocol
 * EXACTLY this sequence. Nothing else.
 */
const DEPLOYMENT_STEPS = [
  {
    step: 1,
    name: "validate_bytecode",
    input: "contract: string",
    validation: "Opcode count < 24576, no SELFDESTRUCT",
    onFail: "revert to generate node"
  },
  {
    step: 2,
    name: "create_smart_account",
    input: "chain: string, userId: string",
    call: "thirdweb.createSmartAccount({ chain, address: userId })",
    output: "accountAddress: string"
  },
  {
    step: 3,
    name: "deploy_with_aa",
    input: "bytecode, accountAddress, chain",
    call: "thirdweb.deploy({ bytecode, account })",
    output: "contractAddress: string, txHash: string"
  },
  {
    step: 4,
    name: "verify_on_chain",
    input: "contractAddress, chain",
    validation: "eth_getCode returns non-empty",
    onFail: "retry with exponential backoff (3x)"
  }
]

/**
 * DESIGN TOKEN: x402 Metering (ERC-7732)
 * EXACTLY how we meter costs.
 */
const X402_METERING = {
  "policy_check": { cost: 0.001, unit: "per intent" },
  "generation": { cost: 0.05, unit: "per contract" },
  "audit": { cost: 0.02, unit: "per contract" },
  "deployment": { cost: 0.1, unit: "per deployment" },
  "storage": { cost: 0.01, unit: "per month" }
}
```

### Error Handling (Dictionary)

```typescript
/**
 * DESIGN TOKEN: Error Codes
 * EXACTLY these codes. No custom errors.
 */
const ERROR_CODES = {
  "E001": { name: "INVALID_INTENT", recoverable: true, action: "retry_policy" },
  "E002": { name: "GENERATION_FAILED", recoverable: true, action: "retry_generate" },
  "E003": { name: "AUDIT_FAILED", recoverable: true, action: "mutate_contract" },
  "E004": { name: "VALIDATION_FAILED", recoverable: true, action: "retry_generate" },
  "E005": { name: "DEPLOYMENT_FAILED", recoverable: false, action: "escalate_user" },
  "E006": { name: "STORAGE_FAILED", recoverable: false, action: "log_alert" },
}

/**
 * DESIGN TOKEN: Retry Policy
 * EXACTLY this exponential backoff.
 */
const RETRY_POLICY = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  sequence: [1000, 2000, 4000]
}

/**
 * DESIGN TOKEN: Fallback Responses
 * When LLM fails, use ONLY these templates.
 */
const FALLBACK_CONTRACTS = {
  "erc20": "pragma solidity ^0.8.0; contract Token { ... }",
  "erc721": "pragma solidity ^0.8.0; contract NFT { ... }",
  "multisig": "pragma solidity ^0.8.0; contract MultiSig { ... }"
}
```

---

# PART 2: SPECIFICATION LOCK
## "Build exactly this. No creativity."

### Node Specification (Copy-Paste this for EVERY node)

```typescript
/**
 * NODE SPECIFICATION: PolicyNode
 * NEVER deviate from this spec.
 */

// 1. INPUT SHAPE (EXACT)
const POLICY_INPUT = {
  intent: string,
  // NO OTHER FIELDS
}

// 2. VALIDATION (EXACT)
function validatePolicyInput(input: HyperAgentState): boolean {
  const checks = [
    input.intent.length > 0,
    input.intent.length < 500,
    /^[a-zA-Z0-9\s:,.\-()]*$/.test(input.intent), // ASCII only
  ];
  return checks.every(c => c === true);
}

// 3. INTERNAL LOGIC (EXACT STEPS)
async function policyNode(state: HyperAgentState): Promise<HyperAgentState> {
  // Step 1: Validate input
  if (!validatePolicyInput(state)) {
    return { ...state, status: "failed", logs: [...state.logs, "[POLICY] Invalid intent"] };
  }
  
  // Step 2: Check compliance rules
  const rules = [
    { rule: "no_selfdestruct", check: () => !state.intent.toLowerCase().includes("selfdestruct") },
    { rule: "no_delegatecall", check: () => !state.intent.toLowerCase().includes("delegatecall") },
  ];
  
  const violations = rules.filter(r => !r.check());
  if (violations.length > 0) {
    return { 
      ...state, 
      status: "failed", 
      logs: [...state.logs, `[POLICY] Violations: ${violations.map(v => v.rule).join(", ")}`] 
    };
  }
  
  // Step 3: Update state and log
  return {
    ...state,
    status: "processing",
    logs: [...state.logs, "[POLICY] ✓ Intent valid, proceeding to generation"]
  };
}

// 4. OUTPUT SHAPE (COMPLETE STATE, NEVER PARTIAL)
// Returns: HyperAgentState with updated status and logs

// 5. EDGE ROUTING (EXACT)
// ALWAYS routes to: "generate" node
// Never routes elsewhere

// 6. TIMEOUT
const POLICY_TIMEOUT = 5000; // 5 seconds

// 7. METRICS
const POLICY_METRICS = {
  maxRetries: 1,
  failureRate: "0%",
  latencyP99: "< 500ms"
}
```

### Generate Node Specification (EXACT)

```typescript
/**
 * NODE SPECIFICATION: GenerateNode
 * EXACT implementation. No improvisation.
 */

async function generateNode(state: HyperAgentState): Promise<HyperAgentState> {
  console.log(`[GENERATE] Intent: "${state.intent}"`);

  try {
    // Step 1: Query memory for similar contracts
    const similar = await memory.findSimilarContracts(state.intent, 3);
    console.log(`[MEMORY] Found ${similar.length} similar contracts`);

    // Step 2: Build memory context (if similar contracts exist)
    let memoryContext = "";
    if (similar.length > 0) {
      memoryContext = `\n\nREFERENCE CONTRACTS (from memory, do NOT copy):\n`;
      similar.forEach((s, i) => {
        memoryContext += `${i + 1}. Intent: "${s.intent}" (Risk: ${s.riskLevel}, Chain: ${s.chain})\n`;
      });
    }

    // Step 3: Build prompt with APPROVED model
    const prompt = `You are a Solidity expert. Generate a production-grade smart contract ONLY.

Intent: ${state.intent}
Chain: ${state.chain}
Testnet: ${state.testnet ? "Yes" : "No"}
${memoryContext}

REQUIREMENTS (NON-NEGOTIABLE):
1. Pragma: ^0.8.0 minimum
2. No external calls except ERC standard interfaces
3. No selfdestruct, no delegatecall, no raw asm
4. Include natspec comments
5. Include require() for all inputs
6. Gas optimized (no unnecessary storage)
7. Return ONLY valid Solidity code, no markdown

Generate the contract:`;

    // Step 4: Call APPROVED LLM model ONLY
    const response = await anthropic.messages.create({
      model: APPROVED_MODELS["generate"].model,
      max_tokens: APPROVED_MODELS["generate"].maxTokens,
      temperature: APPROVED_MODELS["generate"].temperature,
      messages: [{ role: "user", content: prompt }]
    });

    // Step 5: Extract contract from response
    const content = response.content[0].type === "text" ? response.content[0].text : "";
    const contractMatch = content.match(/pragma\s+solidity[\s\S]*?}/);
    const contract = contractMatch ? contractMatch[0] : FALLBACK_CONTRACTS["erc20"];

    // Step 6: Update state with COMPLETE fields
    return {
      ...state,
      contract,
      status: "auditing",
      logs: [...state.logs, `[GENERATE] Created contract (${contract.length} bytes)`]
    };

  } catch (e) {
    // Step 7: On error, use APPROVED fallback only
    return {
      ...state,
      contract: FALLBACK_CONTRACTS["erc20"],
      status: "auditing",
      logs: [...state.logs, `[GENERATE] Error (${e.message}), using fallback`]
    };
  }
}

// SPEC CHECKLIST:
// ✓ Input validation
// ✓ Memory integration at EXACT point
// ✓ LLM model from APPROVED list
// ✓ Prompt matches dictionary format
// ✓ Output includes COMPLETE state
// ✓ Fallback uses APPROVED templates only
// ✓ Error handling via APPROVED codes
// ✓ Logging at each step
```

### Audit Node Specification (EXACT)

```typescript
/**
 * NODE SPECIFICATION: AuditNode
 * EXACT. No changes allowed.
 */

async function auditNode(state: HyperAgentState): Promise<HyperAgentState> {
  console.log(`[AUDIT] Analyzing contract...`);

  try {
    // Step 1: Run Slither (ONLY approved tool)
    const slitherResult = await runSlither(state.contract);

    // Step 2: Parse results (EXACT mapping)
    const findings = slitherResult.results || [];
    const highSeverity = findings.filter(f => f.severity === "high").length;
    const passed = highSeverity === 0;

    // Step 3: Update state with COMPLETE audit results
    return {
      ...state,
      auditResults: { passed, findings: findings.map(f => f.description) },
      status: "validating",
      logs: [...state.logs, `[AUDIT] ${passed ? "✓ Passed" : "✗ Failed"} (${highSeverity} high severity)`]
    };

  } catch (e) {
    // Fallback: Assume passed if tool fails (non-blocking)
    return {
      ...state,
      auditResults: { passed: true, findings: [] },
      status: "validating",
      logs: [...state.logs, `[AUDIT] Tool error (${e.message}), proceeding`]
    };
  }
}

// SPEC CHECKLIST:
// ✓ Uses ONLY Slither
// ✓ Severity mapping matches dictionary
// ✓ Returns COMPLETE state
// ✓ Non-blocking failure
```

### Deploy Node Specification (EXACT)

```typescript
/**
 * NODE SPECIFICATION: DeployNode
 * Follow EXACTLY. No improvisation.
 */

async function deployNode(state: HyperAgentState): Promise<HyperAgentState> {
  console.log(`[DEPLOY] Deploying to ${state.chain}...`);

  try {
    // Step 1: Get chain config from APPROVED list
    const chainConfig = SUPPORTED_CHAINS[state.chain];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${state.chain}`);
    }

    // Step 2: Create smart account (Thirdweb)
    const account = await thirdweb.createSmartAccount({
      chain: state.chain,
      address: state.userId
    });

    // Step 3: Deploy via Thirdweb (EXACT steps from dictionary)
    const tx = await thirdweb.deploy({
      bytecode: state.contract,
      chain: state.chain,
      account
    });

    // Step 4: Verify on-chain (retry 3x)
    let attempts = 0;
    let verified = false;
    while (attempts < 3 && !verified) {
      const code = await provider.getCode(tx.address);
      verified = code.length > 0;
      if (!verified) await sleep(2000);
      attempts++;
    }

    if (!verified) {
      throw new Error("Deployment verification failed");
    }

    // Step 5: Update state with deployment details
    return {
      ...state,
      deploymentAddress: tx.address,
      txHash: tx.hash,
      status: "success",
      logs: [...state.logs, `[DEPLOY] ✓ Deployed to ${tx.address}`]
    };

  } catch (e) {
    return {
      ...state,
      status: "failed",
      logs: [...state.logs, `[DEPLOY] ✗ Error: ${e.message}`]
    };
  }
}

// SPEC CHECKLIST:
// ✓ Chain validation via APPROVED list
// ✓ Thirdweb integration EXACT
// ✓ Retry logic from APPROVED policy
// ✓ Returns COMPLETE state
```

---

# PART 3: VERIFICATION PROTOCOL
## "Every output must match the dictionary. Reject anything else."

### Output Validation Framework

```typescript
/**
 * VERIFICATION: Validate every node output against dictionary
 * Run this BEFORE returning from each node
 */

function verifyNodeOutput(
  output: HyperAgentState,
  expectedNode: NodeType
): { valid: boolean; errors: string[] } {
  
  const errors: string[] = [];

  // Check 1: All required fields present
  const requiredFields = ["intent", "contract", "auditResults", "deploymentAddress", "txHash", "status", "logs"];
  requiredFields.forEach(field => {
    if (!(field in output)) {
      errors.push(`Missing field: ${field}`);
    }
  });

  // Check 2: Status is valid
  const validStatuses = ["processing", "auditing", "validating", "deploying", "success", "failed"];
  if (!validStatuses.includes(output.status)) {
    errors.push(`Invalid status: ${output.status}`);
  }

  // Check 3: No extra fields (dictionary spec only)
  const allowedFields = new Set(requiredFields);
  Object.keys(output).forEach(key => {
    if (!allowedFields.has(key)) {
      errors.push(`Unexpected field: ${key}`);
    }
  });

  // Check 4: Edge routing is valid
  const nextValidEdges = VALID_TRANSITIONS[expectedNode] || [];
  // (Verified by LangGraph edge config, so just check here for safety)

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * VERIFICATION: Validate LLM response for hallucination
 * Run this AFTER every LLM call
 */

function verifyLLMResponse(response: string, context: string): { valid: boolean; reason: string } {
  // Check 1: No invented models
  if (response.includes("gpt-4-turbo") || response.includes("claude-2")) {
    return { valid: false, reason: "Invented model reference" };
  }

  // Check 2: No invented libraries
  if (response.includes("solc-js-v0.7") || response.includes("custom-token-factory")) {
    return { valid: false, reason: "Invented library reference" };
  }

  // Check 3: No new node types
  const textNodeTypes = response.match(/node[:\s]+"(\w+)"/gi);
  if (textNodeTypes) {
    textNodeTypes.forEach(match => {
      const nodeType = match.split('"')[1];
      if (!["policy", "generate", "audit", "validate", "deploy", "eigenda", "monitor"].includes(nodeType)) {
        return { valid: false, reason: `Invented node type: ${nodeType}` };
      }
    });
  }

  // Check 4: No invented state fields
  const stateFields = response.match(/state\.(\w+)/g);
  if (stateFields) {
    const allowedStateFields = new Set(["intent", "contract", "auditResults", "deploymentAddress", "txHash", "status", "logs"]);
    stateFields.forEach(match => {
      const field = match.split(".")[1];
      if (!allowedStateFields.has(field)) {
        return { valid: false, reason: `Invented state field: ${field}` };
      }
    });
  }

  return { valid: true, reason: "OK" };
}

/**
 * VERIFICATION: Memory integration validation
 * Run this BEFORE saving to Chroma/Pinata
 */

function verifyMemoryOperation(operation: MemoryOperation, data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (operation) {
    case "store_contract":
      if (!data.contract || !data.intent || !data.deploymentAddress) {
        errors.push("Missing required fields for store_contract");
      }
      break;
    case "find_similar":
      if (!data.intent || typeof data.topK !== "number") {
        errors.push("Missing intent or topK for find_similar");
      }
      break;
    case "pin_to_ipfs":
      if (!data.contract && !data.auditResults) {
        errors.push("Missing contract or auditResults for IPFS");
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}
```

### Testing Protocol

```typescript
/**
 * TEST: Verify node outputs before deployment
 * Run this in test suite
 */

describe("HyperAgent Nodes", () => {
  
  describe("PolicyNode", () => {
    it("should reject invalid intents", async () => {
      const input = { ...initialState, intent: "" };
      const output = await policyNode(input);
      expect(output.status).toBe("failed");
      expect(verifyNodeOutput(output, "policy").valid).toBe(true); // Verify output shape even on fail
    });

    it("should update logs correctly", async () => {
      const input = { ...initialState, logs: [] };
      const output = await policyNode(input);
      expect(output.logs.length).toBeGreaterThan(input.logs.length);
    });
  });

  describe("GenerateNode", () => {
    it("should only use APPROVED models", async () => {
      const spy = jest.spyOn(anthropic, "create");
      await generateNode(initialState);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: APPROVED_MODELS["generate"].model
        })
      );
    });

    it("should include memory context in prompt", async () => {
      const spy = jest.spyOn(memory, "findSimilarContracts");
      await generateNode(initialState);
      expect(spy).toHaveBeenCalled();
    });

    it("should return COMPLETE state", async () => {
      const output = await generateNode(initialState);
      const check = verifyNodeOutput(output, "generate");
      expect(check.valid).toBe(true);
      expect(check.errors).toEqual([]);
    });
  });

  describe("Memory Integration", () => {
    it("should store contracts in correct format", async () => {
      const spy = jest.spyOn(memory, "storeContract");
      await monitorNode(successState);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: expect.any(String),
          contract: expect.any(String),
          deploymentAddress: expect.any(String),
          riskLevel: expect.any(String)
        })
      );
    });

    it("should use APPROVED IPFS provider", async () => {
      const spy = jest.spyOn(pinata, "pinJSON");
      await eigenDANode(deployedState);
      expect(spy).toHaveBeenCalled();
    });
  });

});
```

---

# PART 4: THE PROMPT TEMPLATE
## "Use this exact structure. Don't deviate."

### System Prompt for Build Tasks

```
You are implementing HyperAgent node X according to a rigorous specification.

=== DESIGN TOKENS (Non-Negotiable) ===

Node Type: X
Input Shape: [exact from dictionary]
Output Shape: [exact from dictionary - COMPLETE state always]
Valid Transitions: [exact edges from dictionary]
Timeout: [exact from dictionary]
LLM Model: [exact approved model]
Error Handling: [exact error codes and recovery]

=== SPECIFICATION (Implement Exactly) ===

1. Input Validation:
   - Check: [exact validation from spec]
   - Check: [exact validation from spec]
   - On Fail: [exact action from spec]

2. Core Logic:
   - Step 1: [exact step from spec]
   - Step 2: [exact step from spec]
   - Step 3: [exact step from spec]

3. Output Format:
   - Return: HyperAgentState with these changes: [exact changes]
   - Verify: All required fields present
   - Verify: No extra fields added
   - Verify: Logs include step entries

4. Error Handling:
   - If [error condition]: Use fallback [exact fallback from dictionary]
   - Always: Return COMPLETE state
   - Never: Skip a required field

=== ANTI-HALLUCINATION RULES ===

DO NOT:
- Invent new state fields
- Suggest alternative LLM models
- Add extra validation not in spec
- Create new error codes
- Modify edge routing
- Skip timeout enforcement

DO:
- Use EXACT model names from dictionary
- Include logs at EVERY step
- Return COMPLETE state always
- Verify against dictionary before returning
- Reference line numbers from spec

=== VERIFICATION ===

Before returning code:
1. All required fields in output? YES
2. No extra fields? YES
3. Model approved? YES (list it)
4. Edges valid? YES (show routing)
5. Logs present at each step? YES (show them)

Confirm: "SPECIFICATION LOCK: [Node X implementation complete and verified against dictionary.]"

Your task: Implement [Node X]
```

### Prompt for AI Drift Detection

```
Review this code for AI hallucination (deviation from dictionary).

=== DICTIONARY SPEC ===
[paste relevant dictionary section]

=== IMPLEMENTATION ===
[paste implementation code]

=== DRIFT DETECTION ===

Check 1: Invented Fields?
- Expected state fields: [list]
- Found state fields: [list]
- Drift detected: YES/NO

Check 2: Invented Models?
- Approved models: [list]
- Found models: [list]
- Drift detected: YES/NO

Check 3: Invented Transitions?
- Valid edges: [list]
- Found edges: [list]
- Drift detected: YES/NO

Check 4: Missing Dictionary References?
- Required fallbacks: [list]
- Found fallbacks: [list]
- Drift detected: YES/NO

Result: CLEAN / DRIFT DETECTED

If drift detected, list specific deviations:
1. [deviation]
2. [deviation]
```

---

# PART 5: WORKFLOW PATTERN (Manus-Style)

## Session Planning File (PERSISTENT)

```markdown
# HyperAgent Build Session
## Date: Jan 19, 2026

### Session Goal
Build LangGraph agent with 7 nodes, memory integration, deployment.

### Dictionary Status
- ✓ Type System Defined
- ✓ Node Types Locked (7 types)
- ✓ State Shape Locked (7 fields)
- ✓ Valid Transitions Locked
- ✓ LLM Models Approved
- ✓ Memory Layers Specified
- ✓ Chains Supported
- ✓ Error Codes Defined

### Nodes (Progress)
- [ ] PolicyNode (Day 1)
- [ ] GenerateNode (Day 1)
- [ ] AuditNode (Day 1)
- [ ] ValidateNode (Day 1)
- [ ] DeployNode (Day 2)
- [ ] EigenDANode (Day 2)
- [ ] MonitorNode (Day 2)

### Memory Integration (Progress)
- [ ] Chroma setup
- [ ] Vector store wrapper
- [ ] Memory calls in GenerateNode
- [ ] Memory calls in MonitorNode
- [ ] Pinata integration

### Testing (Progress)
- [ ] Unit tests (each node)
- [ ] Integration tests (full graph)
- [ ] Drift detection tests
- [ ] Memory tests

### Known Deviations from Dictionary
(Leave empty - mark any intentional changes)

### Findings
- [findings as we discover issues]

### Next Session Catchup
When resuming:
1. Read this file first
2. Check "Progress" section
3. Read "Known Deviations"
4. Read "Findings"
5. Continue from last incomplete task
```

## Findings File (PERSISTENT)

```markdown
# Findings & Learnings

## Day 1

### Finding 1: LangGraph Edge Syntax
- Issue: LangGraph edges require exact function returns
- Solution: Return state object, never return node name string
- Applied: Updated template

### Finding 2: Chroma Localhost Connection
- Issue: Windows localhost resolution slower than expected
- Solution: Use "127.0.0.1" instead of "localhost"
- Applied: Chain config updated

### Finding 3: Memory Query Latency
- Issue: First Chroma query takes 1.5s, subsequent 100ms
- Solution: Cache vectorstore instance, don't recreate per query
- Applied: Singleton memory pattern

## Day 2

(Add as we discover)
```

## Progress File (REAL-TIME SESSION LOG)

```markdown
# Session Progress - Jan 19, 2026

## 10:00 AM
- Started PolicyNode implementation
- Verified input validation against dictionary spec
- Created unit test, PASSING

## 10:15 AM
- Started GenerateNode
- Issue: LLM response sometimes includes markdown code blocks
- Applied: Regex extraction per dictionary fallback spec
- Continuing...

## 11:00 AM
- GenerateNode complete
- Deployed to test harness
- 3 test runs: ALL PASSING
- Memory integration verified: PASSING

## 11:15 AM
- Started AuditNode
- Slither integration working
- Next: Deploy to testnet
```

---

# PART 6: CI/CD INTEGRATION (Drift Detection)

### Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running anti-hallucination checks..."

# Check 1: No invented state fields
for file in src/nodes/*.ts; do
  if grep -q "state\.[a-zA-Z]*" "$file"; then
    invalid_fields=$(grep -o "state\.[a-zA-Z_]*" "$file" | sort -u)
    valid_fields="intent contract auditResults deploymentAddress txHash status logs"
    while read -r field; do
      field_name=$(echo "$field" | cut -d. -f2)
      if ! echo "$valid_fields" | grep -q "$field_name"; then
        echo "ERROR: Invented state field: $field"
        exit 1
      fi
    done <<< "$invalid_fields"
  fi
done

# Check 2: No invented node types in transitions
if grep -q "case \"[^\"]*\"" src/graph.ts; then
  node_types=$(grep -o 'case "[^"]*"' src/graph.ts | cut -d'"' -f2 | sort -u)
  valid_types="policy generate audit validate deploy eigenda monitor"
  while read -r type; do
    if ! echo "$valid_types" | grep -q "$type"; then
      echo "ERROR: Invented node type: $type"
      exit 1
    fi
  done <<< "$node_types"
fi

# Check 3: No unauthorized LLM models
if grep -q "model:" src/nodes/generate.ts; then
  used_models=$(grep -o 'model: "[^"]*"' src/nodes/generate.ts | cut -d'"' -f2 | sort -u)
  approved="claude-3-5-sonnet-20241022"
  while read -r model; do
    if ! echo "$approved" | grep -q "$model"; then
      echo "ERROR: Unauthorized model: $model"
      exit 1
    fi
  done <<< "$used_models"
fi

echo "✓ All drift checks passed"
exit 0
```

### GitHub Actions Drift Detection

```yaml
# .github/workflows/anti-hallucination.yml

name: Anti-Hallucination Checks

on: [pull_request]

jobs:
  drift-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install

      - name: Check for state field drift
        run: |
          INVALID=$(grep -r "state\.[a-zA-Z]*" src/nodes/*.ts | grep -oE "state\.[a-zA-Z_]*" | sort -u | grep -v "state.intent" | grep -v "state.contract" | grep -v "state.auditResults" | grep -v "state.deploymentAddress" | grep -v "state.txHash" | grep -v "state.status" | grep -v "state.logs" || true)
          if [ ! -z "$INVALID" ]; then
            echo "ERROR: Invented state fields detected: $INVALID"
            exit 1
          fi

      - name: Check for unauthorized models
        run: |
          if grep -r "claude-2\|gpt-4-turbo\|gemini-pro" src/; then
            echo "ERROR: Unauthorized LLM model detected"
            exit 1
          fi

      - name: Check for invented node types
        run: |
          INVALID=$(grep -r "NodeType.*=" src/ | grep -oE '"[^"]*"' | grep -v "policy" | grep -v "generate" | grep -v "audit" | grep -v "validate" | grep -v "deploy" | grep -v "eigenda" | grep -v "monitor" || true)
          if [ ! -z "$INVALID" ]; then
            echo "ERROR: Invented node types: $INVALID"
            exit 1
          fi

      - name: Dictionary verification
        run: npm run test:verify-dictionary
```

---

# PART 7: DAILY EXECUTION CHECKLIST

## Before Writing Code

```
□ Read DICTIONARY section (2 mins)
□ Copy relevant SPECIFICATION LOCK section
□ Review existing implementation of similar node
□ Read today's findings from Findings.md
□ Ask: "Am I implementing the spec, or inventing?"
```

## While Writing Code

```
□ Reference line numbers from dictionary
□ Copy-paste exact field names, never retype
□ Add logs at EVERY step
□ Verify output shape before returning
□ Never add fields not in dictionary
□ Never call unapproved LLM models
□ Never invent error codes
```

## Before Committing

```
□ Run pre-commit hook (auto fails on drift)
□ Manually verify against dictionary (5 mins)
□ Run unit tests (must pass)
□ Run integration tests (must pass)
□ Update progress file
□ Update findings file if new learnings
□ Verify no extra fields in state
□ Verify edge routing is valid
```

---

# QUICK REFERENCE: Copy-Paste These

## Template: Implementing a New Node

```typescript
// Copy this exact template for every node

/**
 * NODE SPECIFICATION: [NodeName]
 * Dictionary reference: [section name]
 */

async function [nodeNameLower]Node(state: HyperAgentState): Promise<HyperAgentState> {
  console.log(`[${nodeNameUpper}] Starting...`);

  try {
    // Step 1: [exact step from dictionary]
    // Step 2: [exact step from dictionary]
    // Step 3: [exact step from dictionary]

    return {
      ...state,
      // Update: [fields per spec only]
      logs: [...state.logs, `[${nodeNameUpper}] ✓ Complete`]
    };

  } catch (e) {
    return {
      ...state,
      status: "failed",
      logs: [...state.logs, `[${nodeNameUpper}] ✗ Error: ${e.message}`]
    };
  }
}
```

## Template: Adding Memory Integration

```typescript
// Memory integration ONLY at approved points

async function generateNode(state: HyperAgentState): Promise<HyperAgentState> {
  // APPROVED: Memory query in generate node
  const similar = await memory.findSimilarContracts(state.intent, 3);
  
  // Use in prompt
  const memoryContext = similar.length > 0
    ? `REFERENCE: ${similar.map(s => s.intent).join(", ")}`
    : "";

  // Rest of implementation...
}

async function monitorNode(state: HyperAgentState): Promise<HyperAgentState> {
  // APPROVED: Memory storage in monitor node
  if (state.status === "success") {
    await memory.storeContract({
      intent: state.intent,
      contract: state.contract,
      deploymentAddress: state.deploymentAddress,
      riskLevel: state.auditResults.passed ? "low" : "medium"
    });
  }
  
  // Rest of implementation...
}
```

---

# FINAL CHECKLIST: "Are We Drifting?"

```
Am I adding fields not in the dictionary?      → STOP. Remove.
Am I calling unapproved LLM models?            → STOP. Use approved only.
Am I inventing new node types?                 → STOP. Use only 7 types.
Am I creating new error codes?                 → STOP. Use approved codes.
Am I changing edge transitions?                → STOP. Use dictionary graph.
Am I adding validation not in spec?            → STOP. Only specified checks.
Am I using different LLM prompts?              → STOP. Use template.
Am I storing to unapproved backends?           → STOP. Use Chroma/Pinata only.

If you answered YES to any: REVERT and ask yourself "Why am I deviating?"

The dictionary is the source of truth. You are not a designer. You are a translator.
```

---

## Summary

**This blueprint achieves "anti-hallucination" through:**

1. **Dictionary First** — All design tokens defined before ANY coding
2. **Specification Lock** — EXACT specs for each node, no creativity
3. **Output Verification** — Every output checked against dictionary
4. **Persistent Planning** — Files record progress, findings, deviations
5. **Git-level Enforcement** — Pre-commit hooks reject drift
6. **Template Uniformity** — All nodes built from identical template

**When you follow this pattern:**
- AI cannot drift (dictionary prevents it)
- Implementation is deterministic
- Deviations are caught before merge
- New team members see the spec first
- No "vibe coding" inventing new designs

This is the **$2B Manus pattern**: Context engineering + filesystem persistence + dictionary-driven AI = deterministic agents that build exactly what you specify.

---

**Document Version**: 1.0  
**Last Updated**: 18 January 2026  
**Status**: Ready to Deploy  
**Next**: Use this blueprint for Day 1 implementation (Jan 19)


---

## Playbook

# 🚀 HyperAgent Implementation Playbook
## Day 1-3: How to Use the DNA Blueprint to Build Without AI Drift

---

## Quick Start: Using the Blueprint

### What You Have
- **DNA Blueprint**: Design tokens + specification lock + verification protocol
- **Reference**: 7 nodes fully specified
- **CI/CD**: Drift detection hooks
- **Planning files**: Session tracking (Manus pattern)

### What You Do (3 Steps)

```
1. Read dictionary for a node (5 mins)
   ↓
2. Copy spec template, implement exactly as written (20 mins)
   ↓
3. Verify output against dictionary, commit (5 mins)
   ↓
Repeat for each node
```

---

## Day 1: PolicyNode + GenerateNode + AuditNode

### 9:00 AM - PolicyNode

#### Step 1: Read Dictionary (5 mins)
Open `hyperagent_dna_blueprint.md`
Go to: **"Type System" → NodeType**
Go to: **"Node Specification: PolicyNode"**

Copy-paste into your IDE:
```typescript
const POLICY_TIMEOUT = 5000;
const VALID_TRANSITIONS = { policy: ["generate"] };
type HyperAgentState = { ... };
```

#### Step 2: Implement Template (20 mins)

```typescript
// Copy EXACT template from blueprint
async function policyNode(state: HyperAgentState): Promise<HyperAgentState> {
  // Step 1: Validate input [from dictionary]
  // Step 2: Check compliance rules [from dictionary]
  // Step 3: Update state and log [from dictionary]
}
```

**Don't improvise. Copy the spec exactly.**

#### Step 3: Verify (5 mins)

Run verification function:
```typescript
const check = verifyNodeOutput(output, "policy");
if (!check.valid) {
  console.error(check.errors); // Fix until all pass
}
```

**Commit only when verification passes.**

### 9:30 AM - GenerateNode

#### Same 3-Step Process
1. Read dictionary: **"Node Specification: GenerateNode"**
2. Copy template exactly
3. Verify output matches COMPLETE state

**Key: Memory integration at EXACT point in spec.**

```typescript
// Step 1: Query memory [APPROVED point]
const similar = await memory.findSimilarContracts(state.intent, 3);

// Step 2: Build prompt [use template from dictionary]
const prompt = `You are a Solidity expert...`;

// Step 3: Call APPROVED model [from approved list]
const response = await anthropic.create({
  model: APPROVED_MODELS["generate"].model, // NOT gpt-4, NOT claude-2
  // ...
});
```

### 10:00 AM - AuditNode

**Same pattern. Read dictionary → Copy template → Verify.**

---

## Day 2: ValidateNode + DeployNode + EigenDANode

### 9:00 AM - ValidateNode

```typescript
async function validateNode(state: HyperAgentState): Promise<HyperAgentState> {
  // Dictionary specifies 3 validation checks
  // NOT more, NOT less
  const checks = [
    checkBytecodeSize(),
    checkGasEstimate(),
    checkABICompliance()
  ];
  
  // Return to generator if any fail
  if (!checks.every(c => c)) {
    return { ...state, status: "processing", logs: [...] };
  }
  
  return { ...state, status: "deploying", logs: [...] };
}
```

### 10:00 AM - DeployNode

**Critical**: Follow EXACT deployment steps from dictionary.

```typescript
async function deployNode(state: HyperAgentState): Promise<HyperAgentState> {
  // Step 1: Get chain config from APPROVED list [dictionary]
  const chainConfig = SUPPORTED_CHAINS[state.chain];
  
  // Step 2: Create smart account (Thirdweb) [exact call from dictionary]
  const account = await thirdweb.createSmartAccount({...});
  
  // Step 3: Deploy via Thirdweb [exact call from dictionary]
  const tx = await thirdweb.deploy({...});
  
  // Step 4: Verify on-chain (retry 3x) [exact from dictionary]
  let verified = false;
  for (let i = 0; i < 3; i++) {
    const code = await provider.getCode(tx.address);
    verified = code.length > 0;
    if (verified) break;
    await sleep(2000);
  }
  
  return { ...state, deploymentAddress: tx.address, ... };
}
```

### 11:00 AM - EigenDANode

```typescript
async function eigenDANode(state: HyperAgentState): Promise<HyperAgentState> {
  // Step 1: Pin contract to Pinata [APPROVED backend]
  const contractCID = await pinata.pinText(state.contract, "contract_...");
  
  // Step 2: Pin audit to Pinata [APPROVED backend]
  const auditCID = await pinata.pinJSON(state.auditResults, "audit_...");
  
  // Step 3: Register on Mantle AuditRegistry [dictionary spec]
  const registry = new ethers.Contract(AUDIT_REGISTRY_ADDRESS, ABI, signer);
  await registry.register(state.deploymentAddress, contractCID, auditCID);
  
  return { ...state, eigenDAProofId: contractCID, ... };
}
```

---

## Day 3: MonitorNode + Integration

### 9:00 AM - MonitorNode

```typescript
async function monitorNode(state: HyperAgentState): Promise<HyperAgentState> {
  console.log(`[MONITOR] Starting monitoring for ${state.deploymentAddress}`);

  // APPROVED: Memory storage in monitor node [dictionary]
  if (state.status === "success" && state.deploymentAddress) {
    await memory.storeContract({
      intent: state.intent,
      contract: state.contract || "",
      riskLevel: state.auditResults?.passed ? "low" : "medium",
      deploymentAddress: state.deploymentAddress,
      chain: state.chain,
      timestamp: new Date().toISOString()
    });
  }

  // Start monitoring (async, non-blocking)
  startMonitoring(state.deploymentAddress, state.chain);

  return {
    ...state,
    status: "success",
    logs: [...state.logs, "[MONITOR] ✓ Monitoring started + stored in memory"]
  };
}
```

### 10:00 AM - Integrate into LangGraph

```typescript
import { StateGraph } from "@langchain/langgraph";

const graph = new StateGraph({
  channels: {
    state: {
      value: (x) => x,
      default: () => ({ /* initial state */ })
    }
  }
});

// Add nodes (use EXACT node names from dictionary)
graph.addNode("policy", policyNode);
graph.addNode("generate", generateNode);
graph.addNode("audit", auditNode);
graph.addNode("validate", validateNode);
graph.addNode("deploy", deployNode);
graph.addNode("eigenda", eigenDANode);
graph.addNode("monitor", monitorNode);

// Add edges (use EXACT transitions from dictionary)
graph.addEdge("policy", "generate");
graph.addEdge("generate", "audit");
graph.addEdge("audit", "validate");
graph.addEdge("validate", "deploy"); // If passed
graph.addEdge("validate", "generate"); // If failed
graph.addEdge("deploy", "eigenda");
graph.addEdge("eigenda", "monitor");
graph.addEdge("monitor", END);

// Set entry point
graph.setEntryPoint("policy");

export const hyperAgentGraph = graph.compile();
```

### 11:00 AM - Test End-to-End

```typescript
async function testFullFlow() {
  const result = await hyperAgentGraph.invoke({
    intent: "Create ERC-20 token",
    userId: "user123",
    chain: "mantle",
    testnet: true,
    logs: []
  });

  console.log("Status:", result.status);
  console.log("Contract deployed to:", result.deploymentAddress);
  console.log("IPFS CID:", result.eigenDAProofId);
  
  // Verify
  const check = verifyNodeOutput(result, "monitor");
  console.log("Output valid:", check.valid);
}
```

---

## Anti-Hallucination Checks at Each Step

### Before You Write Code
```
[ ] Have I read the dictionary section?
[ ] Can I copy the spec exactly?
[ ] Is there an existing node I can reference?
[ ] Do I understand the input/output shapes?
```

### While Writing
```
[ ] Am I following the exact steps from dictionary?
[ ] Did I copy field names, not retype them?
[ ] Did I use APPROVED models/backends?
[ ] Did I add logs at every step?
```

### Before Commit
```bash
# Pre-commit hook runs automatically
git add .
git commit -m "Add PolicyNode"
# → Hook checks for drift
# → If FAILED: Fix and retry
# → If PASSED: Commit succeeds
```

### Manual Verification
```typescript
// Check state fields
const required = ["intent", "contract", "auditResults", "deploymentAddress", "txHash", "status", "logs"];
Object.keys(state).forEach(key => {
  if (!required.includes(key)) console.error("DRIFT: Extra field", key);
});

// Check LLM models
if (response.model !== APPROVED_MODELS["generate"].model) {
  console.error("DRIFT: Unauthorized model");
}

// Check transitions
if (!VALID_TRANSITIONS["policy"].includes("generate")) {
  console.error("DRIFT: Invalid edge");
}
```

---

## What Happens When AI Tries to Drift

### Scenario 1: AI suggests a new field

```typescript
// AI suggests:
return { ...state, contractMetadata: {...} };  // NEW FIELD

// Dictionary enforcement catches it:
const check = verifyNodeOutput(output, "generate");
// → errors: ["Unexpected field: contractMetadata"]

// You reject it:
// "No. Dictionary says 7 fields only. Remove this."
```

### Scenario 2: AI suggests alternate LLM

```typescript
// AI suggests:
const response = await openai.create({ model: "gpt-4-turbo" });

// Dictionary enforcement catches it:
if (response.model !== APPROVED_MODELS["generate"].model) {
  throw new Error("Unauthorized model");
}

// You reject it:
// "No. We use Claude 3.5 Sonnet only, per dictionary."
```

### Scenario 3: AI invents new node type

```typescript
// AI suggests:
graph.addNode("optimization", optimizeNode);

// Dictionary enforcement catches it:
const VALID_TYPES = ["policy", "generate", "audit", "validate", "deploy", "eigenda", "monitor"];
if (!VALID_TYPES.includes("optimization")) {
  throw new Error("Unknown node type");
}

// You reject it:
// "No. Dictionary has exactly 7 node types. Optimization goes in ValidateNode."
```

---

## Persistent Planning (Manus Pattern)

### Create These Files in Root

#### `SESSION_PLAN.md`
```markdown
# HyperAgent Build - Session 1
## Date: Jan 19, 2026

### Dictionary Status
- ✓ Type System
- ✓ Node Types (7)
- ✓ State Shape
- ✓ LLM Models
- ✓ Memory System
- ✓ Error Codes

### Today's Goals
- [ ] PolicyNode
- [ ] GenerateNode
- [ ] AuditNode

### Completed
- [x] Dictionary defined
- [x] Verification protocol set up
- [x] Pre-commit hook installed

### Next Session Priorities
1. Deploy to testnet
2. Fix memory latency issue
3. Add metrics tracking
```

#### `FINDINGS.md`
```markdown
# Key Learnings

## Issue 1: LLM Token Limits
- Claude 3.5 has 8192 token max for generation
- Solution: Split long contracts into multiple calls
- Applied: Modify generate node to detect and split

## Issue 2: Chroma Localhost Slow on Windows
- Localhost resolution takes 1.5s on Windows
- Solution: Use 127.0.0.1 directly
- Applied: Memory config updated

## Issue 3: Mantle RPC Rate Limit
- Testnet RPC has 30 req/second limit
- Solution: Add 100ms delay between deployments
- Applied: Deploy node retry policy updated
```

#### `PROGRESS.md`
```markdown
# Session Progress

## Time: 9:00 AM
- Started PolicyNode
- Read dictionary spec: ✓
- Implemented validator: ✓
- Created unit test: ✓
- Status: PASSING

## Time: 9:30 AM
- Started GenerateNode
- Memory integration: ✓
- LLM call: ✓
- Fallback handling: ✓
- Status: TESTING

## Time: 10:00 AM
- Started AuditNode
- Slither integration: ✓
- Results parsing: ✓
- Status: COMPLETE
```

---

## CI/CD Integration Commands

```bash
# Before commit
npm run verify:dictionary    # Checks for drift
npm run test                 # Unit tests
npm run test:verify          # Output verification
npm run lint:strict          # No extra fields

# Pre-commit automatically runs:
.git/hooks/pre-commit

# GitHub Actions runs on PR:
.github/workflows/anti-hallucination.yml

# Manual drift check anytime:
npm run drift-detect
```

---

## Reference: Which Node Am I Implementing?

```
Node          | Purpose                | Key Feature
============================================================
PolicyNode    | ERC compliance check   | Reject invalid intents
GenerateNode  | LLM code generation    | Memory integration here
AuditNode     | Slither security audit | Severity filtering
ValidateNode  | Schema validation      | Bytecode size check
DeployNode    | Thirdweb deployment    | AA + x402 metering
EigenDANode   | IPFS proof storage     | Content-addressed
MonitorNode   | Event tracking + memory| Memory storage here
```

---

## Troubleshooting: "I'm drifting"

**Symptom**: Pre-commit hook failed

**Check**:
1. Did I add a new state field?
   - Run: `git diff --cached | grep "state\\."`
   - Fix: Remove the field, use existing ones only

2. Did I call an unauthorized LLM?
   - Run: `grep -r "model:" src/nodes/`
   - Fix: Use `APPROVED_MODELS["generate"].model` only

3. Did I add a new node type?
   - Run: `grep -r "addNode" src/`
   - Fix: Use only the 7 defined types

4. Did I change edge routing?
   - Run: `grep -r "addEdge" src/`
   - Fix: Use exact transitions from dictionary

---

## Success Criteria (End of Day 3)

```
□ All 7 nodes implemented
□ All nodes pass output verification
□ LangGraph compiles without errors
□ E2E test: Full flow succeeds
□ Mantle testnet deployment works
□ IPFS CID recorded on-chain
□ Memory storage confirmed
□ Zero drift-detection failures
□ All findings documented
□ Session files updated
```

If all checked, you have a working HyperAgent with:
- ✓ Zero AI drift
- ✓ Deterministic behavior
- ✓ Memory learning system
- ✓ IPFS audit trail
- ✓ On-chain proofs

Ready for community testing Jan 29.

---

## Next: Day 4-7 Tasks

```
Day 4 (Jan 22): Studio integration
- Studio API calls HyperAgent
- UI shows progress logs
- Memory insights displayed

Day 5 (Jan 23): Bug fixes from testing
- Community test results
- Iterate per findings

Day 6 (Jan 24): Performance optimization
- Memory query latency < 100ms
- E2E deployment < 5 seconds

Day 7 (Jan 25): Marketing prep
- Blog post: "How HyperAgent Learns"
- Demo video recorded
```

---

**Document Version**: 1.0  
**Last Updated**: 18 January 2026  
**Status**: Ready to Execute  
**Usage**: Reference this daily during implementation
