# Security Policy

Security is mandatory. HyperAgent handles valuable assets, wallet connections, LLM keys, and smart contract deployment. Authentication, rate limiting, access controls, and audit tooling are required, not optional.

---

## System Architecture Overview

HyperAgent is a layered platform. Each layer has distinct security responsibilities and trust boundaries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                                │
│  Studio (Next.js) │ Wallet connect (SIWE) │ Thirdweb for deploy signing      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GATEWAY LAYER                                                               │
│  API Gateway │ JWT auth │ Upstash REST rate limits │ metering │ x402 (priced) │
│  Identity HMAC to orchestrator │ CORS │ Request validation                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR LAYER                                                          │
│  LangGraph pipeline │ BYOK decryption │ Agent session JWTs │ Step audit      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  BACKEND SERVICES│    │  SECURITY TOOLS   │    │  DATA LAYER      │
│  Compile, Audit, │    │  Slither, Mythril │    │  Supabase (RLS), │
│  Simulation,     │    │  Tenderly, SCRUBD │    │  Redis, IPFS     │
│  Deploy, ROMA,   │    │  Pashov auditor   │    │  (Pinata)        │
│  Storage, Tools  │    │                   │    │                  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Layer 1: Client (Studio)

| Component | Security responsibility |
|-----------|-------------------------|
| **Wallet connect** | SIWE (Sign-In with Ethereum) via Thirdweb; no password storage. |
| **LLM keys (BYOK)** | Keys sent over HTTPS to gateway; never stored in browser after submit. |
| **Deploy signing** | User signs deploy transaction in browser; private key never leaves wallet. |
| **API calls** | All backend calls use `Authorization: Bearer <JWT>`; JWT from SIWE. |
| **CORS** | `CORS_ORIGINS` restricts allowed origins; set for production domains. |
| **Feature flags** | Billing and x402 hints follow gateway env (`X402_ENABLED`, merchant address, metering). Studio should not assume paid routes are off in production without checking deployment config. |

Studio is a thin client. All pipeline logic, BYOK handling, and safety gates live in backend services.

---

## Layer 2: Gateway (API Gateway)

| Component | Security responsibility |
|-----------|-------------------------|
| **JWT auth** | `AUTH_JWT_SECRET` required for production. Validates `Authorization: Bearer` on non-public paths. Bootstrap paths under `/auth/bootstrap/` remain public for SIWE completion. |
| **Public paths** | Canonical list: `GATEWAY_PUBLIC_PATHS` in `@hyperagent/api-contracts` (health, `GET /api/v1/auth/bootstrap`, `GET /api/v1/config`, networks, stablecoins, platform track record, and legacy aliases). Dev-only public paths (`/api/v1/config/integrations-debug` and legacy alias) apply only when not in production. |
| **Identity to orchestrator** | The proxy strips client-supplied `X-User-Id`, `x-user-id`, and `x-user-id-sig`. It sets `x-user-id` from the JWT `sub` and, when `IDENTITY_HMAC_SECRET` is set, adds `x-user-id-sig` so the orchestrator can reject spoofed identity. Gateway and orchestrator must share the same secret. |
| **Rate limiting** | Upstash **REST** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) via `@upstash/ratelimit`. Per-IP and per-user limits; stricter buckets for bootstrap, config reads, BYOK, workflow generate, and deploy prepare. Fail-closed in production when REST Redis is missing or the limiter errors without an auth-style response. |
| **Metering (credits)** | When `METERING_ENFORCED` is on, non-exempt routes require a usable credit balance before expensive work. Exempt prefixes are defined in `METERING_EXEMPT_PREFIXES` (`@hyperagent/api-contracts`): e.g. health, config, networks, stablecoins, BYOK, credits/payments/pricing, storage webhooks, identity. Fail-closed if balance cannot be read when enforcement is on. |
| **x402 (external agents)** | Priced routes are declared in `X402_PRICED_PATHS` (`@hyperagent/api-contracts`). External callers without the internal JWT path receive HTTP 402 and payment requirements. Internal Studio traffic (JWT) skips the gateway x402 gate and uses credits/metering instead. Orchestrator still enforces x402 for direct external calls. Default facilitator URL is PayAI; Kite/Pieverse URLs exist for Kite network verification/settlement when enabled. |
| **Request validation** | Request ID for tracing; structured security event logging. Production readiness fields on `/health` include rate-limit REST config and identity HMAC configuration. |

