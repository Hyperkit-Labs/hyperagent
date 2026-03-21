# Real-Server Verification Pass

Last gate before upgrading from "conditionally ready" to "production ready for user onboarding."

## Config: Env-Driven (Coolify or Full-Local)

The verification script uses env vars so you can target **Coolify-backed** (local Studio, remote gateway) or **full-local** (make up + run-web):

| Env | Default | Coolify-backed |
|-----|---------|----------------|
| `STUDIO_BASE_URL` | `http://127.0.0.1:3000` | Same (local `make run-web`) |
| `GATEWAY_BASE_URL` | `http://localhost:4000` | `https://api.your-coolify-domain.com` |
| `ORCHESTRATOR_BASE_URL` | — | Optional, if orchestrator is directly reachable |

**Studio must call the backend:** Set `NEXT_PUBLIC_API_URL` in `.env` to your gateway URL. For Coolify, use `https://api.your-domain.com/api/v1` so Studio (running locally) fetches from the Coolify gateway.

## Coolify-Backed Verification (Recommended for Production)

1. **Backend on Coolify:** API gateway, orchestrator, and services deployed via Coolify on Contabo.
2. **Studio locally:** `make run-web` only. No `make up`.
3. **Configure `.env` in repo root:**
   ```bash
   NEXT_PUBLIC_API_URL=https://api.your-coolify-domain.com/api/v1
   STUDIO_BASE_URL=http://127.0.0.1:3000
   GATEWAY_BASE_URL=https://api.your-coolify-domain.com
   ```
4. Run verification:
   ```bash
   make run-web   # In one terminal
   make verify-real-server   # In another (from repo root)
   ```

Playwright runs against local Studio; Studio fetches from the Coolify gateway. Health checks hit the remote gateway.

## Full-Local Verification

1. Backend: `make up`
2. Studio: `make run-web`
3. Run: `make verify-real-server` (defaults work)

## 1. Run Playwright Against Real Stack

```bash
cd apps/studio
pnpm run test:e2e:real-server
```

Or from repo root: `make verify-real-server`

The script:

- Pings `STUDIO_BASE_URL` (local Studio)
- Pings `GATEWAY_BASE_URL` at `/health` and `/health/live`
- Runs `auth-expiry-desync`, `auth-redirect`, and `streaming-request-id` specs **without route mocks**
- Uses `PLAYWRIGHT_REAL_SERVER=1` so tests hit the real backend

Expected: all tests pass. If they fail, check that `.env` has `NEXT_PUBLIC_API_URL` pointing to the gateway Studio uses.

## 2. Verify Migration State (RLS Policies)

Run against your Supabase DB:

```bash
psql "$DATABASE_URL" -f supabase/scripts/verify-rls-policies.sql
```

Or paste `supabase/scripts/verify-rls-policies.sql` into the Supabase Dashboard SQL Editor.

Expected: every `public` table has at least one policy; typically `service_role_all` for backend-only tables. `deployments` should not have `owner_read_own_deployments` (dropped in `20260321000001`).

## 3. Sanity-Check Auth/Session Flows (Manual)

1. Open Studio in an incognito window (local URL or deployed)
2. Visit `/` — redirect to `/login`
3. Connect wallet (SIWE) — complete sign-in
4. Visit `/dashboard` — loads without redirect
5. Clear cookies, reload — redirect to `/login`
6. (Optional) Set expired `hyperagent_session_token` cookie — middleware redirects to `/login`

## Pass Criteria

- [ ] Playwright real-server E2E pass (exit code 0)
- [ ] RLS verification: all tables have policies; no dead `owner_read_own_deployments`
- [ ] Manual auth flow: unauthenticated redirects; authenticated loads dashboard; expiry clears session

If all pass: **production ready for user onboarding.**
