# HyperAgent smoke

Quick sanity check before opening a PR.

**Run from repo root:**

```bash
bash tools/scripts/smoke/smoke.sh
```

- **Backend:** unit tests in `apps/hyperagent-api` (in-memory SQLite). If you see a pytest plugin error (e.g. web3/eth_typing), run with `SKIP_BACKEND=1`.
- **Frontend:** `pnpm install` + `pnpm --filter hyperagent-web run build`. Lint/typecheck are not run here; use `pnpm --filter hyperagent-web run lint` and `run typecheck` separately when fixing those.

**Optional:** `SKIP_FRONTEND=1` or `SKIP_BACKEND=1` to run only one phase.

**CI:** Full lint, typecheck, and tests run in `.github/workflows/pr-validation.yml` and `ci.yml`. Health endpoint: `GET /api/v1/health/` (see runbooks).
