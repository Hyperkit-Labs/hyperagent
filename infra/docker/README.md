# Docker

Dockerfiles and Compose for local dev. See `docs/detailed/Monorepo.md`.

For when and how `make build` / `make up` / `make down` / `make rebuild` / `make restart` affect images and containers, see [docs/docker-scenarios.md](../../docs/docker-scenarios.md).

## Full stack

From repo root:

```bash
cp .env.example .env
# Edit .env with Supabase, Redis, and API keys
docker compose -f infra/docker/docker-compose.yml up --build
```

- Studio: http://localhost:3000
- API Gateway: http://localhost:4000 (set `NEXT_PUBLIC_API_URL=http://localhost:4000` so Studio uses the gateway)
- Orchestrator: http://localhost:8000
- Agent runtime: http://localhost:4001
- Supabase Postgres: localhost:54322 (migrations from `platform/supabase/migrations`)
- Redis: localhost:6379