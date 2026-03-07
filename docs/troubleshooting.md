# Troubleshooting

Common issues and fixes for HyperAgent Studio and backend.

---

## Frontend failing to connect

**Common causes:**

1. **CORS** – Accessing Studio via network URL (e.g. `http://192.168.1.4:3000`) while backend is on `localhost:4000`. The gateway allows `localhost`, `127.0.0.1`, and local network (`192.168.x.x`, `10.x.x.x`) in development. Use `http://localhost:3000` when possible.

2. **Wrong API URL** – `NEXT_PUBLIC_API_URL` must match the running backend. With `make up`, use `http://localhost:4000` (gateway). Restart Studio after changing `.env`.

3. **Backend not running** – Run `make up` before Studio. Verify: `curl -s http://localhost:4000/health` returns `{"status":"ok","gateway":true}`.

4. **Auth** – Most API routes require sign-in (SIWE). Connect wallet and sign in before using workflows.

---

## Redis rate limit errors (ETIMEDOUT, max retries)

**Symptom:** Gateway logs `[rate-limit] Redis check failed` or `ioredis Unhandled error event: Error: connect ETIMEDOUT`.

**Cause:** The gateway container cannot reach Redis. Common reasons:
- **Redis Cloud IP allowlist** – Add your machine's public IP in Redis Cloud Dashboard → Database → Security → Source IPs. Docker uses your host's outbound IP.
- **Docker networking** – Some networks block outbound connections from containers.
- **TLS** – If Redis Cloud requires TLS, use `rediss://` instead of `redis://`.

**Fix (local dev):** Disable Redis rate limiting by clearing `REDIS_URL` in `.env`:
```
REDIS_URL=
```
Then restart: `make restart`. Rate limiting is skipped when `REDIS_URL` is empty. Requests still work.

**Fix (keep Redis):** In Redis Cloud, add `0.0.0.0/0` to allow all IPs (dev only), or add your public IP. Get it: `curl -s ifconfig.me`.

---

## "Failed to fetch" on Settings (BYOK) with backend healthy

The Settings page (BYOK: get/set/delete LLM keys) fails because the **browser is calling a URL that does not match what is actually running**. This usually comes from **env + fallback** and **when** Next.js reads it.

### Root cause

- **`getServiceUrl('backend')`** in `apps/studio/config/environment.ts`:
  - **If `NEXT_PUBLIC_API_URL` is set:** base = that URL's origin + `/api/v1` (e.g. `http://localhost:4000/api/v1`).
  - **If `NEXT_PUBLIC_API_URL` is not set:** base = **`http://localhost:8000/api/v1`** (from config fallback).

So:

- You run **only the API gateway** on port **4000** (orchestrator behind it, not exposed on 8000):
  - **Without** `NEXT_PUBLIC_API_URL` → Studio calls **localhost:8000** → nothing there → **"Failed to fetch"**.
- You run **only the orchestrator** on port **8000** (no gateway):
  - With `NEXT_PUBLIC_API_URL=http://localhost:4000` → Studio calls **localhost:4000** → nothing there → **"Failed to fetch"**.

**Root cause:** Studio's base URL (from env or fallback) does not match the process you have listening (gateway on 4000 vs orchestrator on 8000).

### Env not applied (NEXT_PUBLIC_* is build-time)

- `NEXT_PUBLIC_API_URL` is inlined at **build time** in Next.js.
- If you added or changed it in `.env` but **did not restart** `pnpm --filter hyperagent-studio dev` (or did not rebuild), the app can still use the **old** value or the **fallback** (8000).

### CORS (credentials + wildcard)

