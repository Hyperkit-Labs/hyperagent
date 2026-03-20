# Coolify Deployment Guide

Recommended setup for deploying HyperAgent on Coolify.

## Branch Strategy

| Environment | Branch | Auto-deploy |
|-------------|--------|-------------|
| **Staging** | `development` | On push |
| **Production** | `main` | Only after release PR merge |

## Preview Deploys

Enable preview deploys for PRs from feature branches when you need isolated review environments. Each PR gets a temporary URL for testing before merge.

## Per-App Configuration

### Base Directory

Set **Base Directory** per app/service in the monorepo:

| App/Service | Base Directory |
|-------------|----------------|
| Studio | `apps/studio` |
| API Gateway | **Repo root** (compose / `Dockerfile.api-gateway` uses pnpm + `workspace:*`; do not set base dir to `apps/api-gateway` for the gateway image) |
| Orchestrator | `.` (repo root) |
| Full stack (Compose) | `.` (repo root) |

For the full Docker Compose stack (Contabo/Coolify), use repo root with compose path `infra/docker/docker-compose.yml`. See `infra/docker/README.md`.

### Watch Paths

Configure **Watch Paths** so changes redeploy only the affected service(s):

| App/Service | Watch Paths |
|-------------|-------------|
| Studio | `apps/studio/**`, `packages/shared-ui/**`, `packages/core-types/**` |
| API Gateway | `apps/api-gateway/**`, `packages/**` |
| Orchestrator | `services/orchestrator/**`, `packages/**` |
| Agent Runtime | `services/agent-runtime/**`, `packages/**` |
| Storage | `services/storage/**` |
| Compile | `services/compile/**` |
| Audit | `services/audit/**` |
| Simulation | `services/simulation/**` |
| Deploy | `services/deploy/**` |

Studio changes redeploy Studio only. API changes redeploy API only. Service changes redeploy only the affected service(s).

## Full Stack (Docker Compose)

For the full stack on a single VPS:

- **Base Directory**: `/` (repo root)
- **Compose path**: `infra/docker/docker-compose.yml`
- **Custom Build**: `docker compose -f infra/docker/docker-compose.yml build`
- **Custom Start**: `docker compose -f infra/docker/docker-compose.yml up -d`
- **Disable** Git submodules and LFS in Advanced > Git (Coolify #4746)
- Set env vars in Shared Env

See `infra/docker/README.md` and `infra/docker/docker-compose.yml` for details.

## SSE Proxy Timeout

For the agent discussion SSE stream (long runs 10+ min), set:

- Nginx: `proxy_read_timeout 660s` for `/api/v1/streaming/`
- API Gateway: `PROXY_TIMEOUT_MS=660000` in Shared Env

See `infra/docker/README.md`.
