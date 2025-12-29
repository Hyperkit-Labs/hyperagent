# HyperAgent Complete Startup Guide

This guide ensures all services start correctly and helps troubleshoot common issues.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Git installed

## Complete Startup Steps

### Step 1: Start Backend Services

```bash
# Navigate to project root
cd /path/to/Hyperkit_agent

# Start all backend services
docker-compose up -d

# Verify services are running
docker-compose ps
```

**Expected Output:**
```
NAME                IMAGE               STATUS
hyperagent_app      hyperagent:latest   Up (healthy)
postgres            postgres:15         Up
redis               redis:7-alpine      Up
mlflow              mlflow-server       Up
x402-verifier       x402-verifier       Up
```

### Step 2: Verify Backend Health

```bash
# Test backend API
curl http://localhost:8000/api/v1/x402/deployments/deploy -X POST

# Should return validation error (proving it works):
# {"detail":[{"type":"missing","loc":["body","compiled_contract"]...
```

If you get "Connection refused", check logs:

```bash
docker-compose logs hyperagent --tail 50
```

### Step 3: Configure Frontend Environment

Create `frontend/.env.local`:

```bash
cd frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id_here
EOF
```

### Step 4: Start Frontend

```bash
# In the frontend directory
npm install  # First time only
npm run dev
```

**Expected Output:**
```
▲ Next.js 16.0.7
- Local:        http://localhost:3000
- Ready in 2.3s
```

### Step 5: Verify Complete Stack

Open browser and check:

1. **Frontend:** http://localhost:3000
2. **Backend API Docs:** http://localhost:8000/docs
3. **MLflow UI:** http://localhost:5000

## Service-by-Service Verification

### Backend (Port 8000)

```bash
# Quick health check
curl http://localhost:8000/docs | grep -o "Swagger UI"

# Test workflow creation
curl -X POST http://localhost:8000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "nlp_input": "Create a simple ERC20 token",
    "network": "avalanche_fuji",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

### PostgreSQL Database

```bash
docker-compose exec postgres psql -U hyperagent -d hyperagent -c "\dt"
```

Expected tables:
- `workflows`
- `contracts`
- `deployments`
- `spending_controls`
- `alembic_version`

### Redis Cache

```bash
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### MLflow Tracking

```bash
curl http://localhost:5000/health
# Should return MLflow health status
```

### x402 Verifier

```bash
curl http://localhost:3001/health
# Should return x402 verifier health
```

## Common Startup Issues

### Issue: Backend container keeps restarting

**Check logs:**
```bash
docker-compose logs hyperagent --tail 100
```

**Common causes:**
- Import errors (missing dependencies)
- Database connection failed
- Invalid environment variables

**Solution:**
```bash
# Rebuild without cache
docker-compose build --no-cache hyperagent
docker-compose up -d hyperagent
```

### Issue: Database connection error

**Error:** `psycopg.OperationalError: connection to server failed`

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# If not running, start it
docker-compose up -d postgres

# Wait 5 seconds, then restart backend
sleep 5
docker-compose restart hyperagent
```

### Issue: Frontend can't connect to backend

**Error in console:** `Failed to fetch` or `Network error`

**Solution:**
```bash
# Verify backend is accessible
curl http://localhost:8000/docs

# If no response, check Docker logs
docker-compose logs hyperagent --tail 50

# Restart backend
docker-compose restart hyperagent
```

### Issue: Port already in use

**Error:** `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution:**
```bash
# Find what's using the port
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Stop the conflicting service or change port in docker-compose.yml
```

### Issue: WebSocket connection fails

**Error in console:** `WebSocket error: {}`

**Solution:** This is usually harmless. WebSocket will retry automatically. If persistent:

1. Check WebSocket URL in frontend: `ws://localhost:8000`
2. Verify backend has WebSocket support enabled
3. Check browser console for detailed error messages

## Environment Variables Reference

### Backend (.env in root)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://hyperagent:password@postgres:5432/hyperagent

# Redis
REDIS_URL=redis://redis:6379/0

# AI Services
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here

# Blockchain
ALCHEMY_API_KEY=your_key_here
QUICKNODE_API_KEY=your_key_here

# Server Wallet (for gasless deployments)
SERVER_WALLET_PRIVATE_KEY=your_private_key_here
THIRDWEB_SECRET_KEY=your_secret_key_here

# x402 Payment
X402_ENABLED=true
X402_ENABLED_NETWORKS=avalanche_fuji,mantle_sepolia
```

### Frontend (.env.local in frontend/)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

## Stopping Services

### Stop all services:
```bash
docker-compose down
```

### Stop but keep data:
```bash
docker-compose stop
```

### Stop and remove all data:
```bash
docker-compose down -v
```

## Rebuilding After Code Changes

### Backend changes:
```bash
docker-compose up -d --build hyperagent
```

### Frontend changes:
Frontend auto-reloads in dev mode. Just save the file.

## Production Considerations

For production deployments:

1. **Use production database** (not Docker PostgreSQL)
2. **Set proper CORS origins** in `hyperagent/api/main.py`
3. **Use environment-specific .env files**
4. **Enable HTTPS** for frontend and backend
5. **Use wss:// for WebSocket** (not ws://)
6. **Configure proper secrets management**
7. **Enable rate limiting and monitoring**

## Quick Reference

```bash
# Start everything
docker-compose up -d && cd frontend && npm run dev

# Check backend logs
docker-compose logs -f hyperagent

# Restart backend
docker-compose restart hyperagent

# Rebuild backend
docker-compose up -d --build hyperagent

# Stop everything
docker-compose down && pkill -f "npm run dev"
```

## Getting Help

If issues persist:

1. Check `docs/fixes/` for specific error solutions
2. Review Docker logs for detailed errors
3. Verify all environment variables are set
4. Check that all required ports are available (8000, 3000, 5432, 6379, 5000, 3001)

