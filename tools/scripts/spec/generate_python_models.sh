#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SCHEMA_FILE="$ROOT_DIR/apps/api/schema/hyperagent_state.schema.json"
OUT_DIR="$ROOT_DIR/apps/api/hyperagent/core/generated_spec"
OUT_FILE="$OUT_DIR/hyperagent_state.py"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Missing schema file: $SCHEMA_FILE" >&2
  echo "Run: bash scripts/spec/generate_schema.sh" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

python -m pip install --upgrade pip >/dev/null
python -m pip install -r "$ROOT_DIR/apps/api/requirements.txt" >/dev/null

python -m datamodel_code_generator \
  --input "$SCHEMA_FILE" \
  --input-file-type jsonschema \
  --output "$OUT_FILE" \
  --output-model-type pydantic_v2.BaseModel \
  --use-standard-collections \
  --use-title-as-name \
  --reuse-model \
  --collapse-root-models

if [[ ! -f "$OUT_DIR/__init__.py" ]]; then
  cat > "$OUT_DIR/__init__.py" <<'EOF'
"""Generated spec models (do not edit by hand)."""
EOF
fi

echo "Wrote: apps/api/hyperagent/core/generated_spec/hyperagent_state.py"