**Required env (typical production):** `AUTH_JWT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REQUIRE_AUTH=true` (or unset; default enforced). Set `IDENTITY_HMAC_SECRET` when the orchestrator should enforce signed identity. For x402 hints in production, `MERCHANT_WALLET_ADDRESS` is validated at startup when billing x402 hints are enabled.

**Optional env:** Beta allowlist — `WAITLIST_SUPABASE_URL`, `WAITLIST_SUPABASE_SERVICE_KEY`, `BETA_ALLOWLIST_ENFORCED` (gateway bootstrap may reject non-allowlisted wallets when configured).

---

## Layer 3: Orchestrator

| Component | Security responsibility |
|-----------|-------------------------|
| **BYOK decryption** | Decrypts LLM keys only in request scope; never logs or returns plaintext. Uses `LLM_KEY_ENCRYPTION_KEY` or AWS KMS via `LLM_KEY_KMS_KEY_ARN` when configured; production requires one of these when BYOK persistence is enabled. |
| **Signed identity** | `SpoofedIdentityMiddleware`: when `IDENTITY_HMAC_SECRET` is set and enforcement is active (production or `ENFORCE_IDENTITY_HMAC=1`), requests with `X-User-Id` must present a valid `x-user-id-sig` from the gateway. Health, docs, metrics, and storage webhook prefixes are skipped. |
| **Second-layer rate limits** | `slowapi` limits sensitive routes (e.g. workflow generate, deploy) keyed by `X-User-Id` or client IP — defense in depth if traffic bypasses the gateway. Tunables: `RATE_LIMIT_ORCHESTRATOR_GENERATE`, `RATE_LIMIT_ORCHESTRATOR_DEPLOY`. |
| **x402 enforcement** | `x402_middleware.py`: internal callers (Studio path with user id) skip payment; external callers must supply `X-Payment` proof, pass structure/expiry checks, and replay protection (Redis-backed when `REDIS_URL` is set). Optional facilitator settlement (`X402_FACILITATOR_URL`, `X402_FACILITATOR_ENABLED`). |
| **Agent session JWTs** | Short-lived JWTs for cross-service calls; scoped to run. |
| **Internal service token** | `INTERNAL_SERVICE_TOKEN` for service-to-service auth when configured. |
| **Step audit trail** | `run_steps` table records each pipeline step; trace blob IDs for provenance. |
| **Workspace isolation** | Runs and keys scoped by `X-User-Id` after gateway trust; do not accept raw client identity headers on the public internet without the gateway + HMAC pattern above. |

Orchestrator never stores raw LLM keys. Keys are encrypted at rest and decrypted only when building agent context for a run.

**Redis (TCP):** `REDIS_URL` on the orchestrator backs LangGraph queue/checkpointer, x402 nonce/replay storage, and related state. This is separate from the gateway’s Upstash **REST** credentials used only for HTTP rate limiting.

---

## Layer 4: Backend Services

| Service | Purpose | Security notes |
|---------|---------|----------------|
| **Compile** | Solidity compilation | Receives contract code; no persistent storage of user code. |
| **Audit** | Slither, Mythril, MythX, Echidna | Runs in isolated context; `TOOLS_API_KEY` when using remote tools. |
| **Simulation** | Tenderly simulation | Uses `TENDERLY_API_KEY`; simulations before deploy. |
| **Deploy** | Deploy plan generation | Plans only; actual signing in Studio. |
| **ROMA** | Spec generation | Optional; agent-runtime fallback when unset. |
| **Storage** | IPFS/Pinata pinning | `PINATA_JWT` or API keys; artifacts by CID. |
| **Vectordb** | RAG, embeddings | Qdrant or Pinecone; no user secrets. |
| **Tools (hyperagent-tools)** | Slither/Mythril remote | `TOOLS_API_KEY` for auth; used by audit service. |

