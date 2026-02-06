#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

bash "$ROOT_DIR/scripts/spec/generate_schema.sh"
bash "$ROOT_DIR/scripts/spec/generate_python_models.sh"

cd "$ROOT_DIR"

if ! git diff --exit-code -- apps/api/schema/hyperagent_state.schema.json apps/api/hyperagent/core/generated_spec/hyperagent_state.py; then
  echo "Spec drift detected. Regenerate and commit the outputs:" >&2
  echo "  bash scripts/spec/generate_schema.sh" >&2
  echo "  bash scripts/spec/generate_python_models.sh" >&2
  exit 1
fi

echo "No spec drift detected."


