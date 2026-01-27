<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Answer this all

Template \& safety policy
Which exact contract/back‑end/front‑end templates are allowed?
How do you lock “do not touch” regions vs. editable regions?
What is the versioning policy for those templates?
Evaluation \& gates
What tests and static checks must pass before Studio says “this is production‑ready”?
When do you force human review (e.g. high‑risk flows, large TVL)?
Memory \& versioning
How does HyperAgent remember previous generations for the same project?
How does it diff and patch existing repos without breaking user edits?
Secrets, auth, and deployment
Exact pattern for handling env vars and secrets (never stored in Hyperkit).
Preferred deployment flows (Vercel, Docker, etc.) and how much HyperAgent automates vs. leaves to the user.
Multi‑chain abstraction
Standard config shape for chains (EVM L2 vs SKALE vs others).
How HyperAgent chooses defaults (e.g. SKALE for gasless, Mantle/Base for other cases).
UX of the Studio
How users guide/refine generations (chat loops, “edit this page only”, “regenerate backend but keep DB schema”).
How you show “risk and status” (green/yellow/red) for each area: contracts, backend, frontend.

Here’s a concrete baseline you can adopt for Hyperkit Studio + HyperAgent.

***

## Template \& safety policy

**Which templates are allowed**

- **Contracts**
    - Only from **pinned, audited sources**: OpenZeppelin, battle‑tested thirdweb examples, and your own ERC‑1066‑x402 contracts once audited.
    - No “from scratch” contract generation for core primitives (tokens, DEX, vaults). HyperAgent can only customize **parameters + extension hooks**, not core logic.
- **Backend**
    - Only standard stacks: Next.js API routes or Node/NestJS with Express; ORMs like Prisma/Drizzle; Postgres/Supabase.
    - x402 integration must use official Coinbase or thirdweb x402 SDKs; no custom crypto primitives.[^1][^2]
- **Frontend**
    - Next.js + React + TypeScript + Tailwind + shadcn/ui components only; no arbitrary UI frameworks.[^3][^4][^5]
    - Patterns follow “AI‑ready frontend” principles: clear separation of layout, components, hooks, and data fetching so agents don’t cross boundaries.[^4][^5][^3]

**Locking “do not touch” vs editable regions**

- Use **code fences + comments** to mark regions:

```solidity
// === AUTO-GENERATED CORE (DO NOT EDIT) ===
// ...
// === /AUTO-GENERATED CORE ===

// === EXTENSION HOOK: SAFE TO EDIT ===
// custom logic here
// === /EXTENSION HOOK ===
```

- HyperAgent is only allowed to modify code between **extension hook markers**; anything in a “DO NOT EDIT” region is read‑only for agents.
- For frontend/backend, enforce the same with **markers + file roles** (e.g. `*.core.ts` immutable, `*.ext.ts` editable).

**Template versioning policy**

- Every template (contract, route, page) lives in a **registry** with:
    - Semantic version: `dex@1.2.0`, `wallet-aa@0.5.1`.
    - Source + changelog; links to upstream (OpenZeppelin/thirdweb/etc.).
- HyperAgent must:
    - Default to **latest stable** template versions.
    - Write used versions into project metadata (e.g. `hyperkit.json`) so future regenerations know exactly what was used.
- Breaking template updates require a **migration script** or a manual “upgrade templates” action, never silent changes.

***

## Evaluation \& gates

**What must pass before “production‑ready”**

At minimum, your “green” gate should require:

- **Build + type checks**: `tsc --noEmit`, Next.js build, linting.
- **Unit tests**:
    - Contracts: Foundry/Hardhat tests for core invariants.
    - Backend: Jest tests for auth/x402 flows.
- **Static analysis**:
    - Contracts: Slither/Mythril with no high‑severity issues.
- **Quality gate**: CI rule “all required checks must pass before marking as production‑ready,” like standard quality gates in modern pipelines.[^6][^7][^8]

Hyperkit Studio should show **status per layer**: Contracts/Backend/Frontend each “pass/fail/warn” with logs.

