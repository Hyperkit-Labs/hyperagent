# Docker & Containerization Guide

**Comprehensive Reference Guide** - Complete Docker documentation for development and production.

> 🚀 **For quick start**, see [Docker Quick Start Guide](../README.DOCKER.md) - get running in minutes with Make commands.

This guide covers Docker architecture, Dockerfile details, production deployment, CI/CD integration, and best practices.

## Quick Start

### Development (All-in-One Setup)

**Recommended: Use Make commands** (see [Quick Start Guide](../README.DOCKER.md)):

```bash
make up-build    # Build and start all services
make logs        # View logs
make down        # Stop services
```

**Or use Docker Compose directly:**

```bash
# Start all services (Frontend, Backend, Database, Redis, x402 Verifier, Prometheus)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

> **Note**: The `docker-compose.yml` includes all 6 services. See [Quick Start Guide](../README.DOCKER.md) for complete service list and Make commands.

### Hybrid Development Setup (Recommended for Windows)

**Best Performance on Windows/WSL2** - Run backend services in Docker, frontend locally:

```bash
# Start only backend services (PostgreSQL, Redis, API, x402-verifier)
# Unix/Linux/Mac:
./scripts/start-backend.sh

# Windows:
scripts\start-backend.bat

# In a separate terminal, run frontend locally:
cd frontend && npm run dev
```

**Why Hybrid?**
- **3-5x faster** frontend development on Windows/WSL2
- Native file system performance for hot reload
- Backend services remain isolated and consistent
- Best of both worlds: speed + isolation

**Performance Comparison:**
| Setup | Initial Build | Hot Reload | File Watching |
|-------|--------------|------------|---------------|
| Full Docker | 15-30s | 500-2000ms | Slow (WSL2 overhead) |
| Hybrid | 5-10s | 50-200ms | Native (fast) |

See [Hybrid Setup Guide](#hybrid-development-setup) below for details.

### Production

```bash
# Build image
docker build -t hyperagent:latest .

# Start with production compose (if docker-compose.prod.yml exists)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

> **Note**: For production, we recommend direct Python execution (no Docker). See [Simplified Setup Guide](./SIMPLIFIED_SETUP.md).

## Dockerfile

### Multi-Stage Build

The Dockerfile uses a multi-stage build to minimize image size:

1. **Builder Stage**: Installs build dependencies and Python packages
2. **Runtime Stage**: Creates minimal runtime image with only necessary files

### Security Features

- **Non-root user**: Application runs as `hyperagent` user (not root)
- **Minimal base image**: Uses `python:3.10-slim` for smaller footprint
- **Health checks**: Built-in health monitoring
- **Read-only mounts**: Source code mounted read-only in development

### Image Optimization

- Layer caching for faster rebuilds
- `--no-install-recommends` to reduce package size
- Removed build dependencies in runtime stage
- `.dockerignore` to exclude unnecessary files

## Docker Compose

### Development Stack (`docker-compose.yml`)

**All-in-One Development Setup** - Includes all services for local development:

**Services:**
- `frontend`: Next.js frontend (port 3000)
- `hyperagent`: Main FastAPI application (port 8000)
- `postgres`: PostgreSQL database with pgvector (port 5432)
- `redis`: Redis cache and event bus (port 6379)
- `x402-verifier`: x402 payment verification service (port 3002)
- `prometheus`: Metrics and monitoring (port 9090)

**Features:**
- Hot reload with volume mounts (frontend and backend)
- Environment variable management
- Health checks for all services
- Automatic service dependencies
- Source code mounted for live development

> **Quick Start**: See [Docker Quick Start Guide](../README.DOCKER.md) for Make commands and step-by-step setup.

### Production Stack (`docker-compose.prod.yml`)

**Features:**
- Resource limits and reservations
- No source code mounts (uses image)
- Production environment variables
- Enhanced security settings

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# LLM
GEMINI_API_KEY=your_key_here

# Redis
REDIS_URL=redis://host:6379/0
```

### Optional Variables

See `.env.example` for complete list of configurable variables.

## Building Images

### Standard Build

```bash
docker build -t hyperagent:latest .
```

### Using Build Script

```bash
chmod +x scripts/docker_build.sh
./scripts/docker_build.sh
```

### Build Arguments

```bash
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t hyperagent:latest .
```

## Running Containers

### Development

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d hyperagent

# View logs
docker-compose logs -f hyperagent

# Execute commands
docker-compose exec hyperagent alembic upgrade head
```

