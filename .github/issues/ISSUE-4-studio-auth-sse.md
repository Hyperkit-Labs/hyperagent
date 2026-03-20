# [4/8] Studio auth, AI UI, and SSE-first UX

## 🎯 Layer 1: Intent Parsing

**Task Title:** apps/studio: SessionProvider, bootstrap failure fatal, SSE-first workflow updates

**Primary Goal:** SessionProvider as single session authority; no ghost state; SSE primary over polling; api.ts split by domain; real AI SDK/Elements usage.

**User Story / Context:** As a user, I want session truth to be authoritative and workflow progress to stream in real time so that I never see "connected but no session" or polling-heavy UX.

**Business Impact:** Eliminates ghost state; improves UX; aligns with audit recommendations.

**Task Metadata:**
- **Sprint**: Sprint 3
- **Milestone**: Phase 1 – Sprint 3 (Mar 3–16)
- **Related Epic/Project**: GitHub Project 9
- **Issue Type**: Feature
- **Area**: frontend
- **Chain**: N/A
- **Preset**: N/A
- **Labels**: area:frontend, type:feature, enhancement

**Project Board (Required):** GitHub Project 9

---

## 📚 Layer 2: Knowledge Retrieval

**Required Skills / Knowledge:**
- [ ] React, Next.js, SSE, AI SDK

**Estimated Effort:** M (3-5 days)

**Code Examples & Patterns:**

Current ghost-state risk in `useAutoBootstrap.ts`:

```typescript
// apps/studio/hooks/useAutoBootstrap.ts - FIX: bootstrap failure must be fatal
// When bootstrap fails (503), wallet stays connected but no session
// User sees app UI until first API 401
```

Target SessionProvider pattern:

```typescript
// apps/studio/components/providers/SessionProvider.tsx
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  // Single source of truth; bootstrap failure = redirect to /login, block protected routes
  ...
}
```

Current polling-heavy pattern (replace with SSE-first):

```typescript
// apps/studio - useWorkflow* hooks
// Current: poll every 2s
// Target: SSE primary; polling only when stream disconnected
const eventSource = new EventSource(`/api/streaming/workflows/${id}`);
eventSource.onmessage = (e) => setState(JSON.parse(e.data));
```

---

## ⚠️ Layer 3: Constraint Analysis

**Known Dependencies:** [3/8] recommended

**Technical Constraints:** Protected routes must redirect correctly; 401 handling per production matrix

---

## 💡 Layer 4: Solution Generation

**Solution Approach:**
- SessionProvider single source of truth
- useAutoBootstrap: bootstrap failure = fatal, redirect to /login
- Middleware: expiry-aware or server-validated session
- SSE primary; polling fallback only when stream disconnected
- Split lib/api.ts into core, workflows, billing, settings, deployments
- Implement AI SDK/Elements for conversation, artifacts, terminal, step plans

**Acceptance Criteria:**
- [ ] No ghost state on bootstrap failure
- [ ] Protected routes redirect without session
- [ ] Workflow progress primarily stream-driven
- [ ] No fake arrays/histories; unfinished surfaces labeled

---

## 📋 Layer 5: Execution Planning

**Implementation Steps:**
1. [ ] Centralize session in SessionProvider
2. [ ] Make bootstrap failure fatal in useAutoBootstrap
3. [ ] Upgrade middleware
4. [ ] SSE-first in useWorkflow* hooks
5. [ ] Split api.ts; wire AI SDK/Elements

**Required Env:** AUTH_JWT_SECRET, SUPABASE_URL

---

## ✅ Layer 6: Output Formatting & Validation

**Ownership & Collaboration:** **Owner**: @JustineDevs | **Reviewer**: TBD | **Deadline**: TBD

**Delivery Status:** To Do. Implement in `feature/justinedevs` before PR to `development`.
