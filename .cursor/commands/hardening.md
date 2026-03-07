# /hardening

## Command (copy and use)

```
Run the full production hardening pre-action. Execute the mandatory pre-action chain (rules, AGENTS.mdc, sprint if applicable), then run all hardening steps (Review, QA, Audit, Code Maturity, OWASP, UX Audit, Frontend/Design, Onboarding). Build the Hardening Findings Log and immediately fix all findings in priority order without stopping until Critical and High are resolved. Apply .cursor/commands/hardening.md.
```

## Production Hardening Pre-Action (Non-Negotiable)

This command defines a **mandatory pre-action** to harden, polish, and elevate the entire HyperAgent project to production level. It is **non-negotiable** before treating the codebase as production-ready. The agent must execute the full procedure and **immediately fix all findings** without interruption until the prioritized action list is resolved.

---

## 1. Scope and Purpose

- **Goal**: Bring the whole project (frontend, backend, infra, UX, security, code quality) to solid, high-quality, production-level state.
- **Trigger**: Use when preparing for release, before marking a milestone production-ready, or when explicitly requested via `/hardening`.
- **Enforcement**: All steps below are mandatory. No step may be skipped. Findings must be fixed in priority order; do not pause after reporting.

---

## 2. Mandatory Pre-Action Chain

Before any hardening run, the agent MUST complete these in order:

1. **`.cursor/rules/`**  
   Review rule files relevant to the task: `AGENT.mdc`, `AGENTS.mdc`, `production.mdc`, `rules.mdc`, `sprint-commitments.mdc`. Ensure actions align with project standards and MVP boundaries.

2. **`.cursor/wiki/`**  
   Read wiki docs (e.g. `robots.txt`, scope boundaries). Respect crawler and scope constraints.

3. **`.cursor/commands/rules.md`**  
   Execute the mandatory pre-action defined there: rules → wiki → skills → llm → then proceed. This is the same sequence as `MANDATORY_PRE_ACTION.mdc` and must run first.

4. **`.cursor/rules/AGENTS.mdc`**  
   Apply the full Agent Resource Requirements: check rules, wiki, skills, llm; apply resources before action; respect MVP boundary, Studio vs backend, BYOK, storage policy, toolkits over ad-hoc calls.

5. **`.cursor/commands/sprint.md`**  
   If the hardening run involves sprint or checklist items, treat all user-vetted items as commitments. Do not reclassify them as optional. Apply Preservation rule, Scope boundary, Capacity warning, No deletions from `.cursor/rules/sprint-commitments.mdc`.

---

## 3. Hardening Procedure (Ordered Steps)

Execute the following steps in sequence. Each step produces findings; collect all findings into a single **Hardening Findings Log** with severity and component. Do **not** stop after a step to ask for permission; proceed through all steps, then execute the **Fix Phase** (Section 5).

### Step 1: Full Application Review

- **Command**: Apply `.cursor/commands/review.md`.
- **Action**: Analyze the entire project and application. Read and understand the root and key flows. Answer: Is the application aligned with the desired user journey? What is fully built, stubbed, duplicated, or missing?
- **Skills**: Use code clarity and simplification; preserve functionality; apply project standards from CLAUDE.md.
- **Output**: Add to Hardening Findings Log: list of issues (duplication, inconsistency, missing pieces, alignment gaps) with severity (critical / high / medium / low).

### Step 2: System QA Review

- **Command**: Apply `.cursor/commands/QA.md`.
- **Action**: Produce the full QA report (Architecture and boundaries; Data and state; Auth, BYOK, secrets; Agent pipeline; SDK integrations; Frontend/Studio; Testing and observability; Duplication, stubs, truncation; Long-term evolution; Prioritized action list).
- **Skills**: Use system boundaries, data ownership, and toolkit usage expectations from project docs.
- **Output**: Merge the QA report’s prioritized action list into the Hardening Findings Log with severity and scope (files, services, packages).

### Step 3: Full System Audit

- **Command**: Apply `.cursor/commands/audit.md`.
- **Action**: Audit frontend, backend, and infra as a wired, running system. Evaluate safety, resilience, and production capability. Cover: Frontend ↔ Backend wiring and UX safety; Auth and BYOK and multi-tenant isolation; Workflow correctness and reproducibility; Service contracts and error handling; ROMA and safety; Security tools, simulation, deploy safety; Data, memory, RAG, storage; Observability, rate limiting, resilience; Alignment with intended architecture.
- **Output**: Add the audit table (component, severity, description, recommended change) and top 5 prioritized changes to the Hardening Findings Log.

