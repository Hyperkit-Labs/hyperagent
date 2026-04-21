#!/usr/bin/env bash
# Start the Contabo production stack from repo root. Uses .env by default; override with COMPOSE_ENV_FILE.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
export DOCKER_BUILDKIT_MAX_PARALLELISM="${DOCKER_BUILDKIT_MAX_PARALLELISM:-${COMPOSE_VPS_BUILD_PARALLELISM:-2}}"
if [[ -f "$ENV_FILE" ]]; then
  exec docker compose --project-directory . --env-file "$ENV_FILE" \
    -f infra/docker/docker-compose.yml \
    -f infra/docker/docker-compose.resource-limits.yml \
    up -d "$@"
fi
exec docker compose --project-directory . \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.resource-limits.yml \
  up -d "$@"
