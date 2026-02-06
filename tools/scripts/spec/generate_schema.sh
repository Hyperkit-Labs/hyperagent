#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

mkdir -p "$ROOT_DIR/apps/api/schema"

pushd "$ROOT_DIR/services/orchestrator" >/dev/null
  npm install
  npm run schema:generate
popd >/dev/null

echo "Wrote: apps/api/schema/hyperagent_state.schema.json"


