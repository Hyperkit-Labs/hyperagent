# Redis

Redis is used by the API gateway for rate limiting. No queues or Celery workers.

## Usage

| Consumer | Purpose |
|----------|---------|
| `apps/api-gateway` | Rate limit by IP and optionally by userId. Key pattern: `rl:ip:{ip}`, `rl:user:{userId}`. Window 60s; max 100/ip, 200/user (configurable). Stricter for POST `/api/v1/workspaces/current/llm-keys` (10/ip, 5/user). |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Production: yes. Dev: no. | Connection string (e.g. `redis://localhost:6379/0`). Use `rediss://` for TLS (Redis Cloud). |
| `RATE_LIMIT_WINDOW_SEC` | No | Window in seconds (default: 60). |
| `RATE_LIMIT_MAX_IP` | No | Max requests per IP per window (default: 100). |
| `RATE_LIMIT_MAX_USER` | No | Max requests per user per window (default: 200). |

## Local development

- **With Redis:** `make up` starts Redis (Docker). Set `REDIS_URL=redis://localhost:6379/0`.
- **Without Redis:** Leave `REDIS_URL` empty. Rate limiting is skipped. Gateway refuses to start in production without Redis.

## Troubleshooting

See `docs/troubleshooting.md` for Redis connection errors and TLS (`rediss://`) notes.