### Production

```bash
# Run container
docker run -d \
  --name hyperagent \
  --env-file .env.production \
  -p 8000:8000 \
  hyperagent:latest
```

## Health Checks

### Application Health

```bash
# Check health endpoint
curl http://localhost:8000/api/v1/health/basic

# Check detailed health
curl http://localhost:8000/api/v1/health/detailed
```

### Container Health

```bash
# View container status
docker-compose ps

# Check health status
docker inspect hyperagent_app | grep Health -A 10
```

## Database Migrations

### Run Migrations

```bash
# Using Docker Compose
docker-compose exec hyperagent alembic upgrade head

# Using Makefile
make migrate
```

### Create Migration

```bash
docker-compose exec hyperagent alembic revision --autogenerate -m "description"
```

## Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f hyperagent

# Last 100 lines
docker-compose logs --tail=100 hyperagent
```

### Log Locations

- Container: `/app/logs/`
- Host: `./logs/` (mounted volume)

## Volumes

### Development Volumes

- `./hyperagent:/app/hyperagent:ro` - Source code (read-only)
- `./logs:/app/logs` - Application logs
- `./alembic:/app/alembic:ro` - Migration files

### Data Volumes

- `postgres_data` - PostgreSQL data persistence
- `redis_data` - Redis data persistence

## Networking

### Default Network

All services are connected to `hyperagent_network` bridge network.

### Service Discovery

Services can communicate using service names:
- `postgres:5432` - Database
- `redis:6379` - Redis cache

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs hyperagent

# Check health
docker-compose ps

# Restart services
docker-compose restart
```

### Database Connection Issues

```bash
# Verify database is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U hyperagent_user -d hyperagent_db
```

### Redis Connection Issues

```bash
# Verify Redis is running
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
```

### Permission Issues

```bash
# Fix log directory permissions
sudo chown -R $USER:$USER logs/
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update `.env.production` with production values
- [ ] Set strong passwords for database and Redis
- [ ] Configure JWT secret key
- [ ] Set up SSL/TLS certificates
- [ ] Configure resource limits
- [ ] Set up monitoring and logging

### Deployment Steps

1. **Build production image:**
   ```bash
   docker build -t hyperagent:latest .
   ```

2. **Tag for registry:**
   ```bash
   docker tag hyperagent:latest registry.example.com/hyperagent:latest
   ```

3. **Push to registry:**
   ```bash
   docker push registry.example.com/hyperagent:latest
   ```

4. **Deploy with compose:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Resource Limits

Production compose file includes resource limits:
- **HyperAgent**: 2 CPU, 2GB RAM
- **PostgreSQL**: 1 CPU, 1GB RAM
- **Redis**: 0.5 CPU, 512MB RAM

## Makefile Commands

**Quick Reference** - See [Docker Quick Start Guide](../README.DOCKER.md) for detailed usage.

```bash
make build          # Build Docker image
make up             # Start development stack
make up-build       # Build and start all services
make down           # Stop all services
make logs           # View logs (all services)
make logs-frontend  # View frontend logs
make logs-backend   # View backend logs
make logs-db        # View database logs
make logs-redis     # View Redis logs
make restart        # Restart services
make clean          # Remove containers and volumes
make test           # Run tests in container
make shell          # Open shell in container
make migrate        # Run database migrations
make health         # Check service health
```

> **Full Make Command Reference**: See [Docker Quick Start Guide](../README.DOCKER.md#additional-make-commands) for complete list and examples.

## Best Practices

1. **Use .env files**: Never commit secrets to version control
2. **Health checks**: Always configure health checks for services
3. **Resource limits**: Set appropriate limits in production
4. **Log rotation**: Configure log rotation to prevent disk fill
5. **Backup volumes**: Regularly backup data volumes
6. **Update images**: Keep base images updated for security
7. **Non-root user**: Always run containers as non-root user
8. **Read-only mounts**: Use read-only mounts where possible

## CI/CD Integration

Docker images are automatically built and pushed in CI/CD pipeline:

- **Build**: On every commit to main/develop
- **Tag**: With branch name, commit SHA, and `latest` (main only)
- **Push**: To GitHub Container Registry (ghcr.io)
- **Test**: Docker Compose integration tests run automatically

## Image Size Optimization

Current optimizations:
- Multi-stage build reduces final image size
- Minimal base image (python:3.10-slim)
- Removed build dependencies in runtime
- `.dockerignore` excludes unnecessary files

**Target**: < 500MB final image size

---

## Hybrid Development Setup

### Overview

The **Hybrid Setup** runs backend services in Docker while running the frontend locally. This provides the best performance on Windows/WSL2 systems where Docker volume mounts can be slow.

**Architecture:**
- ✅ **Backend in Docker**: PostgreSQL, Redis, FastAPI, x402-verifier, Prometheus
- ✅ **Frontend Local**: Next.js dev server running natively

### Why Use Hybrid Setup?

**Performance Benefits:**
- **3-5x faster** initial build times
- **10x faster** hot reload (50-200ms vs 500-2000ms)
- **Native file watching** (no WSL2 translation overhead)
- **Full system resources** for frontend (no memory limits)

**When to Use:**
- ✅ Windows/WSL2 development (recommended)
- ✅ Frontend-heavy development work
- ✅ Need fast iteration on UI components
- ✅ Local development with consistent backend

**When NOT to Use:**
- ❌ Need exact production environment match
- ❌ Cross-platform consistency required
- ❌ CI/CD testing scenarios

### Quick Start

**Step 1: Start Backend Services**

```bash
# Unix/Linux/Mac:
./scripts/start-backend.sh

