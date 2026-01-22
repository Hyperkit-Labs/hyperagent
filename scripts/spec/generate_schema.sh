#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

mkdir -p "$ROOT_DIR/schema"

pushd "$ROOT_DIR/ts/orchestrator" >/dev/null
  npm install
  npm run schema:generate
popd >/dev/null

echo "Wrote: schema/hyperagent_state.schema.json"


