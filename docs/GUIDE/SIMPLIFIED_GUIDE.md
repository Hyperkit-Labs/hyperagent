# Simplified HyperAgent Setup Guide

This guide shows how to deploy HyperAgent without Docker, using cloud services like Supabase for the database and the modern monorepo structure.

## Quick Start (5 minutes)

### Prerequisites

- **Node.js** 18.0 or higher
- **pnpm** 8.0 or higher (install: `npm install -g pnpm`)
- **Python** 3.11 or higher
- **Git** 2.30+

### 1. Get Supabase Database (Free tier available)

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **Database**
4. Copy the connection string → `DATABASE_URL`

Example connection string:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

### 2. Get API Keys

- **Gemini API Key**: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Thirdweb** (for x402): [portal.thirdweb.com](https://portal.thirdweb.com)

### 3. Clone and Setup Monorepo

```bash
# Clone repository
git clone https://github.com/Hyperkit-Labs/hyperagent.git
cd hyperagent

# Install all dependencies (Node.js packages via pnpm)
pnpm install

# Install Python dependencies for API
cd apps/hyperagent-api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 4. Configure Environment

Create `.env` file in the root directory:

```bash
# Required - Database (Supabase)
DATABASE_URL=postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres

# Required - LLM
GEMINI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key  # Optional but recommended

# Required - x402 (Avalanche)
THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key
THIRDWEB_SERVER_WALLET_ADDRESS=0x...
MERCHANT_WALLET_ADDRESS=0x...
USDC_ADDRESS_FUJI=0x5425890298aed601595a70AB815c96711a31Bc65

# Optional - Redis (leave empty for single instance)
REDIS_URL=

# Optional - PRIVATE_KEY (only for EigenDA)
PRIVATE_KEY=
```

### 5. Run Locally (Development)

#### Start Backend API

```bash
# Activate Python virtual environment
cd apps/hyperagent-api
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn hyperagent.api.main:app --reload --host 0.0.0.0 --port 8000
```

#### Start Frontend (Separate Terminal)

```bash
# From project root
pnpm turbo dev --filter hyperagent-web

# Or navigate to frontend directory
cd apps/hyperagent-web
pnpm dev
```

#### Using Turbo (All Services)

```bash
# Start all apps and services
pnpm turbo dev

# Start specific services
pnpm turbo dev --filter hyperagent-api
pnpm turbo dev --filter hyperagent-web
```

### 6. Verify Setup

```bash
# Check API health
curl http://localhost:8000/api/v1/health

# Check frontend
# Open http://localhost:3000 in browser
```

## Deploy to Production

### Option A: Render (Recommended)

1. Connect your GitHub repository to Render
2. Create a new **Web Service**
3. Select **Python** environment
4. Set **Root Directory**: `apps/hyperagent-api`
5. Set build command: `pip install -r requirements.txt`
6. Set start command: `uvicorn hyperagent.api.main:app --host 0.0.0.0 --port $PORT`
7. Add environment variables from your `.env` file
8. Deploy!

**For Frontend (Separate Service):**
1. Create another **Web Service**
2. Select **Node.js** environment
3. Set **Root Directory**: `apps/hyperagent-web`
4. Set build command: `pnpm install && pnpm build`
5. Set start command: `pnpm start`
6. Add environment variables
7. Deploy!

### Option B: VPS/Oracle Cloud

1. SSH into your VPS
2. Clone repository
3. Install dependencies:
   ```bash
   # Install pnpm globally
   npm install -g pnpm
   
   # Install Node.js dependencies
   pnpm install
   
   # Setup Python backend
   cd apps/hyperagent-api
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   ```
4. Start services:
   ```bash
   # Backend (use systemd or PM2)
   cd apps/hyperagent-api
   source venv/bin/activate
   uvicorn hyperagent.api.main:app --host 0.0.0.0 --port 8000
   
   # Frontend (separate process)
   cd apps/hyperagent-web
   pnpm start
   ```

## Monorepo Structure

HyperAgent uses a monorepo with pnpm workspaces:

```
hyperagent/
├── apps/
│   ├── hyperagent-api/      # Python/FastAPI backend
│   ├── hyperagent-web/      # Next.js frontend
│   └── issue-automation/    # GitHub automation
├── services/                 # Microservices
│   ├── orchestrator/        # LangGraph orchestration
│   ├── api-gateway/         # HTTP API gateway
│   └── agents/              # Agent implementations
├── packages/                # Shared packages
│   ├── sdk-ts/             # TypeScript SDK
│   ├── shared-ui/          # React components
│   └── config/             # Configuration utilities
└── tools/                   # Development tools
```

## Using Turbo Commands

```bash
# Build all packages
pnpm turbo build

# Run linting
pnpm turbo lint

# Run tests
pnpm turbo test

# Run for specific package
pnpm turbo build --filter hyperagent-api
pnpm turbo dev --filter hyperagent-web
```

## What's Different from Docker Setup?

### Removed Dependencies

- **No Docker** - Run Python and Node.js directly
- **No local PostgreSQL** - Use Supabase cloud database
- **No Redis** - Uses in-memory fallback (works for single instance)
- **No Prometheus/Grafana** - Available in docker-compose for advanced monitoring

### Benefits

- **Simpler** - No Docker orchestration
- **Faster** - Direct execution
- **Cheaper** - Use Supabase free tier
- **Easier** - Fewer moving parts
- **Modern** - pnpm workspace and Turbo for efficient builds

## When to Add Redis?

Add Redis when you need:
- Multiple instances (distributed deployment)
- Shared rate limiting across instances
- Event persistence across restarts
- High event volume

**Cost**: Redis Cloud free tier (30 MB) or Essentials ($5/month)

## When to Add PRIVATE_KEY?

Only add `PRIVATE_KEY` if you need:
- EigenDA data availability (Mantle deployments)
- Legacy non-x402 network deployments

**For x402 networks (Avalanche)**: Users sign in their wallets, no PRIVATE_KEY needed.

## Troubleshooting

### Database Connection Failed

- Check Supabase connection string format
- Verify database password is correct
- Ensure Supabase project is active
- Check network firewall settings

### pnpm Command Not Found

```bash
# Install pnpm globally
npm install -g pnpm

# Or use npx
npx pnpm install
```

### Python Virtual Environment Issues

```bash
# On Windows, use backslashes
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

### Redis Connection Failed

- This is OK! HyperAgent uses in-memory fallback
- Only add Redis if you need distributed features

### Port Already in Use

- Change `API_PORT` in `.env`
- Or use `--port` flag: `uvicorn ... --port 8001`
- For frontend, change port in `apps/hyperagent-web/package.json`

### Turbo Build Fails

```bash
# Clear Turbo cache
pnpm turbo clean

# Rebuild from scratch
pnpm install
pnpm turbo build
```

## Next Steps

- Read [Full Documentation](./README.md)
- Check [API Reference](./API.md)
- Explore [Architecture Guide](../ARCHITECTURE_SIMPLIFIED.md)
- Review [Environment Configuration](../ENV_CONFIGURATION_GUIDE.md)
