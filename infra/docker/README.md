# Docker

Dockerfiles and Compose for local dev. See `docs/detailed/Monorepo.md`.

For when and how `make build` / `make up` / `make down` / `make rebuild` / `make restart` affect images and containers, see [docs/docker-scenarios.md](../../docs/docker-scenarios.md).

## Full stack

From repo root:

```bash
cp .env.example .env
# Edit .env with Supabase, Redis, and API keys
docker compose --project-directory . -f infra/docker/docker-compose.yml up --build
```

- Studio: http://localhost:3000
- API Gateway: http://localhost:4000 (set `NEXT_PUBLIC_API_URL=http://localhost:4000` so Studio uses the gateway)
- Orchestrator: http://localhost:8000
- Agent runtime: http://localhost:4001
- Supabase Postgres: localhost:54322 (migrations from `platform/supabase/migrations`)
- Redis: localhost:6379

## Contabo VPS / Nginx

For production behind Nginx (e.g. Contabo), use `nginx-contabo-full.conf` or include `nginx-sse.conf` in your server block so the agent discussion SSE stream does not disconnect during long runs (10+ min). Default 60s proxy timeout causes chat to drop; use 660s for `/api/v1/streaming/`.

**Critical:** Also set `PROXY_TIMEOUT_MS=660000` for the api-gateway. The gateway defaults to 25s, which kills SSE before Nginx. Add to Shared Env in Coolify or `.env` on the VPS.