**When to force human review**

- Always require explicit **human review** before marking as production‑ready when:
    - TVL or notional volume > configured threshold (e.g. \$10k).
    - Contracts deviate from baseline templates (custom math, advanced strategies).
    - External integrations involve custody, leverage, or complex financial logic.
- UI should flip layer status to **“Needs Review” (yellow/red)** in these cases, regardless of automated test results.

***

## Memory \& versioning

**Remembering previous generations**

- Each project has a **`hyperkit.json`** (or similar) at repo root:

```json
{
  "projectId": "cuid-123",
  "templates": {
    "dex": "1.2.0",
    "aa-wallet": "0.4.1"
  },
  "chains": ["mantle", "skale"],
  "lastPlan": "plan-uuid",
  "agents": {
    "contract": "v0.3.0",
    "backend": "v0.2.5",
    "frontend": "v0.4.0"
  }
}
```

- HyperAgent stores **plans and diffs** in its own memory store keyed by `projectId` (not full code), so it can reconstruct what it already touched without re‑reading everything from scratch.

**Diffing \& patching without breaking user edits**

- Treat user repo as **source of truth**; HyperAgent only proposes patches.
- Use a 3‑way merge strategy:
    - Base = last generated version;
    - Local = user‑edited;
    - New = HyperAgent suggestion.
- HyperAgent operates at **file + region granularity**:
    - Only touches known, marked extension regions.
    - When conflicts appear, it surfaces a “patch preview” to the user, who must accept/reject per hunk.

***

## Secrets, auth, and deployment

**Env vars and secrets (never stored in Hyperkit)**

- Follow 12‑factor config: **everything sensitive is an env var**, not committed config or stored in Studio.[^9][^10][^11]
- Generate `.env.local.example` and `.env.production.example` with **placeholders**, e.g.:

```env
DATABASE_URL=postgres://...
ALCHEMY_API_KEY=your-key-here
X402_API_KEY=your-key-here
NEXTAUTH_SECRET=your-secret-here
```

- HyperAgent:
    - Never asks users to paste real secrets into Studio UI.
    - Only outputs key names; values are provided directly in Vercel/Render/Docker env settings by the user.

**Deployment flows \& automation level**

- Preferred defaults:
    - **Frontend + API**: Vercel (Next.js native) or similar PaaS.
    - **DB**: Supabase/RDS/Neon (user’s choice).
    - **Contracts**: Foundry/Hardhat scripts + chain RPCs.
- Automation:
    - HyperAgent can:
        - Generate deploy scripts (`npm run deploy:mantle`, `deploy:skale`).
        - Generate Vercel config + GitHub Actions / CI skeleton.
    - HyperAgent **does not**:
        - Automatically deploy to user’s production env.
        - Store API keys.
- Deployment remains a **user‑triggered action** with clear docs (`DEPLOYMENT.md`).

***

## Multi‑chain abstraction

**Standard config shape**

- Normalize all chains into a single TS shape, e.g.:

```typescript
type ChainConfig = {
  id: number;
  name: string;
  kind: 'evm-l1' | 'evm-l2' | 'evm-skale' | 'solana' | 'sui';
  rpcUrlEnv: string;
  explorerUrl: string;
  nativeToken: string;
  gasModel: 'native' | 'gasless' | 'aa-sponsored';
  x402?: {
    settlementChain: string;
    stablecoinSymbol: string;
  };
  aa?: {
    entryPoint?: string;
    paymasterEnv?: string;
  };
};
```

- Store all chain configs in one place (`chains.ts`), used by contracts, backend, and frontend.[^3][^4]

**How HyperAgent chooses defaults**

- Rules of thumb:
    - For **gasless UX**: default to SKALE (or other gasless env) for x402‑heavy, high‑frequency workloads.[^12][^13][^14]
    - For **EVM L2 defaults**: Mantle/Base/Arbitrum depending on user’s ecosystem preference and grants.
