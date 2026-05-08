#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TRIMMED_SCHEMA_PATH="/tmp/hyperagent-schemathesis-public-openapi.json"
HOST="127.0.0.1"
PORT="8010"
BASE_URL="http://${HOST}:${PORT}"

cd "$ROOT_DIR/services/orchestrator"

export PYTHONPATH="${PYTHONPATH:-}:$(pwd)"
export HYPERAGENT_ROOT="$ROOT_DIR"

python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["HYPERAGENT_ROOT"])
source = root / "packages" / "api-contracts" / "openapi" / "openapi.json"
target = Path("/tmp/hyperagent-schemathesis-public-openapi.json")
allowed = {
    "/api/v1/config",
    "/api/v1/networks",
    "/api/v1/tokens/stablecoins",
}
doc = json.loads(source.read_text(encoding="utf-8"))
doc["paths"] = {path: value for path, value in (doc.get("paths") or {}).items() if path in allowed}
target.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

python3 -m uvicorn main:app --host "$HOST" --port "$PORT" >/tmp/hyperagent-schemathesis-server.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS "$BASE_URL/health/live" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

st run \
  "$TRIMMED_SCHEMA_PATH" \
  --url "$BASE_URL" \
  --header 'X-Gateway-Proxy: 1' \
  --include-method GET \
  --mode all \
  --phases coverage \
  --max-examples 5 \
  --report junit \
  --report-junit-path "$ROOT_DIR/schemathesis.junit.xml"
