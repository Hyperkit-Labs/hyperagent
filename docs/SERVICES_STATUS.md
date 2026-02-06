# HyperAgent Services Status

## Active Services

| Service | Port | Purpose |
|---------|------|---------|
| **Python Backend** | 8000 | REST API, WebSocket, orchestration |
| **Frontend** | 3000 | User interface |
| **x402 Verifier** | 3002 | Payment verification |
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Cache and events |
| **MLflow** | 5000 | Model tracking |

## Quick Commands

### Start All Services
```bash
docker compose up -d
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
docker compose logs -f x402-verifier
```

### Health Checks
```bash
# Python Backend
curl http://localhost:8000/api/v1/health/basic

# x402 Verifier
curl http://localhost:3002/health

# Frontend
curl http://localhost:3000
```

## Development

### Python Backend
```bash
cd hyperagent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn hyperagent.api.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### x402 Verifier
```bash
cd services/x402-verifier
npm install
npm run dev
```

## Architecture

See `docs/ARCHITECTURE_SIMPLIFIED.md` for complete architecture overview.
