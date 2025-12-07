# HyperAgent DevOps & SRE Guide

This document covers CI/CD pipelines, environment management, monitoring, scaling strategies, and incident response procedures for HyperAgent.

## Table of Contents

1. [CI/CD Pipeline Status](#cicd-pipeline-status)
2. [Environment Management](#environment-management)
3. [Monitoring Setup](#monitoring-setup)
4. [Scaling Strategies](#scaling-strategies)
5. [Health Checks and Alerting](#health-checks-and-alerting)
6. [Incident Response Procedures](#incident-response-procedures)
7. [Database Management](#database-management)
8. [Docker and Containerization](#docker-and-containerization)

---

## CI/CD Pipeline Status

### Current State [Adopted]

**Docker Compose Development Stack**: Running locally for development

- **Location**: `docker-compose.yml`
- **Services**: hyperagent, postgres, redis, prometheus, x402-verifier
- **Status**: Fully functional for local development

### GitHub Actions CI/CD [Adopted]

**Status**: Fully implemented and running

**Features**:
- ✅ Automated unit and integration tests on PR
- ✅ Code quality checks (Black, isort, mypy)
- ✅ Security scanning (Bandit, Trivy)
- ✅ Docker image building and publishing
- ✅ Docker Compose integration tests
- ✅ Coverage reporting

**Workflow**: `.github/workflows/ci.yml`

**Deployment Workflow**: `.github/workflows/deploy.yml` (staging/production)

**Pre-commit Hooks**: `.pre-commit-config.yaml` for local code quality checks

---

## Environment Management

### Environment Types [Adopted]

| Environment | Purpose | Database | Redis | Monitoring |
|-------------|---------|---------|-------|------------|
| **Development** | Local development | Docker PostgreSQL | Docker Redis | Prometheus (optional) |
| **Staging** | Pre-production testing | Supabase (cloud) | Redis Cloud (optional) | Prometheus |
| **Production** | Live service | Supabase (cloud) | Redis Cloud | Prometheus |

### Environment Variables

**Required Variables**: See `env.example` for complete list

**Key Variables**:
```bash
# Application
LOG_LEVEL=INFO
DEBUG=false
API_WORKERS=4

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Redis
REDIS_URL=redis://localhost:6379/0

# x402 Configuration
X402_ENABLED=true
X402_ENABLED_NETWORKS=avalanche_fuji,avalanche_mainnet
X402_SERVICE_URL=http://x402-verifier:3001

# Thirdweb (for ERC4337)
THIRDWEB_CLIENT_ID=your-client-id
THIRDWEB_SECRET_KEY=your-secret-key
THIRDWEB_SERVER_WALLET_ADDRESS=0x...
```

### Environment-Specific Configuration

**Development** (`docker-compose.yml`):
- All services run in Docker containers
- Local PostgreSQL and Redis
- Prometheus for metrics collection
- Hot reload enabled for code changes

**Staging/Production**:
- Supabase for managed PostgreSQL
- Redis Cloud for managed Redis (optional)
- Direct Python execution (no Docker)
- Environment variables from hosting platform (Render, VPS, etc.)

**Reference**: `GUIDE/SIMPLIFIED_SETUP.md` for production deployment instructions

---

## Monitoring Setup

### Prometheus Metrics [Adopted]

**Status**: Running in docker-compose, accessible at `http://localhost:9090`

**Configuration**: `config/prometheus/prometheus.yml`

```yaml
scrape_configs:
  - job_name: 'hyperagent'
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics/prometheus'
    static_configs:
      - targets: ['hyperagent:8000']
```

**Metrics Endpoint**: `/api/v1/metrics/prometheus`

**Key Metrics**:
- HTTP request duration and count
- Workflow execution time
- Service error rates
- Database query performance
- Redis operation latency

**Implementation**: `hyperagent/monitoring/metrics.py`

### Health Checks [Adopted]

**Health Endpoint**: `/api/v1/health`

**Response Format**:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected",
    "x402_verifier": "connected"
  },
  "timestamp": "2025-12-04T10:00:00Z"
}
```

**Docker Health Checks**: Configured in `docker-compose.yml`

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Logging [Adopted]

**Log Levels**: DEBUG, INFO, WARN, ERROR

**Structured Logging**: JSON format for production

**Log Locations**:
- Development: `logs/` directory
- Production: Platform-specific (Render logs, VPS syslog)

**Implementation**: `hyperagent/core/logging.py`

### Grafana [Removed]

**Status**: Grafana has been removed from the monitoring stack per team decision.

**Alternative**: Use Prometheus UI directly at `http://localhost:9090` for querying metrics and creating basic visualizations.

**Future**: Consider adding Grafana back if visualization needs grow, or use hosted monitoring solutions (Datadog, New Relic, etc.).

---

## Scaling Strategies

### Horizontal Scaling [Planned]

**Current**: Single instance deployment

**Planned Approach**:
- Multiple FastAPI worker instances behind load balancer
- Shared Redis for event bus and caching
- Shared PostgreSQL database (Supabase)
- Stateless application design (no local state)

**Scaling Considerations**:
- All services must be stateless
- Use Redis for shared state (workflow status, cache)
- Database connection pooling (SQLAlchemy)
- WebSocket connections may require sticky sessions

### Vertical Scaling [Adopted]

**Current**: Adjust `API_WORKERS` environment variable

```bash
# Increase workers for more concurrent requests
API_WORKERS=8
```

**Uvicorn Configuration**:
```bash
uvicorn hyperagent.api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers ${API_WORKERS:-4}
```

### Database Scaling [Adopted]

**Current**: Supabase managed PostgreSQL

**Scaling Options**:
- Supabase auto-scaling (managed)
- Connection pooling (PgBouncer via Supabase)
- Read replicas for read-heavy workloads (future)

### Caching Strategy [Adopted]

**Redis Usage**:
- Event bus (Redis Streams)
- Workflow status cache
- LLM response cache
- Contract template cache

**Cache TTL**:
- Workflow status: 5 minutes
- LLM responses: 1 hour
- Contract templates: 24 hours

---

## Health Checks and Alerting

### Health Check Endpoints [Adopted]

**Application Health**: `GET /api/v1/health`

**Service Health Checks**:
- Database connectivity
- Redis connectivity
- x402-verifier service availability

**Implementation**: `hyperagent/api/routes/health.py`

### Alerting [Planned]

**Current**: Manual monitoring via Prometheus UI

**Planned Alerting**:
- Prometheus Alertmanager integration
- Email/Slack notifications for:
  - Service downtime
  - High error rates (>5% for 5 minutes)
  - Database connection failures
  - High response times (p95 > 2s)

**Example Alert Rules** (planned):
```yaml
# config/prometheus/alerts.yml (planned)
groups:
  - name: hyperagent_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
```

---

## Incident Response Procedures

### Incident Severity Levels [Adopted - Review]

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| **P0 - Critical** | Service completely down | Immediate | Database unavailable, all workflows failing |
| **P1 - High** | Major feature broken | 1 hour | x402 payments failing, deployment errors |
| **P2 - Medium** | Minor feature broken | 4 hours | Specific network not working |
| **P3 - Low** | Cosmetic issue | Next business day | UI typo, minor performance degradation |

### Incident Response Steps [Adopted - Review]

1. **Identify**: Check health endpoint, Prometheus metrics, logs
2. **Assess**: Determine severity and impact
3. **Mitigate**: 
   - Restart service if needed
   - Rollback deployment if recent change
   - Scale up resources if overloaded
4. **Communicate**: Update team via Slack/email
5. **Resolve**: Fix root cause
6. **Post-Mortem**: Document incident and prevention measures

### Rollback Procedures [Adopted]

**Database Migrations**:
```bash
# Rollback last migration
alembic downgrade -1

# Rollback to specific revision
alembic downgrade <revision>
```

**Application Rollback**:
- Render: Use rollback feature in dashboard
- VPS: Git checkout previous version, restart service
- Docker: Rebuild with previous image tag

**Reference**: `scripts/rollback.py` for automated rollback scripts

---

## Database Management

### PostgreSQL Setup [Adopted]

**Development**: Docker container with pgvector extension

**Production**: Supabase managed PostgreSQL

**Connection String Format**:
```
postgresql://user:password@host:5432/dbname
```

### Database Migrations [Adopted]

**Tool**: Alembic

**Migration Commands**:
```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

**Migration Files**: `alembic/versions/`

**Reference**: `alembic.ini` for configuration

### Backup and Recovery [Adopted]

**Development**: Docker volume backups

**Production**: Supabase automated backups (daily)

**Manual Backup**:
```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore database
psql $DATABASE_URL < backup_20251204.sql
```

**Reference**: `scripts/backup_database.py` for automated backups

### Database Performance [Adopted]

**Connection Pooling**: SQLAlchemy connection pool

**Query Optimization**:
- Use indexes on frequently queried columns
- Avoid N+1 queries (use eager loading)
- Monitor slow queries via Prometheus

**Monitoring**: Prometheus metrics for query duration and connection pool usage

---

## Docker and Containerization

### Docker Compose Setup [Adopted]

**File**: `docker-compose.yml`

**Services**:
- `hyperagent`: Main FastAPI application
- `postgres`: PostgreSQL 15 with pgvector
- `redis`: Redis 7.4-alpine
- `prometheus`: Metrics collection
- `x402-verifier`: TypeScript x402 verification service

### Dockerfile [Adopted]

**File**: `Dockerfile`

**Base Image**: `python:3.10-slim`

**Build Process**:
```bash
# Build image
docker build -t hyperagent:latest .

# Run container
docker run -p 8000:8000 --env-file .env hyperagent:latest
```

### Container Health Checks [Adopted]

All services include health checks in `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Production Deployment [Adopted]

**Note**: Docker Compose is for **development only**

**Production Options**:
1. **Render**: Direct Python execution (see `render.yaml`)
2. **VPS**: Direct Python execution with systemd service
3. **Kubernetes**: [Planned] For future multi-instance deployments

**Reference**: `GUIDE/SIMPLIFIED_SETUP.md` for production deployment instructions

---

## Additional Resources

- [Engineering Standards](./ENGINEERING_STANDARDS.md) - Code quality and testing
- [Architecture Guide](./ARCHITECTURE_GUIDE.md) - System architecture
- [Deployment Guide](../GUIDE/DEPLOYMENT.md) - Detailed deployment instructions
- [Docker Guide](../GUIDE/DOCKER.md) - Docker setup and usage

