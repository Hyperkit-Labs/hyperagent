# Deployment Runbook

Public deployment and operations guide for HyperAgent.

---

## Build History Persistence

Workflows and runs persist in Supabase. Set these on the orchestrator service (e.g. `hyperagent-api` on Render):

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
