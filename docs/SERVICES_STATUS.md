# HyperAgent Services Status Monitor

**Last Updated**: January 27, 2026

## Service Status

### ✅ Running Services

| Service | Port | Status | Health |
|---------|------|--------|--------|
| **Frontend (Next.js)** | 3000 | ✅ Running | ✅ Healthy |
| **PostgreSQL** | 5432 | ✅ Running | ✅ Healthy |
| **Redis** | 6379 | ✅ Running | ✅ Healthy |
| **MLflow** | 5000 | ✅ Running | ⚠️ No health check |
| **x402 Verifier** | 3002 | ✅ Running | ✅ Healthy |

### ⚠️ Issues

| Service | Port | Status | Issue |
|---------|------|--------|-------|
| **Python Backend** | 8000 | ⚠️ Unhealthy | Child processes dying - check logs |
| **TS Orchestrator API** | 4000 | ❌ Not Started | Needs to be started manually |

## Quick Commands

### Start All Services
```bash
make up
# or
docker compose up -d
```

### Start TS Orchestrator API
```bash
docker compose up ts-orchestrator -d
```

### Check Status
```bash
docker compose ps
bash scripts/monitor-services.sh
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f hyperagent
docker compose logs -f ts-orchestrator
```

### Health Checks
```bash
# Python Backend
curl http://localhost:8000/api/v1/health/basic

# TS API
curl http://localhost:4000/healthz

# Frontend
curl http://localhost:3000
```

## Frontend Dev Server

Frontend is running outside Docker:
- **Status**: ✅ Running on port 3000
- **Command**: `cd frontend && npm run dev`
- **URL**: http://localhost:3000

## Next Steps

1. ✅ Frontend: Running and accessible
2. ⚠️ Backend: Fix health check issue
3. ⚠️ TS API: Start ts-orchestrator service
4. ✅ Database: Healthy
5. ✅ Redis: Healthy

---

**Monitor Script**: `bash scripts/monitor-services.sh`

