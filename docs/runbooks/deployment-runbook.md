# Deployment Runbook

Public deployment and operations guide for HyperAgent.

---

## Redis (Rate Limit + LangGraph Checkpointer)

HyperAgent uses Redis for API rate limiting and LangGraph workflow checkpoints. On Contabo/Coolify, **local Redis** (colocated in docker-compose) is the recommended default.

| Variable | Required | Purpose |
|----------|----------|---------|
| `REDIS_URL` | Yes (prod) | Connection string. Use `redis://redis:6379` for local Redis in the stack. |

### Local Redis (Contabo/Coolify)

The production stack includes a Redis container. Set in Coolify Shared Env:

```env
REDIS_URL=redis://redis:6379
```

Redis is internal-only (no public ports). See `docs/redis-local.md`.

### Managed Redis

Use `rediss://` for TLS (Redis Cloud, Upstash). Remove or disable the `redis` service in compose if using managed Redis.

---

## Build History Persistence

Workflows and runs persist in Supabase. Set these on the orchestrator service (e.g. `api-gateway` or `orchestrator` in Contabo/Coolify):

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Database connection |
| `SUPABASE_SERVICE_KEY` | Yes | Service role for writes |

Without both, the store falls back to in-memory only; data is lost on restart.

---

## Security Feed (Zero-Day Resilience)

The security feed fetches recent exploit advisories and indexes them for the DesignAgent. When configured, it improves spec generation by avoiding known exploit patterns.

### Environment Variables

| Variable | Description |
|----------|--------------|
| `DEFILLAMA_FEED_URL` | DeFiLlama hacks API (default: https://api.llama.fi/hacks). Public, no auth. |
| `SECURITY_FEED_TIMEOUT` | Request timeout in seconds (default: 10) |
| `SECURITY_FEED_MAX_EXPLOITS` | Max exploits to fetch per source (default: 5) |

### Enabling the Feed

1. DeFiLlama feed works out of the box. Set `DEFILLAMA_FEED_URL` to override.
2. Run `python security_feed.py` on a schedule (cron) or call `update_feed()` from a scheduler.
3. The feed indexes advisories into RAG; DesignAgent uses them when generating specs.

### Cron Example

```bash
# Every 6 hours
0 */6 * * * cd /app && python -m services.orchestrator.security_feed
```

---

## SCV Sync (Weekly Vulnerability Dataset)

The SCV sync loads the Smart Contract Vulnerability Dataset from Hugging Face into RAG for security context injection. Set `SCV_SYNC_ENABLED=true` to enable.

### Cron Example

```bash
# Weekly (Sunday midnight)
0 0 * * 0 cd /app && python -m services.orchestrator.scv_sync
```