Cross-service URLs (`COMPILE_SERVICE_URL`, `AUDIT_SERVICE_URL`, etc.) are configured per environment. Internal calls use `INTERNAL_SERVICE_TOKEN` when set.

---

## Layer 5: Security Tools (Tiered Gate Model)

HyperAgent enforces a three-tier security model: deterministic static analysis (Slither), deterministic symbolic execution (Mythril), and deterministic runtime validation (Tenderly simulation) are mandatory deployment gates; property-based fuzzing (Echidna) is mandatory when invariant harnesses are available; AI review (Pashov `solidity-auditor`) is always executed but becomes deploy-blocking only when corroborated or manually confirmed.

| Tool | Trust level | Deploy rule | Purpose |
|------|-------------|-------------|---------|
| **Slither** | High | Block on High/Critical | Mandatory static gate for reentrancy, access control, and related classes. |
| **Mythril** | High | Block on High/Critical | Mandatory symbolic gate; findings stored with raw JSON evidence, SWC identifiers, and transaction sequences. |
| **Echidna** | Medium-high | Block when harness fails | Mandatory only when harness exists. Echidna is not considered successful unless HyperAgent generated or attached executable properties, assertions, or invariant functions. If no harness, return NOT_APPLICABLE. |
| **Tenderly** | High | Always block on failure | Mandatory predeploy execution gate; any failed simulation blocks deploy. |
| **SCRUBD** | Internal-high | Block on matched patterns | Mandatory policy/pattern gate for curated RE/UX checks; label as internal-policy. |
| **Pashov solidity-auditor** | Medium | Block only when corroborated | Always-on reviewer; block only when corroborated by Slither/Mythril/Echidna/Tenderly or escalated by human review. |
| **ROMA** | Internal | Never block | Spec bootstrap and requirement shaping; not a security control. |
| **MythX** | Optional | Never block | Optional compatibility backend; not a hard dependency. |

**Hard rules:**
- Slither or Mythril High/Critical finding blocks deploy unless explicitly waived by a signed human override with evidence attached.
- Echidna property failure blocks deploy, but missing properties cannot be counted as success.
- Tenderly simulation failure always blocks deploy.
- Pashov findings become deploy-blocking only if reproduced by deterministic tooling, matched to known policy categories, or confirmed in manual review.

Policy: `infra/registries/security.yaml` defines `tieredGates`, `mandatoryTools`, `deployBlockSeverity`, `maxAllowedSeverityForDeploy`, and `requireSimulationSuccess`.

**Security policy evaluator:** A dedicated `security_policy_evaluator` stage runs after simulation and before exploit_simulation. It produces a single normalized `SecurityVerdict` from audit, SCRUBD, and simulation outputs. Deterministic tools and simulation are the hard gate; AI review (Pashov) is mandatory context that can escalate risk but must not silently substitute for reproducible evidence. `NOT_APPLICABLE` is never treated as `PASS`. `WAIVED` must always carry human evidence (approver_id, reason, expiry_at, evidence_refs). Deploy approval reads from `security_verdict.approvedForDeploy`. Module: `services/orchestrator/security/` (evaluator, policy_loader, finding_normalizers, finding_correlation, waiver_validation, schemas).

---

## Layer 6: Data Layer

| Store | Security responsibility |
|-------|-------------------------|
| **Supabase (Postgres)** | RLS on `wallet_users`, `wallet_user_profiles`; only owning user can read/update `encrypted_llm_keys`. No LLM keys in logs or responses. |
| **Redis** | Gateway: Upstash REST for rate-limit counters only. Orchestrator: TCP `REDIS_URL` for queues, checkpointer, x402 replay protection — not interchangeable with gateway REST env vars. |
| **IPFS (Pinata)** | Artifacts by CID; gateway URLs. No secrets in pinned content. |

