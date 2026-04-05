# Deployment runbook

High-level checklist for operators shipping HyperAgent components. Adjust for your environment (Vercel, Kubernetes, Docker Compose, and so on).

## Preconditions

- [ ] Read [Deploy ownership](deploy-ownership.md) (who signs deploys, what runs in Studio vs backend).
- [ ] Confirm **secrets** are in the vault or host environment, not in the repo (see `.env.example` and `SECURITY.md`).
- [ ] **Supabase** migrations applied for the target project.
- [ ] **Redis**: gateway rate limits (Upstash REST) and orchestrator queue/checkpointer (`REDIS_URL`) configured per `production.mdc` / `.env.example`.

## Release order (typical)

1. **Shared packages** (if versioned): build and publish or bump workspace versions as your pipeline requires.
2. **Orchestrator and workers**: deploy after DB and Redis are reachable.
3. **API gateway**: deploy with correct upstream orchestrator URL and CORS.
4. **Studio (Next.js)**: deploy with `NEXT_PUBLIC_*` pointing at the gateway and public config.

## Smoke checks

- [ ] Health endpoints for gateway and orchestrator respond.
- [ ] Studio loads, wallet connect works in a staging wallet.
- [ ] A dry-run or test workflow can start without 5xx from core APIs.

## Rollback

- Revert to the previous container image or Vercel deployment.
- If a migration ran forward-only, follow the migration’s downgrade notes or restore DB from backup (runbook-specific).

## Related automation

- GitHub Actions workflows under `.github/workflows/` (for example `deploy-staging.yml`, `ci.yml`).
- Kustomize or Helm under `infra/` when used by your cluster.
