#!/usr/bin/env bash
# Production image build with bounded BuildKit parallelism so Coolify / docker build
# does not saturate a small VPS next to running containers. Prefer CI registry builds when possible.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export DOCKER_BUILDKIT_MAX_PARALLELISM="${DOCKER_BUILDKIT_MAX_PARALLELISM:-${COMPOSE_VPS_BUILD_PARALLELISM:-2}}"
exec docker compose --project-directory . \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.resource-limits.yml \
  build "$@"
