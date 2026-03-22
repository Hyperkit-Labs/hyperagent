# Production Hardening Operator Notes

## Verification Prerequisites

Real-server E2E and RLS checks require a running stack. Until both pass, the system is not production-ready.

### 1. Start the stack

Full-local:
```bash
make up
make run-web
```

Coolify-backed (Studio local, backend on Coolify):
```bash
make run-web   # In one terminal
# Ensure .env has NEXT_PUBLIC_API_URL=https://api.your-coolify-domain.com/api/v1
# Gateway and services run on Coolify
```

### 2. Run real-server verification

```bash
make verify-real-server
```

Expected: all Playwright specs pass (auth-expiry-desync, auth-redirect, streaming-request-id). If Gateway or Studio are unreachable, fix env (GATEWAY_BASE_URL, STUDIO_BASE_URL) and ensure services are up.

### 3. Run RLS verification

```bash
psql "$DATABASE_URL" -f supabase/scripts/verify-rls-policies.sql
```

Or paste `supabase/scripts/verify-rls-policies.sql` into Supabase Dashboard SQL Editor. Expect every public table to have at least one policy (typically service_role_all).

### 4. Manual auth sanity check

1. Open Studio in incognito (local URL or deployed)
2. Visit / — redirect to /login
3. Connect wallet (SIWE) — complete sign-in
4. Visit /dashboard — loads without redirect
5. Clear cookies, reload — redirect to /login
6. (Optional) Set expired hyperagent_session_token cookie — middleware redirects to /login

## Code Changes Applied (This Pass)

- Persistence: workflow_state blob writes retired. Rich data now stored only in run_state + project_artifacts.

- Production startup (H-004 partial): when NODE_ENV=production or ENVIRONMENT=production, missing or localhost service URLs set startup degraded and /health returns 503. Service discovery and URL registry are not implemented; production only blocks bad config via degraded health.

## Env Requirements (Production)

All service URLs must be set explicitly. No localhost default.

- COMPILE_SERVICE_URL
- AUDIT_SERVICE_URL
- AGENT_RUNTIME_URL
- SIMULATION_SERVICE_URL
- STORAGE_SERVICE_URL
- DEPLOY_SERVICE_URL

## Ship Decision

Today: Not production-ready. Runtime verification not executed. No proof artifacts.

After the four checks above pass (with output/proof): Acceptable for closed beta. Do not upgrade the label until those outputs exist as proof artifacts, not intentions.
