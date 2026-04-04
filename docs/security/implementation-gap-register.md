# Security policy vs implementation (gap register)

This document compares [SECURITY.md](https://github.com/Hyperkit-Labs/hyperagent/blob/main/SECURITY.md) to the current repository. It is a **living register**: update it as enforcement lands. It is not marketing copy.

---

## What stays (aligned; keep building on these)

These match the security policy direction and should remain:

| Area | Rationale |
|------|-------------|
| Wallet connect / SIWE / Thirdweb signing | Good fit for browser-side signing. |
| Gateway auth + rate limiting architecture | JWT at gateway, Redis/Upstash rate limiting, request validation. |
| Orchestrator-managed BYOK decryption | Keys decrypted only in request scope. |
| Layered security model | Slither / Mythril / Tenderly / Echidna / Pashov split is the right direction. |
| IPFS/Pinata artifact storage | CID-based artifact storage is consistent with policy. |
| Supabase RLS and metadata-backed storage | Good for user/workspace isolation. |
| Step audit trail / provenance | `run_steps` and trace blobs are the right control-plane evidence. |
| Mandatory simulation before deploy | This should absolutely remain as the product intent. |

---

## What goes (weak, misleading, or not yet enforced)

Do **not** treat these as guarantees in copy, UI, or reviews until enforcement is proven:

| Item | Why |
|------|-----|
| “Production-ready” as a general claim | Not supported end-to-end yet. |
| “Audited” as a guarantee | Audit tooling exists; that is not a guaranteed audited output. |
| “Simulation-first” if not strictly fail-closed everywhere | Must be a gate, not a slogan. |
| Implicit reliance on `X-User-Id` as auth | Policy wants JWT-authenticated API calls, not header trust. |
| Silent defaults on security-critical paths | If auth, rate limit, or simulation is unavailable in production, those paths should fail closed. |
| Claims that AI review alone is sufficient | Policy says AI review is contextual, not authoritative. |

---

## What is missing (enforcement and proof)

### 1) Real gateway-enforced JWT auth everywhere

**Policy:** All `/api/v1` routes except public paths require `Authorization: Bearer <JWT>`.

**Gap:** Session-style flows in Studio and some backends still lean on `X-User-Id` or split trust.

**Missing**

- A single, enforced auth contract at the gateway.
- Removal of user-ID headers as identity (or strict gateway stripping + service trust only on internal network, if ever).
- Consistent JWT propagation from Studio to backends.

**Why it matters:** Without this, auth is split and spoofable.

**Update (repo):** `apps/api-gateway/src/auth.ts` enforces JWT on non-public paths; `apps/api-gateway/src/index.ts` requires `AUTH_JWT_SECRET` and Upstash REST env in production before listen; `apps/api-gateway/src/proxy.ts` strips client `X-User-Id` and sets identity from JWT with optional `IDENTITY_HMAC_SECRET` signature for the orchestrator; `services/orchestrator/api/spoofed_identity_middleware.py` rejects unsigned identity when the secret is set. **Still verify:** orchestrator is not reachable without the gateway in production, and Studio only calls the gateway.

---

### 2) Fail-closed rate limiting

**Policy:** Upstash rate limiting is mandatory; unavailable in production should fail closed.

**Missing**

- Proof that all required routes are actually rate-limited.
- Proof that production downtime of the rate limiter blocks sensitive actions.
- Route-specific stricter limits for: LLM key writes, workflow start, deploy prepare.

**Why it matters:** If sensitive endpoints are not gated, the control plane is soft.

**Update (repo):** `apps/api-gateway/src/rateLimit.ts` returns 503 in production when Upstash REST is unset, when the client is unavailable after backoff, or when `limit()` fails without auth-style errors; stricter buckets for bootstrap, lightweight config reads, BYOK, `POST .../llm-keys`, `POST /api/v1/workflows/generate`, and `POST .../deploy/prepare`. **Still verify:** integration tests or monitoring prove 429/503 behavior under load and outage.

---

### 3) Full deterministic security gate pipeline

**Policy (intent):** Slither/Mythril high/critical block deploy; Tenderly failure blocks deploy; Echidna blocks when harness exists; Pashov contextual; `NOT_APPLICABLE` is never `PASS`.

**Missing**

- Proof that deploy approval reads a normalized **SecurityVerdict** (or equivalent) end-to-end.
- Proof that tools are wired into a **fail-closed** deploy gate.
- Proof that waivers require signed human evidence.
- Proof that “AI review” cannot override deterministic findings without policy.

**Why it matters:** Separates “tools exist” from “security is enforced.”

**Update (repo):** `services/orchestrator/security/evaluator.py` produces a normalized `SecurityVerdict` (including Tenderly tool status); `nodes.py` `security_policy_evaluator_agent` evaluates policy; `store.update_workflow` persists `security_verdict` and `security_approved_for_deploy` (memory + `project_artifacts` when Supabase is configured; `get_workflow` merges from artifacts even when a legacy rich blob exists); `POST .../deploy/prepare` rejects when a stored verdict exists and `approvedForDeploy` is not true (`mainnet_guard.check_security_verdict_deploy_gate`). **Still missing:** operational proof of waiver signing, AI-override policy, and end-to-end CI coverage of a full failing audit path.

---

### 4) Clear public/private route separation

**Policy public endpoints (examples):** `/health`, `/api/v1/auth/bootstrap`, `/api/v1/config`, `/api/v1/networks`, `/api/v1/tokens/stablecoins`.

**Missing**

- Verification that everything else is gated.
- Proof that Studio does not rely on unauthenticated fallback behavior.
- Consistent enforcement in gateway and downstream services.

**Update (repo):** `apps/api-gateway/src/auth.ts` defines `PUBLIC_PATHS` and dev-only public paths; examples above match. **Still verify:** any new gateway routes are classified and tested.

---

### 5) BYOK lifecycle hardening

**Policy:** Keys encrypted at rest; never plaintext in logs/responses; strict write/read/use paths; stricter rate limits.

**Missing**

- End-to-end confirmation that no service logs or returns plaintext keys.
- Rotation/re-key workflow enforcement.
- Full audit around key access and use.
- Concrete enforcement of request-scope-only decryption.

**Update (repo):** Gateway rate limits BYOK routes (`rateLimit.ts`); orchestrator stores keys via Supabase with service role (see `llm_keys_supabase.py`). **Still missing:** rotation workflow, log/response audits, and automated scans for plaintext key leakage.

---

### 6) True RLS-backed workspace isolation

**Policy:** RLS on wallet tables; only owning user can read/update keys.

**Missing**

- Proof all relevant tables have RLS policies.
- Proof backend routes do not bypass row-level boundaries.
- Proof workspace/run/artifact access is consistently scoped.

**Update (repo):** No change to RLS proof in code here; validate against `supabase/migrations` and runbooks.

---

### 7) Security event logging and traceability

**Policy:** Request ID tracing; structured security logging; provenance/step audit.

**Missing**

- Uniform security logging across gateway, orchestrator, and storage webhooks.
- Consistent trace IDs on security-critical actions.
- Clear incident/audit trail for: auth failure, rate limit hit, simulation failure, deploy failure, waiver approval.

**Update (repo):** Gateway `auth.ts` / `rateLimit.ts` emit structured `security event` logs with path and request id; orchestrator logs security-relevant lines in multiple modules. **Still missing:** one unified schema and dashboards for all listed incident types.

---

### 8) No-secrets-in-IPFS enforcement

**Policy:** No secrets in pinned content.

**Missing**

- Scanning before upload (beyond string/key scrub).
- Policy enforcement for generated bundles.

**Update (repo):** `services/orchestrator/security/artifact_scrub.py` scrubs dict/list/string payloads; `ipfs_client.pin_json` calls scrub + `assert_safe_for_ipfs` and skips pin on failure; unit tests in `tests/unit/test_artifact_scrub.py`.

---

### 9) Simulation as a hard deploy gate

**Policy:** Tenderly simulation failure always blocks deploy.

**Missing**

- Proof deployment cannot proceed without successful simulation.
- Proof the frontend cannot bypass that state.
- Proof failed simulation is recorded and visible.

**Update (repo):** `mainnet_guard.check_mainnet_guard` requires simulation success and audit hygiene for mainnet; `prepare_deploy_api` calls `check_security_verdict_deploy_gate` so a persisted rejecting `SecurityVerdict` blocks prepare; optional `ENFORCE_SIMULATION_BEFORE_DEPLOY=1` applies `check_simulation_deploy_gate` for all chains (see `.env.example`). **Still verify:** Studio UX and API contracts so clients cannot skip server checks.

---

### 10) Operational safe defaults

**Policy expectation:** Auth on by default; rate limiting on by default; RLS on by default; no LLM keys in logs; no silent weakening in production.

**Missing**

- Startup config validation that rejects unsafe production configs (beyond orchestrator warnings and optional `STRICT_STARTUP`).
- Environment hardening checks.
- Full health proof for every downstream dependency.

**Update (repo):** API gateway `/health` exposes `rate_limit_rest_configured`, `identity_hmac_configured`, `production_security_ready`, and folds them into `pipeline_ready`; orchestrator logs when `IDENTITY_HMAC_SECRET` is unset in production.

---

## Biggest mismatch (summary)

**SECURITY.md** describes a fail-closed, JWT-authenticated, tool-gated system. **Current implementation** still shows signs of split trust, fallback behavior, and partially enforced policy.

---

## Blunt verdict

**Stays:** Layered model, BYOK, IPFS/Pinata artifacts, Supabase metadata truth, audit trail, simulation gate concept, wallet-based deploy signing.

**Goes:** Marketing claims stronger than enforcement; trust in `X-User-Id` as identity; “audited/production-ready” language without hard gate proof; security-critical silent fallbacks.

**Missing most urgently:** RLS and workspace isolation proof; BYOK rotation and full log audit; uniform security telemetry; waiver and AI-override policy proof; frontend bypass testing. Several items above now have partial enforcement in gateway, orchestrator, and IPFS scrub (see per-section **Update (repo)**).