- PlannerAgent logic:
    - If user says “gasless” → choose SKALE or networks where you have paymaster sponsorship.
    - If user says “cheap L2” → pick Mantle/Base and set `gasModel: 'aa-sponsored'` only if paymaster config exists; otherwise `'native'`.
- All choices are visible in a **“Networks” panel** in Studio, where users can override defaults.

***

## UX of the Studio

**Guiding/refining generations**

- **Project sidebar** with sections: *Contracts*, *Backend*, *Frontend*, *Config*, *Tests*.
- Each section offers:
    - “Regenerate this layer only” (e.g. *Regenerate frontend, keep DB \& contracts*).
    - “Edit with AI” for a single file or region (“change the Swap page layout only”).
- **Chat‑driven refinement**:
    - Users can say: “Change fees to 0.25% on SKALE only” → PlannerAgent updates plan → ContractAgent patches only fee logic in allowed regions.
    - Commands like:
        - “Regenerate API `/api/quote` but keep Prisma schema.”
        - “Add a dark mode toggle to the layout only.”

**Showing risk \& status (green/yellow/red)**

Per layer:

- **Green**
    - All required tests + checks pass.
    - Only approved templates used; no high‑risk patterns.
- **Yellow**
    - Tests pass but:
        - High TVL / user flow flagged.
        - Custom contract logic beyond templates.
        - External integrations not covered by default tests.
- **Red**
    - Tests/static checks failing.
    - Security rules violated (e.g. missing x402 verification on a gated endpoint, raw private key handling, unrestricted admin).

Studio UI shows a **status badge per layer** (Contracts/Backend/Frontend/Config) and an overall project status. Clicking a badge opens the exact failing checks and recommended human actions, following the same philosophy as modern quality gates in DevOps.[^7][^8][^6]

***

This gives you a complete, opinionated policy for **what HyperAgent is allowed to do, how it’s evaluated, and how users stay in control** of safety, secrets, and multi‑chain behavior.
<span style="display:none">[^15][^16][^17][^18][^19][^20][^21]</span>

<div align="center">⁂</div>

[^1]: https://docs.cdp.coinbase.com/x402/welcome

[^2]: https://portal.thirdweb.com/x402

[^3]: https://blog.logrocket.com/ai-ready-frontend-architecture-guide/

[^4]: https://www.navam.io/blog/ai-friendly-frontend-architecture.html

[^5]: https://www.codu.co/logrocket-blog/a-developers-guide-to-designing-ai-ready-frontend-architecture-lle0I4N

[^6]: https://www.devopstraininginstitute.com/blog/why-are-readiness-gates-important-before-triggering-production-deployments

[^7]: https://developer.salesforce.com/blogs/2025/04/supercharge-devops-with-built-in-testing-and-quality-gates

[^8]: https://testrigor.com/blog/software-quality-gates/

[^9]: projects.programming.architecture_and_prd

[^10]: https://12factor.net/config

[^11]: https://dev.to/lovestaco/twelve-factor-architecture-best-practices-for-modern-applications-56p

[^12]: https://talent500.com/blog/the-twelve-factor-app-best-practices-for-cloud-native-applications/

[^13]: What-Skale-can-bring-on-HyperAgent.md

[^14]: https://blog.skale.space/blog/using-skale-for-gasless-x402-payments

[^15]: https://blog.skale.space/blog/how-does-skale-have-zero-gas-fees

[^16]: https://www.codemotion.com/magazine/frontend/web-developer/ai-ready-frontend-architecture/

[^17]: https://rootstack.com/en/blog/guide-building-ai-ready-software-architecture

[^18]: https://dustin.boston/ai-ready-frontend-architecture/

[^19]: https://dev.to/devcommx_c22be1c1553b9816/how-to-build-ai-ready-apps-in-2025-architecture-tools-best-practices-3nb6

[^20]: https://www.linkedin.com/posts/cesalberca_just-published-ai-ready-frontend-architectures-activity-7338997202704306179-erS5

[^21]: https://www.browserstack.com/blog/introducing-quality-gate-test-observability/

