# Security audit stream (v1)

Central schema: `security_audit_log` with `schema_version`, `service`, `event_category`, `run_id`, `severity`, plus `event_type`, `event_data`, `user_id`, `request_id`, `ip_address`, `user_agent`.

## Sources

| Service        | Categories (examples)              | How it is emitted                                      |
|----------------|-------------------------------------|--------------------------------------------------------|
| api-gateway    | `auth`, `rate_limit`, `byok`        | `emitSecurityAuditV1FromGateway`, `emitAuditEvent`     |
| orchestrator   | `deploy`, `waiver`, `security_gate`| `emit_security_audit_v1` in workflows, waiver path     |

Structured JSON logs also carry `audit: true` or `security_audit_v1` for log pipelines.

## Grafana Loki (LogQL)

Filter orchestrator audit lines:

```logql
{app="hyperagent-orchestrator"} | json | audit == "true"
```

Gateway security_audit_v1 envelope:

```logql
{app="hyperagent-api-gateway"} | json | security_audit_v1 != ""
```

## Supabase

List recent rows (SQL):

```sql
select created_at, service, event_category, event_type, severity, run_id, user_id
from security_audit_log
where coalesce(schema_version, '') = 'security_audit_v1'
order by created_at desc
limit 100;
```

## Environment

- `SUPABASE_AUDIT_DISABLE`: set to `1` / `true` to skip orchestrator DB inserts (logs still emit).
- `WAIVER_SIGNING_SECRET`: HMAC secret for `POST /api/v1/runs/{run_id}/security-waivers` (orchestrator).

## Production networking

The default production compose file `infra/docker/docker-compose.yml` must not publish the orchestrator service to the host. Regression: `services/orchestrator/tests/unit/test_production_compose_networking.py`.