Storage policy: `docs/storage-policy.md`. Traces (stub IDs), artifacts (IPFS), indexes (Supabase). No large blobs in Postgres.

---

## BYOK (Bring Your Own Keys)

- **Storage:** `wallet_users.encrypted_llm_keys` (Supabase). Encrypted with Fernet using `LLM_KEY_ENCRYPTION_KEY`, or envelope encryption when `LLM_KEY_KMS_KEY_ARN` is set.
- **Write path:** `POST /api/v1/workspaces/current/llm-keys`; orchestrator encrypts before write.
- **Read path:** `GET` returns `configured_providers` only; never plaintext keys.
- **Use path:** Orchestrator decrypts in request scope when building agent context; keys not exposed to frontend.
- **Rate limit:** Stricter limits on LLM keys endpoint to prevent key-stuffing.

See `docs/runbooks/BYOK-key-lifecycle.md` for rotation and re-key procedures.

---

## Inbound webhooks (HMAC)

Webhook endpoints verify HMAC-SHA256 signatures before mutating state. In production, missing secrets should fail closed (503) where implemented.

| Webhook | Secret env | Header (typical) |
|---------|------------|------------------|
| Pinata pin events | `PINATA_WEBHOOK_SECRET` | `x-pinata-signature` or `x-pinata-hmac-sha256` |
| Tenderly simulation alerts | `TENDERLY_WEBHOOK_SECRET` | `x-tenderly-signature` |
| x402 facilitator settlement | `X402_WEBHOOK_SECRET` | `x-facilitator-signature` |

Implementations live under `services/orchestrator/api/` (`storage_webhooks.py`, `simulation_webhooks.py`, `x402_webhooks.py`) with shared `webhook_utils.verify_hmac_sha256`.

---

## Deployment Checklist

1. Set `AUTH_JWT_SECRET` (`openssl rand -base64 32`).
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (Upstash console → REST API). Set `REDIS_URL` for orchestrator **TCP** (queue, checkpointer, x402 replay — distinct from REST).
3. Set `LLM_KEY_ENCRYPTION_KEY` and/or `LLM_KEY_KMS_KEY_ARN` for BYOK (production requires one when persistence is on).
4. Set `IDENTITY_HMAC_SECRET` to the same value on gateway and orchestrator so user id forwarding cannot be spoofed; avoid `DISABLE_IDENTITY_HMAC_ENFORCEMENT` in production.
5. Set `REQUIRE_AUTH=true` or leave unset (default: enforced).
6. Set `CORS_ORIGINS` to production domains.
7. Do not disable rate limiting in production.
8. Ensure Supabase RLS is enabled on `wallet_users` and `wallet_user_profiles`.
9. Set `TOOLS_API_KEY` if using remote hyperagent-tools for audit.
10. Set `TENDERLY_API_KEY` for simulation service. For Layer 5 fail-closed, set `TENDERLY_SIMULATION_REQUIRED=true`.
11. Set `PINATA_JWT` or equivalent for storage service when using IPFS.
12. Set `PINATA_WEBHOOK_SECRET`, `TENDERLY_WEBHOOK_SECRET`, and `X402_WEBHOOK_SECRET` in production when those webhooks are exposed.
13. If metering is on, configure credits backend and `METERING_ENFORCED` per ops runbook; confirm exempt paths match product expectations.
14. If x402 is enabled, set `X402_PAY_TO_ADDRESS`, facilitator URLs, and review `X402_PRICED_PATHS` and chain CAIP settings; confirm merchant wallet validation passes gateway startup checks when x402 hints are enabled in production.
15. Optional beta gate: `WAITLIST_SUPABASE_*` and `BETA_ALLOWLIST_ENFORCED` if using waitlist allowlist at bootstrap.

---

## Policy vs implementation

This file is the policy. A living **gap register** (aligned areas, claims to avoid, and missing enforcement) is maintained in [`docs/security/implementation-gap-register.md`](docs/security/implementation-gap-register.md).

---

## Reporting Vulnerabilities

Report security issues privately. Do not open public issues for vulnerabilities.
