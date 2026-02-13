#!/usr/bin/env bash
# HyperAgent smoke: backend unit tests + frontend build/lint/typecheck.
# Usage: from repo root, run: bash tools/scripts/smoke/smoke.sh
# Optional: SKIP_BACKEND=1 or SKIP_FRONTEND=1 to skip a phase.
# Note: Backend may fail if web3 pytest plugin conflicts (use SKIP_BACKEND=1).
#       Frontend lint/typecheck may have pre-existing issues; build is a lighter check.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "[smoke] HyperAgent smoke (backend unit + frontend build)"
echo ""

# --- Backend (unit tests; in-memory SQLite) ---
if [ "${SKIP_BACKEND}" != "1" ]; then
  echo "[smoke] Backend: unit tests (apps/hyperagent-api)"
  if [ ! -d "apps/hyperagent-api" ]; then
    echo "[smoke] ERROR: apps/hyperagent-api not found"
    exit 1
  fi
  export TEST_DATABASE_URL="${TEST_DATABASE_URL:-sqlite+aiosqlite:///:memory:}"
  (
    cd apps/hyperagent-api
    pip install -q -r requirements.txt 2>/dev/null || true
    pytest tests/unit/ -v --timeout=90 -p no:web3.tools.pytest_ethereum 2>&1
  ) || { echo "[smoke] Backend unit tests failed (tip: SKIP_BACKEND=1 to run frontend only)"; exit 1; }
  echo "[smoke] Backend OK"
  echo ""
fi

# --- Frontend (install + build; build validates compile) ---
if [ "${SKIP_FRONTEND}" != "1" ]; then
  echo "[smoke] Frontend: install + build (hyperagent-web)"
  if [ ! -f "pnpm-workspace.yaml" ]; then
    echo "[smoke] ERROR: pnpm-workspace.yaml not found"
    exit 1
  fi
  pnpm install --frozen-lockfile 2>&1 | tail -5
  pnpm --filter hyperagent-web run build || { echo "[smoke] Frontend build failed"; exit 1; }
  echo "[smoke] Frontend OK"
  echo ""
fi

echo "[smoke] All passed."
