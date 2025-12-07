# Simplified HyperAgent Setup Guide

This guide shows how to deploy HyperAgent without Docker, using cloud services like Supabase for the database.

## Quick Start (5 minutes)

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

### 3. Configure Environment

Copy `env.example` to `.env` and fill in:

```bash
# Required - Database (Supabase)
DATABASE_URL=postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres

# Required - LLM
GEMINI_API_KEY=your_key

# Required - x402 (Avalanche)
THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key
THIRDWEB_SERVER_WALLET_ADDRESS=0x...
MERCHANT_WALLET_ADDRESS=0x...
USDC_ADDRESS_FUJI=0x5425890298aed601595a70AB815c96711a31Bc65

# Optional - Redis (leave empty for single instance)
REDIS_URL=

# Optional - PRIVATE_KEY (only for EigenDA/Alith)
PRIVATE_KEY=
```

### 4. Deploy to Render (or VPS)

#### Option A: Render (Recommended)

1. Connect your GitHub repository to Render
2. Create a new **Web Service**
3. Select **Python** environment
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn hyperagent.api.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from your `.env` file
7. Deploy!

#### Option B: VPS/Oracle Cloud

1. SSH into your VPS
2. Clone repository
3. Run `scripts/start_production.sh`
4. Or manually:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn hyperagent.api.main:app --host 0.0.0.0 --port 8000
   ```

### 5. Run Locally (Development)

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn hyperagent.api.main:app --reload
```

## What's Different from Docker Setup?

### Removed Dependencies

- **No Docker** - Run Python directly
- **No local PostgreSQL** - Use Supabase cloud database
- **No Redis** - Uses in-memory fallback (works for single instance)
- **No Prometheus/Grafana** - Optional, can be added later

### Benefits

- **Simpler** - No Docker orchestration
- **Faster** - Direct Python execution
- **Cheaper** - Use Supabase free tier
- **Easier** - Fewer moving parts

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
- Alith autonomous deployment
- Legacy non-x402 network deployments

**For x402 networks (Avalanche)**: Users sign in their wallets, no PRIVATE_KEY needed.

## Troubleshooting

### Database Connection Failed

- Check Supabase connection string format
- Verify database password is correct
- Ensure Supabase project is active

### Redis Connection Failed

- This is OK! HyperAgent uses in-memory fallback
- Only add Redis if you need distributed features

### Port Already in Use

- Change `API_PORT` in `.env`
- Or use `--port` flag: `uvicorn ... --port 8001`

## Next Steps

- See [API Documentation](./API.md) for API usage
- See [Deployment Guide](./DEPLOYMENT.md) for production deployment
- See [Developer Guide](./DEVELOPER_GUIDE.md) for development setup

