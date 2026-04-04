# Observability stack (local / staging)

Docker Compose brings up:

| Component | Role | Host port (default) |
|-----------|------|---------------------|
| **OpenTelemetry Collector** | OTLP gRPC/HTTP in; forwards traces, metrics, logs | 4317, 4318, 8889 |
| **Grafana Tempo** | Trace backend | internal |
| **Grafana Loki** | Log backend | 3100 |
| **Prometheus** | Metrics scrape + rules | 9090 |
| **Alertmanager** | Alert routing | 9093 |
| **Grafana** | Dashboards (datasources + dashboards as code) | 3030 |
| **Promtail** | Docker log shipping → Loki | optional profile |

**Jaeger** is not included: traces are stored in **Tempo** and viewed in Grafana (TraceQL / Explore). To use Jaeger UI instead, run a Jaeger all-in-one and point the collector’s trace exporter at its OTLP endpoint.

## Run

From the repository root:

```bash
docker compose -f infra/observability/docker-compose.yml up -d
```

Optional **Promtail** (Linux host with Docker socket):

```bash
docker compose -f infra/observability/docker-compose.yml --profile docker-logs up -d
```

## Application wiring

1. **OTLP** — point services at the collector (HTTP example):

   ```bash
   OPENTELEMETRY_ENABLED=1
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   OTEL_SERVICE_NAME=hyperagent-orchestrator
   ```

   Metrics use the same base URL with path `/v1/metrics` unless `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` is set.

2. **Sentry** — set `SENTRY_DSN` (backend) and `NEXT_PUBLIC_SENTRY_DSN` (browser) in `.env`. See root `.env.example`.

3. **Grafana** — open `http://localhost:3030` (default user/password `admin` / `admin` unless overridden with `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`).

Prometheus: `http://localhost:9090`. Alertmanager UI: `http://localhost:9093`.

## Dashboards and alerts as code

- Grafana datasources: `grafana/provisioning/datasources/`
- Grafana dashboard provisioning: `grafana/provisioning/dashboards/`
- Dashboard JSON: `grafana/dashboards/`
- Prometheus rules: `prometheus/alerts/`
- Alertmanager: `alertmanager/alertmanager.yml` — replace receivers with Slack, PagerDuty, or webhooks for production.

## Production notes

- Do not expose Grafana, Prometheus, or Alertmanager without authentication and network policy.
- Tune retention (`tempo`, `loki`, Prometheus `storage.tsdb.retention.time`).
- For managed offerings, you can skip this Compose stack and keep the same OTLP and Sentry environment variables pointed at your vendor endpoints.
