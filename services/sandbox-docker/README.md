# Docker Sandbox API

Runs on Contabo VPS. Accepts tarball URLs from the Render orchestrator, spawns ephemeral Docker containers, and returns preview URLs.

## Endpoints

- `POST /sandbox/create` - Create sandbox (requires `Authorization: Bearer <API_KEY>`)
- `DELETE /sandbox/{id}` - Stop sandbox
- `GET /preview/{id}` - Proxy to sandbox container
- `GET /health` - Health check

## Environment

| Variable | Description |
|----------|-------------|
| `OPENSANDBOX_API_KEY` | Secret for request validation |
| `PREVIEW_BASE_URL` | Base URL for preview links (e.g. `https://api.yourdomain.com`) |
| `SANDBOX_WORK_DIR` | Work directory for extracted projects (default: `/var/lib/sandbox-docker`) |

## Deploy

See `external/docs/Fixes/contabo-sandbox-deploy.md`.
