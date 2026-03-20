# [3/8] Integration consolidation — one path for Tenderly, IPFS, Supabase, Redis

## 🎯 Layer 1: Intent Parsing

**Task Title:** packages, services: consolidate Tenderly, IPFS, shared middleware; remove agent-runtime duplicates

**Primary Goal:** Single production path for Tenderly (packages/ai-tools), IPFS (storage service), deploy-plan, Supabase, Redis. Remove agent-runtime duplicate endpoints.

**User Story / Context:** As a maintainer, I want one integration path per external service so that there is no duplication and health checks are meaningful.

**Business Impact:** Reduces maintenance; enables fail-closed production behavior.

**Task Metadata:**
- **Sprint**: Sprint 3
- **Milestone**: Phase 1 – Sprint 3 (Mar 3–16)
- **Related Epic/Project**: GitHub Project 9
- **Issue Type**: Feature
- **Area**: orchestration
- **Chain**: N/A
- **Preset**: N/A
- **Labels**: area:orchestration, type:feature

**Project Board (Required):** GitHub Project 9

---

## 📚 Layer 2: Knowledge Retrieval

**Required Skills / Knowledge:**
- [ ] TypeScript (packages), Python (orchestrator), service boundaries

**Estimated Effort:** M (3-5 days)

**Code Examples & Patterns:**

Current duplication (agent-runtime exposes same as simulation/deploy/storage):

```typescript
// services/agent-runtime/src/index.ts - REMOVE these routes
app.post("/simulate", ...);      // Duplicate of simulation service
app.post("/deploy", ...);        // Duplicate of deploy service
app.post("/pin", ...);           // Duplicate of storage service
app.post("/ipfs/pin", ...);
```

Target: single path per service:

```typescript
// packages/ai-tools/tenderly-toolkit.ts - ONLY Tenderly entry point
export async function runSimulation(...): Promise<SimulationResult> { ... }
```

```python
# Orchestrator: fetch from simulation, storage (not agent-runtime)
r = await client.get(f"{SIMULATION_SERVICE_URL}/health")  # tenderly_configured
r = await client.get(f"{STORAGE_SERVICE_URL}/health")     # pinata_configured
```

---

## ⚠️ Layer 3: Constraint Analysis

**Known Dependencies:** [2/8] recommended

**Technical Constraints:** Agent-runtime must retain only /agents/* and /health

---

## 💡 Layer 4: Solution Generation

**Solution Approach:**
- Refactor Tenderly to packages/ai-tools/tenderly-toolkit.ts only
- Storage service = only IPFS/Pinata entry point
- packages/backend-clients: createSupabaseServiceClient(), createRedisClient()
- Remove /simulate, /deploy, /pin, /ipfs/* from agent-runtime

**Acceptance Criteria:**
- [ ] Global search: one Tenderly path, one IPFS path, one deploy-plan path
- [ ] Simulation/storage health return tenderly_configured, pinata_configured

---

## 📋 Layer 5: Execution Planning

**Implementation Steps:**
1. [ ] Consolidate Tenderly in packages/ai-tools
2. [ ] Remove direct Pinata from agent-runtime
3. [ ] Create packages/backend-clients
4. [ ] Wire shared middleware; remove agent-runtime duplicates

**Required Env:** SIMULATION_SERVICE_URL, DEPLOY_SERVICE_URL, STORAGE_SERVICE_URL

---

## ✅ Layer 6: Output Formatting & Validation

**Ownership & Collaboration:** **Owner**: @JustineDevs | **Reviewer**: TBD | **Deadline**: TBD

**Delivery Status:** To Do. Implement in `feature/justinedevs` before PR to `development`.
