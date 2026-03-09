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
│  API Gateway │ JWT auth │ Rate limiting (Redis) │ CORS │ Request validation  │
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

Studio is a thin client. All pipeline logic, BYOK handling, and safety gates live in backend services.

---

## Layer 2: Gateway (API Gateway)

| Component | Security responsibility |
|-----------|-------------------------|
| **JWT auth** | `AUTH_JWT_SECRET` required for production. Validates `Authorization: Bearer` on all `/api/v1` routes except public paths. |
| **Public paths** | `/health`, `/api/v1/auth/siwe`, `/api/v1/config`, `/api/v1/networks`, `/api/v1/tokens/stablecoins` are unauthenticated. |
| **Rate limiting** | Redis-backed. Per-IP and per-user limits. Stricter limits for LLM keys, workflow start, and deploy prepare. Fail-closed when Redis unavailable in production. |
| **Request validation** | Request ID for tracing; structured security event logging. |

**Required env:** `AUTH_JWT_SECRET`, `REDIS_URL`, `REQUIRE_AUTH=true` (or unset; default enforced).

---

## Layer 3: Orchestrator

| Component | Security responsibility |
|-----------|-------------------------|
| **BYOK decryption** | Decrypts LLM keys only in request scope; never logs or returns plaintext. Uses `LLM_KEY_ENCRYPTION_KEY`. |
| **Agent session JWTs** | Short-lived JWTs for cross-service calls; scoped to run. |
| **Internal service token** | `INTERNAL_SERVICE_TOKEN` for service-to-service auth when configured. |
| **Step audit trail** | `run_steps` table records each pipeline step; trace blob IDs for provenance. |
| **Workspace isolation** | Runs and keys scoped by `X-User-Id` (wallet user). |

Orchestrator never stores raw LLM keys. Keys are encrypted at rest and decrypted only when building agent context for a run.

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

## Layer 5: Security Tools

| Tool | Where used | Purpose |
|------|------------|---------|
| **Slither** | Audit service, `infra/registries/security.yaml` | Static analysis; reentrancy, access control, gas. |
| **Mythril** | Audit service | Symbolic execution; SWC mapping. |
| **MythX** | Audit service (when `AUDIT_MODE=mythx`) | Cloud analysis. |
| **Echidna** | Audit service | Fuzzing. |
| **Tenderly** | Simulation service | Pre-deploy simulation; failure blocks deploy. |
| **SCRUBD** | Orchestrator (mandatory step) | RE/UX validation; reentrancy and unhandled exceptions. |
| **Pashov solidity-auditor** | Orchestrator (when `PASHOV_AUDIT_ENABLED=true`) | AI-driven security review; merged with Slither/Mythril. |

Policy: `infra/registries/security.yaml` defines `mandatoryTools`, `deployBlockSeverity`, `maxAllowedSeverityForDeploy`, and `requireSimulationSuccess`. High-severity SWC findings block deployment.

---

## Layer 6: Data Layer

| Store | Security responsibility |
|-------|-------------------------|
| **Supabase (Postgres)** | RLS on `wallet_users`, `user_profiles`; only owning user can read/update `encrypted_llm_keys`. No LLM keys in logs or responses. |
| **Redis** | Rate limit state; no persistent user data. Required in production for rate limiting. |
| **IPFS (Pinata)** | Artifacts by CID; gateway URLs. No secrets in pinned content. |

Storage policy: `docs/storage-policy.md`. Traces (stub IDs), artifacts (IPFS), indexes (Supabase). No large blobs in Postgres.

---

## BYOK (Bring Your Own Keys)

- **Storage:** `wallet_users.encrypted_llm_keys` (Supabase). Encrypted with Fernet using `LLM_KEY_ENCRYPTION_KEY`.
- **Write path:** `POST /api/v1/workspaces/current/llm-keys`; orchestrator encrypts before write.
- **Read path:** `GET` returns `configured_providers` only; never plaintext keys.
- **Use path:** Orchestrator decrypts in request scope when building agent context; keys not exposed to frontend.
- **Rate limit:** Stricter limits on LLM keys endpoint to prevent key-stuffing.

See `docs/runbooks/BYOK-key-lifecycle.md` for rotation and re-key procedures.

---

## Deployment Checklist

1. Set `AUTH_JWT_SECRET` (`openssl rand -base64 32`).
2. Set `REDIS_URL` (Redis Cloud or self-hosted).
3. Set `LLM_KEY_ENCRYPTION_KEY` (strong secret for BYOK).
4. Set `REQUIRE_AUTH=true` or leave unset (default: enforced).
5. Set `CORS_ORIGINS` to production domains.
6. Do not disable rate limiting in production.
7. Ensure Supabase RLS is enabled on `wallet_users` and `user_profiles`.
8. Set `TOOLS_API_KEY` if using remote hyperagent-tools for audit.
9. Set `TENDERLY_API_KEY` for simulation service.
10. Set `PINATA_JWT` or equivalent for storage service when using IPFS.

---

## Reporting Vulnerabilities

Report security issues privately. Do not open public issues for vulnerabilities.
