# [7/8] Provenance and advanced security

## 🎯 Layer 1: Intent Parsing

**Task Title:** services: provenance and advanced security — EigenDA, ERC-8004, Echidna, exploit-sim policy

**Primary Goal:** Real EigenDA anchoring; ERC-8004 registration (if in scope); Echidna fuzzing integrated; exploit simulation policy truthful.

**User Story / Context:** As a user, I want provenance and security tooling to be real, not stubbed, so that I can trust the pipeline outputs.

**Business Impact:** Completes promised provenance/security scope per audit.

**Task Metadata:**
- **Sprint**: Sprint 3
- **Milestone**: Phase 1 – Sprint 3 (Mar 3–16)
- **Related Epic/Project**: GitHub Project 9
- **Issue Type**: Feature
- **Area**: security
- **Chain**: N/A
- **Preset**: N/A
- **Labels**: area:security, type:feature

**Project Board (Required):** GitHub Project 9

---

## 📚 Layer 2: Knowledge Retrieval

**Required Skills / Knowledge:**
- [ ] EigenDA, ERC-8004, Echidna, exploit simulation

**Estimated Effort:** L (1+ weeks)

**Code Examples & Patterns:**

EigenDA stubbed (registries return ipfs/none only):

```python
# services/orchestrator/registries.py
def get_da_backend() -> str:
    # Returns "ipfs" or "none"; EigenDA has zero implementation
    # run_steps.da_cert, reference_block always NULL
```

ERC-8004 registry exists, no on-chain:

```yaml
# infra/registries/erc8004/erc8004.yaml - registry entries exist
# No on-chain registration flow
```

Echidna stub in audit:

```python
# services/audit/main.py - Echidna "run separately" stub
# Target: integrated execution + result ingestion
```

Exploit-sim policy (must be truthful):

```python
# services/orchestrator/security/evaluator.py
# Unsupported contract types: show partial coverage honestly
# Required types: fail closed
```

---

## ⚠️ Layer 3: Constraint Analysis

**Known Dependencies:** [6/8] recommended

**Technical Constraints:** Unsupported contract types show partial coverage honestly; required types fail closed

---

## 💡 Layer 4: Solution Generation

**Solution Approach:**
- EigenDA: populate da_cert, reference_block; registries return eigen da when configured
- ERC-8004: on-chain registration if in product scope
- Echidna: integrated execution + result ingestion
- Exploit-sim: fail-closed + real coverage for supported/unsupported types

**Acceptance Criteria:**
- [ ] EigenDA da_cert/reference_block populated when configured
- [ ] ERC-8004 flow if in scope
- [ ] Echidna fuzzing results ingested
- [ ] Exploit-sim truthful for all contract types

---

## 📋 Layer 5: Execution Planning

**Implementation Steps:**
1. [ ] Implement EigenDA anchoring
2. [ ] ERC-8004 registration (if scope)
3. [ ] Echidna integration
4. [ ] Exploit-sim policy truthfulness

**Required Env:** EIGENDA_*, ERC-8004 registry, Echidna binary

---

## ✅ Layer 6: Output Formatting & Validation

**Ownership & Collaboration:** **Owner**: @JustineDevs | **Reviewer**: TBD | **Deadline**: TBD

**Delivery Status:** To Do. Implement in `feature/justinedevs` before PR to `development`.
