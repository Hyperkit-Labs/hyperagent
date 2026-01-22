# HyperAgent MVP Sprint Board (P0)

**Sprint Goal:** Launch "Anti-Hallucination" CLI v1.0 with Mantle x402 integration by Jan 31, 2026.

---

## 📋 Backlog (Not Started)

### [P1] Documentation & User Guides
**Owner:** Tristan  
**Estimated Effort:** 5 Points  
**Description:** Create `README.md`, `CONTRIBUTING.md`, and a "Getting Started" guide for the CLI.  
**Acceptance Criteria:**
- [ ] Integration guide for Mantle users.
- [ ] Explainer for "Anti-Hallucination" architecture.

---

## 📝 To Do (Ready for Dev)

*(Empty - All P0s Processed)*

---

## 🚧 In Progress

*(Testing & Refinement)*

---

## ✅ Done

### [P0] Repo Setup & Tech Stack Lock
**Owner:** Aaron  
**Estimated Effort:** 2 Points  
**Description:** Initialize the monorepo, configure TypeScript, ESLint, Prettier, and install core dependencies (`commander`, `ink`, `viem`, `langgraph`).  
**Acceptance Criteria:**
- [x] `npm install` runs without errors.
- [x] Project structure matches `planning/5-Technical-Execution-Workflow.md`.
- [x] CI/CD pipeline (GitHub Actions) passes simple build.

### [P0] Define Core "Dictionary" Types
**Owner:** Justine  
**Estimated Effort:** 3 Points  
**Description:** Implement the `HyperAgentState`, `NodeType`, and `EdgeConnection` types. This is the "Specification Lock" layer.  
**Acceptance Criteria:**
- [x] Types defined in `src/types/agent.ts`.
- [x] Validation function `verifyNodeOutput()` implemented.
- [x] `VALID_TRANSITIONS` graph constant defined.

### [P0] CLI Core Scaffold (`hyperagent init`)
**Owner:** Aaron  
**Estimated Effort:** 5 Points  
**Description:** Build the CLI entry point using Commander.js. Implement the `init` command to scaffold a user's local workspace.  
**Acceptance Criteria:**
- [x] `hyperagent init` creates `hyperagent.config.json`.
- [x] CLI parses arguments correctly.
- [x] ASCII Art banner implemented (Aesthetics!).

### [P0] Implement "Policy" & "Generate" Nodes
**Owner:** Justine  
**Estimated Effort:** 8 Points  
**Description:** Build the first two nodes of the graph. Policy Node converts user prompt to "Intent". Generate Node uses LLM (Anthropic) to write Solidity.  
**Acceptance Criteria:**
- [x] Policy Node extracts intent accurately.
- [x] Generate Node produces compiling Solidity code.
- [x] "Anti-Hallucination" checks applied to output.

### [P0] x402 Native Payment Hooks
**Owner:** Justine  
**Estimated Effort:** 5 Points  
**Description:** Implement the billing logic. Before "Generate" or "Audit" nodes run, check user's USDC balance on Mantle.  
**Acceptance Criteria:**
- [x] `checkBalance()` function works.
- [x] `debitUser()` checks allowance and executes transfer.
- [x] CLI prompts user if balance is low (402 Payment Required).

### [P0] Validation Layer (Slither + Semantic)
**Owner:** Aaron  
**Estimated Effort:** 5 Point  
**Description:** Implement the `AuditNode` running Slither (via Docker or local binary) and semantic checks.  
**Acceptance Criteria:**
- [x] Slither runs on generated contracts.
- [x] JSON report parsed and returned in `HyperAgentState`.
- [x] Critical vulnerabilities block transition to "Deploy".

### [P0] Chain Adapters (Wallet Wrapper)
**Owner:** Aaron  
**Estimated Effort:** 5 Points  
**Description:** Wrap `viem`/`wagmi` to handle deployment to Mantle/Avalanche. **Do not build custom providers.**  
**Acceptance Criteria:**
- [x] `DeployNode` can deploy a standard ERC-20 to Mantle Testnet.
- [x] Private key loaded securely from `.env`.
- [x] Returns `deploymentAddress` and `txHash`.

### [P0] Implementation of EigenDA Proof Node
**Owner:** Justine  
**Estimated Effort:** 3 Points  
**Description:** Implement the `EigenDA` node in the graph to store verifyable proofs of the agent's actions (Source of Truth).  
**Acceptance Criteria:**
- [x] Node receives `DeployResult`.
- [x] Post data to EigenDA (or mocked stub for testnet).
- [x] Returns `CID`/`ProofHash` to state.

