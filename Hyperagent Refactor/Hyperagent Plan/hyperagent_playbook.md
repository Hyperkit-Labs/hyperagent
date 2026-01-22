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