# Windows:
scripts\start-backend.bat
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- HyperAgent API (port 8000)
- x402 Verifier (port 3002)
- Prometheus (port 9090)

**Step 2: Start Frontend Locally**

```bash
cd frontend
npm install  # First time only
npm run dev
```

**Step 3: Access Application**

- Frontend: http://localhost:3000
- API: http://localhost:8000/api/v1
- API Docs: http://localhost:8000/docs

### Script Options

**Start with logs:**
```bash
./scripts/start-backend.sh --logs
scripts\start-backend.bat --logs
```

**Stop services:**
```bash
./scripts/start-backend.sh --stop
scripts\start-backend.bat --stop
```

### Performance Comparison

| Metric | Full Docker | Hybrid Setup | Improvement |
|--------|-------------|--------------|-------------|
| Initial Build | 15-30s | 5-10s | **3x faster** |
| Hot Reload | 500-2000ms | 50-200ms | **10x faster** |
| File Watching | Slow (WSL2) | Native | **Native speed** |
| Memory Available | 2-4GB limit | Full system | **Unlimited** |

### Troubleshooting

**Frontend can't connect to API:**
- Ensure backend services are running: `docker-compose ps`
- Check API health: `curl http://localhost:8000/api/v1/health`
- Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local` (if used)

**Port conflicts:**
- Frontend port 3000: Change in `package.json` scripts or use `-p 3001:3000`
- Backend port 8000: Change `API_PORT` in `.env` or `docker-compose.yml`

**Services won't start:**
- Check Docker is running: `docker info`
- Check ports are available: `netstat -an | grep -E '3000|8000|5432'`
- View logs: `docker-compose logs -f`

### Environment Variables

The frontend needs to know where the backend API is:

**Option 1: Use defaults** (recommended)
- Default: `http://localhost:8000/api/v1`
- Works automatically if backend runs on port 8000

**Option 2: Custom `.env.local` in frontend:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

### Advanced: Custom Backend Port

If you need to run backend on a different port:

1. **Update docker-compose.yml:**
```yaml
hyperagent:
  ports:
    - "8001:8000"  # Change host port to 8001
```

2. **Update frontend `.env.local`:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
```

3. **Restart services:**
```bash
./scripts/start-backend.sh --stop
./scripts/start-backend.sh
```

---

## Related Documentation

- **[Docker Quick Start Guide](../README.DOCKER.md)** - Get started quickly with Make commands and all-in-one setup
- **[Getting Started Guide](./GETTING_STARTED.md)** - Complete installation and setup instructions
- **[Simplified Setup Guide](./SIMPLIFIED_SETUP.md)** - Production deployment without Docker (recommended)
- **[Troubleshooting Guide](../docs/TROUBLESHOOTING.md)** - Common issues and solutions