### Step 4: Code Maturity Assessment

- **Skill**: `.cursor/skills/code-maturity-assessor` (Trail of Bits 9-category framework).
- **Action**: Assess all 9 categories with evidence (file:line references): Arithmetic; Auditing; Authentication/Access controls; Complexity management; Decentralization; Documentation; Transaction ordering (MEV) risks; Low-level manipulation; Testing and verification. Produce maturity scorecard and improvement roadmap.
- **Output**: Add all gaps and priority-ordered recommendations (CRITICAL / HIGH / MEDIUM) to the Hardening Findings Log. Do not skip categories; do not rate without evidence.

### Step 5: Security (OWASP Top 10)

- **Skill**: `.cursor/skills/owasp-top-10`.
- **Action**: For the application’s attack surface, assess OWASP Top 10 (A01–A10). Load reference files as needed. Analyze code for broken access control, cryptographic failures, injection, insecure design, misconfiguration, vulnerable components, auth failures, integrity failures, logging/monitoring, SSRF.
- **Output**: Add every finding (vulnerability, location, severity, remediation) to the Hardening Findings Log.

### Step 6: UX Audit and Rethink

- **Skill**: `.cursor/skills/ux-audit-rethink` (IxDF 7 factors, 5 usability characteristics, 5 interaction dimensions).
- **Action**: Run the full UX audit procedure: 7 UX factors, 5 usability characteristics, 5 interaction dimensions. Produce issue list with priority (P0–P3) and redesign proposals where relevant.
- **Output**: Add UX issues (findability, error tolerance, accessibility, usability, engagement, etc.) to the Hardening Findings Log with severity and recommended change.

### Step 7: Frontend and Design Quality

- **Skills**:  
  - `.cursor/skills/design-taste-frontend`: Metric-based UI rules, component architecture, typography, color, layout, motion, anti–AI-slop patterns, pre-flight check.  
  - `.cursor/skills/design-with-taste`: Simplicity (gradual revelation), Fluidity (transitions), Delight (selective emphasis); Taste Checklist; anti-patterns.
- **Action**: Evaluate Studio and all user-facing UI against these skills. Check: one primary action per view, progressive disclosure, transitions and motion, empty/loading/error states, typography and palette, no forbidden patterns (e.g. Inter, purple glows, generic cards), accessibility and responsiveness.
- **Output**: Add design/UX/frontend findings to the Hardening Findings Log with severity and file/component references.

### Step 8: Onboarding and First-Run Experience

- **Skill**: `.cursor/skills/onboarding-cro`.
- **Action**: Assess post-signup onboarding, activation definition, time-to-value, empty states, first-run flow, and any onboarding checklist or guided flows. Identify drop-off points and improvement opportunities.
- **Output**: Add onboarding/activation findings to the Hardening Findings Log (e.g. empty states, first action clarity, progress indication).

### Step 9: Optional Learning Path (No Blocking)

- **Skill**: `.cursor/skills/learning-path-builder`.
- **Note**: This skill is for **user-interactive sessions** (onboarding to new technologies, hackathon skill-building). It is **not** part of the mandatory fix sequence. If the team needs structured learning for specific remediations (e.g. OWASP, new SDKs), the agent may propose a learning path in a separate "AI Recommended Additions" section after the Fix Phase, without blocking hardening completion.

---

## 4. Hardening Findings Log Format

Maintain a single structured log. Each entry MUST include:

- **Id**: Short unique id (e.g. H-001).
- **Source**: Step name (Review, QA, Audit, Code Maturity, OWASP, UX Audit, Frontend/Design, Onboarding).
- **Component**: Frontend, gateway, orchestrator, agent-runtime, compile, audit, simulation, deploy, storage, ROMA, Supabase, Redis, VectorDB, Studio, etc.
- **Severity**: Critical | High | Medium | Low | Info.
- **Description**: What is wrong or missing.
- **Recommendation**: Concrete, implementable change.
- **Scope**: Files, services, or packages to modify.
- **Effort**: S / M / L (optional but recommended).

Sort the log by severity (Critical first), then by source order (Review → QA → Audit → …), then by component. Deduplicate: if the same issue appears from multiple steps, keep one entry and note the sources.

---

## 5. Fix Phase: Immediate Correction Without Interruption

- **Rule**: The agent must **fix all findings** in the Hardening Findings Log according to the procedural approach below. Do **not** stop after producing the log to wait for user approval. Proceed to implement fixes in priority order until the list is resolved or no further fixes can be applied without new input.