- Studio sends requests with **`credentials: 'include'`** (cookies). The browser **rejects** responses that have **`Access-Control-Allow-Origin: *`** when credentials are sent; the server must send a **single, explicit origin** (e.g. `http://localhost:3000`).
- **Exact error:** *"The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'."*
- **Root cause:** API gateway (or backend) was using `cors()` with default `origin: '*'`. Fix: configure CORS with explicit origin(s) and `credentials: true`. See [CORS: credentials and wildcard](#cors-credentials-and-wildcard) below.

### Quick checks

| Check | What to do |
|-------|------------|
| What is Studio calling? | In DevTools → Network, see the **exact** request URL for the failing call (e.g. `http://localhost:4000/api/v1/workspaces/current/llm-keys` or `http://localhost:8000/...`). |
| What is actually running? | If only **gateway** is up on **4000**: set `NEXT_PUBLIC_API_URL=http://localhost:4000` and **restart** Studio. If only **orchestrator** is up on **8000**: either leave `NEXT_PUBLIC_API_URL` **unset** (so fallback 8000 is used) or set `NEXT_PUBLIC_API_URL=http://localhost:8000` and restart Studio. |
| Env applied? | After changing `.env`, **restart** the Studio dev server so `NEXT_PUBLIC_API_URL` is picked up. |
| CORS? | In Network, open the failed request and check response headers / console for CORS errors. If you see the wildcard + credentials error, fix the gateway CORS (see below). |

### Recommended fix (typical case)

You want Studio to talk to the **gateway** at 4000:

1. In repo root `.env` (or `.env.local` for Studio): set  
   `NEXT_PUBLIC_API_URL=http://localhost:4000`  
   (no trailing slash is fine; the code appends `/api/v1`).
2. **Restart** the Studio dev server:  
   `pnpm --filter hyperagent-studio dev`
3. Ensure the **gateway** is actually running on 4000 (e.g. `curl http://localhost:4000/health` returns OK).

If instead you run **only the orchestrator** on 8000 (no gateway), leave `NEXT_PUBLIC_API_URL` unset so the fallback `http://localhost:8000/api/v1` is used, and restart Studio after any env change.

---

## Studio "Backend request timed out" but curl returns 401 quickly

**Symptom:** Studio shows "Backend request timed out" for `/api/v1/networks` or `/api/v1/workspaces/current/llm-keys`, while `curl -i http://localhost:4000/api/v1/networks` returns **401 Unauthorized** immediately (no token).

**What that means:** The gateway is up and responding. Unauthenticated requests get 401 fast. When Studio sends a request **with** the SIWE Bearer token, the gateway accepts it and forwards to the **orchestrator**. The timeout happens because the **orchestrator** is not responding (down, wrong port, or stuck).

**Check:**

1. **Orchestrator running?** The gateway proxies to `ORCHESTRATOR_URL` (default `http://localhost:8000`). Start the orchestrator so it listens on that URL (e.g. `cd services/orchestrator && python -m uvicorn main:app --port 8000` or your project’s run command).
2. **curl with token:** In DevTools → Network, copy the `Authorization` header from a failing Studio request. Then run:
   ```bash
   curl -i -H "Authorization: Bearer <token>" http://localhost:4000/api/v1/networks
   ```
   - **200 + JSON** → token and gateway→orchestrator path are fine; the issue may be browser-specific (e.g. CORS/preflight).
   - **401** → token invalid or expired; sign in again.
   - **Hangs then 502** → gateway’s proxy timeout fired; orchestrator did not respond in time (orchestrator down or `ORCHESTRATOR_URL` wrong).

**Gateway proxy timeout:** The gateway now applies an upstream timeout (default 25s, override with `PROXY_TIMEOUT_MS`). If the orchestrator does not respond in time, the gateway returns **502 Bad Gateway** instead of hanging until the client times out.

---

## Backend request timed out with Docker (make up)

**Symptom:** Studio shows "Backend request timed out" when the backend is started with `make up` (Docker). Orchestrator is healthy and gateway is up.

**Checks:**

1. **Gateway upstream URL**  
   Run `make logs` (or `docker compose -f infra/docker/docker-compose.yml logs api-gateway`) and look for the startup line:
   - **Good:** `[API Gateway] listening on 4000, forwarding to http://orchestrator:8000`  
   - **Bad:** `forwarding to http://localhost:8000` — inside Docker, localhost is the gateway container itself, so the orchestrator is never reached.  
   Fix: Do not override `ORCHESTRATOR_URL` for the gateway in Docker; `infra/docker/docker-compose.yml` sets `ORCHESTRATOR_URL=http://orchestrator:8000` for the api-gateway service. If you see localhost, ensure your `.env` is not being applied in a way that overrides the compose `environment` (compose environment section should override env_file).

2. **Orchestrator and gateway health**  
   From the host:
   - `curl -s http://localhost:8000/health` — orchestrator direct (should return JSON).  
   - `curl -s http://localhost:4000/health` — gateway (should return `{"status":"ok","gateway":true}`).

3. **Authenticated request**  
   Use the same Bearer token as Studio (from DevTools → Network → request headers):
   - `curl -i -H "Authorization: Bearer <token>" http://localhost:4000/api/v1/networks`  
   If this returns 200 with JSON, the path is fine and the issue may be browser or Studio-specific. If it hangs and then 502, the gateway is timing out waiting on the orchestrator; check orchestrator logs for errors when the request is sent.

4. **Orchestrator logs**  
   When you trigger the failing request from Studio, check whether the orchestrator logs the request (e.g. uvicorn access log). If the request never appears, the gateway is not reaching the orchestrator (wrong URL or network). If it appears but the response is slow, the delay is inside the orchestrator (e.g. DB or registries).

---

## CORS: credentials and wildcard

**Symptom:** "Failed to fetch" or "Backend request timed out" when calling the API from Studio (e.g. Settings BYOK). Console shows: *"The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'."*

**Cause:** Studio uses `credentials: 'include'`. The API gateway was responding with `Access-Control-Allow-Origin: *`, which the browser disallows when credentials are sent.

**Fix:** In **`apps/api-gateway/src/index.ts`**, CORS must use **explicit origin(s)** and **`credentials: true`**, not the default wildcard. The gateway reads `CORS_ORIGINS` or `CORS_ORIGIN` (comma-separated list or single origin); default is `http://localhost:3000`. Set these in the gateway env (e.g. in `.env`) if Studio runs on another origin. After changing the gateway, restart it so CORS responses allow the request.

---

## Docs page "API reference" link

**Symptom:** Clicking "API reference" on the Docs page opens a URL that returns 404 (e.g. `http://localhost:4000/docs` when the gateway did not proxy `/docs`).

**Cause:** The link was derived from the API base origin + `/docs`. When Studio talks to the **gateway** (4000), that became `http://localhost:4000/docs`; the gateway previously had no `/docs` route, so Swagger (served by the orchestrator at `/docs`) was unreachable.

**Fix (applied):**
1. **Gateway:** Proxies `/docs` and `/openapi.json` to the orchestrator, so `http://localhost:4000/docs` works when the gateway is used.
2. **Studio:** Uses `getDocsUrl()` from `lib/api`. If **`NEXT_PUBLIC_DOCS_URL`** is set (e.g. `http://localhost:8000/docs` for orchestrator direct), that URL is used for the link. When unset, the link is API origin + `/docs` (works with the gateway proxy). Set `NEXT_PUBLIC_DOCS_URL` only when you need the link to point at the orchestrator directly (e.g. before gateway proxies `/docs`). Restart Studio after changing.

---

## "Chat request failed. Check your API key in Settings and try again."

**Symptom:** The UI shows "Gemini key active" (or another provider) but chat fails with the red banner above.

**Where chat runs:** Chat is handled by the **Studio Next.js app** at `apps/studio/app/api/chat/route.ts`. The request does **not** go through the API gateway or orchestrator. So:

- **Docker logs** (gateway, orchestrator) do **not** contain chat errors. Use them for workflow/create, BYOK storage, and other `/api/v1/*` calls.
- **Chat errors** appear in the **process that runs Studio** (Next.js):
  - **Local dev:** The terminal where you ran `pnpm --filter hyperagent-studio dev` (or `npm run dev` in `apps/studio`). Look for `[chat]` lines.
  - **Docker:** Only if Studio is run in a container; then use `docker logs <studio-container>`.

**What the logs show (after the latest change):**

- `[chat] BYOK provider=google hasKey=true` — Headers reached the route; provider and key are present.
- `[chat] BYOK provider=(none) hasKey=false` — No BYOK headers; key not sent or not set in session.
- `[chat] using model provider=Google Gemini` — Model resolved; stream is about to run.
- `[chat] stream error: <message> <cause>` — The LLM call threw (e.g. invalid key, quota, or network). The **message** is returned in the response body and shown in the UI when the client parses the 500 JSON.

**How to check:**

1. **Studio server logs (local dev)**  
   In the terminal where Studio is running, reproduce the chat failure. Look for:
   - `[chat] BYOK provider=... hasKey=...` — If `hasKey=false` or `provider=(none)`, the key is not reaching the server (check session storage and that the request is sent with the custom fetch that injects headers).
   - `[chat] stream error:` — The next line(s) are the real error (e.g. Gemini 400/401/403/429). Fix the key or quota; the UI will show this message once the client receives the 500 JSON.

2. **Docker (backend only)**  
   From repo root:
   ```bash
   docker compose -f infra/docker/docker-compose.yml logs api-gateway
   docker compose -f infra/docker/docker-compose.yml logs orchestrator
   ```
   Use these for **workflow create**, **BYOK get/set/delete**, and other gateway/orchestrator calls. They do **not** show chat errors.

3. **Browser Network tab**  
   Send a chat message and inspect the request to `/api/chat` (or your Studio origin + `/api/chat`). Check:
   - **Request headers:** `X-LLM-Provider` and `X-LLM-Api-Key` should be present when "Gemini key active" is shown.
   - **Response:** If status 500, the response body should be JSON with an `error` field containing the server message (e.g. from Gemini). If you see a stream or non-JSON, the error may be mid-stream and the UI might show a generic message.

**Common causes when "Gemini key active" but chat fails:**

- **Invalid or revoked key** — Server logs will show the Gemini API error (e.g. 400/401). Fix the key in Settings.
- **Headers not sent** — Logs show `hasKey=false`. Session key may be missing or the custom fetch may not be merging headers; check `useAppChat` and that the request is using the injected fetch.
- **Stream failure** — The response started as 200 stream then broke; the SDK can show a generic error. Server logs will show `[chat] stream error:` with the underlying cause.

---

## Frontend ↔ backend wiring (audit note)

- **Settings (BYOK)** is correctly wired to `GET /api/v1/workspaces/current/llm-keys` (and set/delete). The failure is not a wrong path but **which host/port** is used.
- **Root cause of "Failed to fetch" here:** Base URL used by Studio (from `NEXT_PUBLIC_API_URL` or fallback `http://localhost:8000/api/v1`) does not match the running backend (e.g. gateway on 4000 vs orchestrator on 8000), and/or Next.js was not restarted after changing env. Fix by aligning env with what is running and restarting the dev server.
