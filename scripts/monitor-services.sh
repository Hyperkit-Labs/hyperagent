#!/bin/bash
# Monitor HyperAgent services status

echo "=== HyperAgent Services Status ==="
echo ""

# Docker services
echo "📦 Docker Services:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker Compose not running"

echo ""
echo "🌐 Service Health Checks:"

# Frontend (Next.js)
echo -n "Frontend (http://localhost:3000): "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Python Backend
echo -n "Python Backend (http://localhost:8000): "
if curl -s http://localhost:8000/api/v1/health/basic > /dev/null 2>&1; then
    echo "✅ Running"
    curl -s http://localhost:8000/api/v1/health/basic | head -1
else
    echo "❌ Not responding"
fi

# TypeScript API
echo -n "TS API (http://localhost:4000): "
if curl -s http://localhost:4000/healthz > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# PostgreSQL
echo -n "PostgreSQL (localhost:5432): "
if docker compose exec -T postgres pg_isready -U hyperagent_user > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Redis
echo -n "Redis (localhost:6379): "
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

echo ""
echo "=== Recent Logs (last 5 lines) ==="
echo ""
echo "Backend logs:"
docker compose logs --tail=5 hyperagent 2>/dev/null || echo "No logs available"
echo ""
echo "Frontend logs:"
docker compose logs --tail=5 frontend 2>/dev/null || echo "No logs available (may be running outside Docker)"