### 5.1 Fix Order

1. **Critical**: All Critical severity items first. Complete every Critical fix before moving to High.
2. **High**: All High severity items next.
3. **Medium**: Then Medium. If capacity is limited, document remaining Medium/Low in a short "Deferred" list with clear owners or follow-up steps.
4. **Low / Info**: Address if time permits; otherwise add to Deferred with rationale.

### 5.2 Procedural Approach for Each Fix

1. **Select** the next finding from the sorted log (by severity then order).
2. **Locate** the exact scope (files, lines, components) from the finding.
3. **Implement** the recommended change (or a minimal variant that satisfies the recommendation). Prefer existing toolkits and patterns from `.cursor/rules/` and `.cursor/skills/`; do not introduce new patterns or scope creep.
4. **Verify**:
   - Code compiles/builds.
   - Existing tests still pass; add or adjust tests if the finding explicitly required it.
   - No new critical or high issues introduced (e.g. no new OWASP or maturity regressions).
5. **Mark** the finding as Fixed in the log and note the commit or change set (e.g. file list).
6. **Repeat** until all Critical and High (and as many Medium as feasible) are fixed.

### 5.3 Constraints During Fix Phase

- **No scope creep**: Address only what the finding recommends. Do not refactor unrelated code unless it is part of the same finding.
- **No interruptions**: Do not pause after individual fixes to ask whether to continue. Continue until Critical and High are done, then Medium as far as possible.
- **Preserve behavior**: Fixes must preserve existing correct behavior unless the finding explicitly requires a behavior change (e.g. security fix).
- **Sprint commitments**: If a finding touches `docs/today` or sprint items, treat user-vetted items as mandatory per `.cursor/commands/sprint.md` and `sprint-commitments.mdc`; do not drop or reclassify them as optional.
- **Project standards**: All code changes must comply with `.cursor/rules/rules.mdc`, `production.mdc`, and `AGENTS.mdc` (BYOK, storage policy, toolkits, MVP boundary).

### 5.4 Output After Fix Phase

- **Summary**: Count of findings by severity and how many were fixed (Critical, High, Medium, Low/Info).
- **Remaining**: List of any Deferred items with scope and suggested owner or follow-up.
- **Hardening Findings Log**: Final log with status (Fixed / Deferred / Skipped with reason) for each entry.

---

## 6. Summary: Pre-Action and Execution Order

| Order | Item | Mandatory |
|------|------|------------|
| 1 | `.cursor/commands/rules.md` (rules → wiki → skills → llm) | Yes |
| 2 | `.cursor/rules/AGENTS.mdc` (resource check, MVP, BYOK, toolkits) | Yes |
| 3 | `.cursor/commands/sprint.md` (if sprint/checklist involved) | When applicable |
| 4 | Step 1: Review (`.cursor/commands/review.md`) | Yes |
| 5 | Step 2: QA (`.cursor/commands/QA.md`) | Yes |
| 6 | Step 3: Audit (`.cursor/commands/audit.md`) | Yes |
| 7 | Step 4: Code Maturity (code-maturity-assessor) | Yes |
| 8 | Step 5: OWASP (owasp-top-10) | Yes |
| 9 | Step 6: UX Audit (ux-audit-rethink) | Yes |
| 10 | Step 7: Frontend/Design (design-taste-frontend, design-with-taste) | Yes |
| 11 | Step 8: Onboarding (onboarding-cro) | Yes |
| 12 | Build Hardening Findings Log (dedupe, sort by severity) | Yes |
| 13 | Fix Phase: fix all findings in order without interruption | Yes |
| 14 | Deferred list and final log with status | Yes |

---

## 7. References

- **Commands**: `.cursor/commands/review.md`, `.cursor/commands/QA.md`, `.cursor/commands/audit.md`, `.cursor/commands/rules.md`, `.cursor/commands/sprint.md`
- **Rules**: `.cursor/rules/AGENTS.mdc`, `.cursor/rules/sprint-commitments.mdc`, `.cursor/rules/MANDATORY_PRE_ACTION.mdc`
- **Skills**:  
  - `.cursor/skills/design-taste-frontend`  
  - `.cursor/skills/design-with-taste`  
  - `.cursor/skills/code-maturity-assessor`  
  - `.cursor/skills/ux-audit-rethink`  
  - `.cursor/skills/onboarding-cro`  
  - `.cursor/skills/owasp-top-10`  
  - `.cursor/skills/learning-path-builder` (optional, post-hardening)
