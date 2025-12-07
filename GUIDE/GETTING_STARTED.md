# HyperAgent Getting Started Guide

Quick setup guide to get HyperAgent running and generate your first smart contract.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Setup](#environment-setup)
4. [Database Setup](#database-setup)
5. [Running HyperAgent](#running-hyperagent)
6. [Your First Contract](#your-first-contract)
7. [Next Steps](#next-steps)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Python 3.10 or later**
   - **Windows**: Download from [python.org/downloads/windows](https://www.python.org/downloads/windows/)
   - **macOS**: Download from [python.org/downloads/mac-osx](https://www.python.org/downloads/mac-osx/) or use Homebrew: `brew install python`
   - **Linux**: Use package manager (e.g., `sudo apt-get install python3` on Ubuntu)
   - Verify installation: `python --version`

2. **PostgreSQL 15+ with pgvector extension**
   - **Windows**: Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   - **macOS**: Download from [postgresql.org/download/macosx](https://www.postgresql.org/download/macosx/) or use Homebrew: `brew install postgresql@15`
   - **Linux**: Use package manager (e.g., `sudo apt-get install postgresql-15` on Ubuntu)
   - **Cloud Alternative**: Use [Supabase](https://supabase.com) (free tier available)

3. **Redis 7+**
   - **Windows**: Download from [github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases) or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`
   - **macOS**: Use Homebrew: `brew install redis`
   - **Linux**: Use package manager (e.g., `sudo apt-get install redis-server` on Ubuntu)
   - **Cloud Alternative**: Use [Redis Cloud](https://redis.com/try-free/) (free tier available)

4. **Git**
   - **Windows**: Download from [git-scm.com/download/win](https://git-scm.com/download/win)
   - **macOS**: Download from [git-scm.com/download/mac](https://git-scm.com/download/mac) or use Homebrew: `brew install git`
   - **Linux**: Use package manager (e.g., `sudo apt-get install git` on Ubuntu)
   - Verify installation: `git --version`

### Optional but Recommended

5. **Node.js 18+** (for Hardhat/Foundry contract testing)
   - **All Platforms**: Download from [nodejs.org/en/download](https://nodejs.org/en/download/)
   - **macOS**: Use Homebrew: `brew install node`
   - **Linux**: Use package manager (e.g., `sudo apt-get install nodejs npm` on Ubuntu)
   - Verify installation: `node --version`

6. **Docker** (for containerized development)
   - **Windows/macOS**: Download Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   - **Linux**: Follow [Docker installation guide](https://docs.docker.com/engine/install/)
   - Verify installation: `docker --version`

7. **GNU Make** (for build automation)
   - **Windows**: Download GnuWin's Make from [gnuwin32.sourceforge.net/packages/make.htm](http://gnuwin32.sourceforge.net/packages/make.htm)
   - **macOS**: Usually pre-installed. If not: `brew install make`
   - **Linux**: Usually pre-installed. If not: `sudo apt-get install build-essential` (includes make)
   - Verify installation: `make --version`

8. **Visual Studio Code** (recommended IDE)
   - **All Platforms**: Download from [code.visualstudio.com/download](https://code.visualstudio.com/download)
   - **Linux**: Follow [VS Code installation guide](https://code.visualstudio.com/docs/setup/linux)

### Required API Keys

1. **Google Gemini API Key** (Required for contract generation)
   - Get from: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Steps:
     1. Visit https://aistudio.google.com/app/apikey
     2. Sign in with Google account
     3. Click "Create API Key"
     4. Copy the generated key

2. **OpenAI API Key** (Optional - fallback LLM provider)
   - Get from: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

## Installation

### Step 1: Navigate to Project Directory

```bash
cd C:\Users\USERNAME\Downloads\Hyperkit_agent
```

### Step 2: Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv
```

### Step 3: Activate Virtual Environment

**On Windows (Git Bash):**
```bash
source venv/Scripts/activate
```

**On Windows (Command Prompt/PowerShell):**
```bash
venv\Scripts\activate
```

**On macOS/Linux:**
```bash
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### Step 4: Upgrade Pip

```bash
pip install --upgrade pip
```

### Step 5: Install Dependencies

```bash
pip install -r requirements.txt
```

This will install all required packages (FastAPI, Web3, LLM providers, etc.).

---

## Environment Setup

### Step 1: Create Environment File

The `.env` file should already be created from `env.example`. If not:

```bash
# On Windows (Git Bash)
cp env.example .env

# On Windows (Command Prompt)
copy env.example .env
```

### Step 2: Configure Environment Variables

Open `.env` in a text editor and fill in the required values:

#### Required Configuration

```bash
# Database (PostgreSQL)
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://hyperagent_user:your_password@localhost:5432/hyperagent_db

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM Provider (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# Blockchain Networks (Already configured for testnets)
HYPERION_TESTNET_RPC=https://hyperion-testnet.metisdevops.link
HYPERION_TESTNET_CHAIN_ID=133717
MANTLE_TESTNET_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_TESTNET_CHAIN_ID=5003
```

#### Optional Configuration

```bash
# OpenAI (Fallback LLM)
OPENAI_API_KEY=your_openai_api_key_here

# Pinata/IPFS (Optional)
PINATA_JWT=your_pinata_jwt_token

# JWT Secret (for authentication)
JWT_SECRET_KEY=your-secret-key-change-in-production

# CORS (for frontend)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

---

## Database Setup

### Option 1: Local PostgreSQL

#### Step 1: Install PostgreSQL

Download and install from: https://www.postgresql.org/download/windows/

#### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hyperagent_db;

# Create user (optional)
CREATE USER hyperagent_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE hyperagent_db TO hyperagent_user;

# Exit psql
\q
```

#### Step 3: Enable pgvector Extension

```bash
# Connect to your database
psql -U hyperagent_user -d hyperagent_db

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify extension
\dx

# Exit
\q
```

### Option 2: Supabase (Cloud - Easier)

1. Go to https://supabase.com
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string
5. Update `DATABASE_URL` in `.env`
6. Run SQL in Supabase SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### Step 4: Run Database Migrations

```bash
# Make sure venv is activated
alembic upgrade head
```

This creates all required tables (workflows, contracts, deployments, etc.).

---

## Running HyperAgent

### Option 1: Using Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL, Redis, HyperAgent)
docker-compose up -d

# View logs
docker-compose logs -f hyperagent

# Stop services
docker-compose down
```

### Option 2: Manual Setup

#### Step 1: Start PostgreSQL

**On Windows:**
- Open Services (Win+R, type `services.msc`)
- Find "postgresql-x64-XX" service
- Right-click > Start

Or use command line:
```bash
# If PostgreSQL is installed as a service
net start postgresql-x64-15
```

#### Step 2: Start Redis

**On Windows:**
- Download Redis for Windows: https://github.com/microsoftarchive/redis/releases
- Or use WSL: `wsl redis-server`
- Or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`

#### Step 3: Start HyperAgent API

```bash
# Make sure venv is activated
# You should see (venv) in your prompt

# Run the API server
uvicorn hyperagent.api.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Step 4: Verify Installation

Open your browser or use curl:

```bash
# Health check
curl http://localhost:8000/api/v1/health

# Should return:
# {"status":"healthy","app_name":"HyperAgent","version":"1.0.0"}

# View API documentation
# Open in browser: http://localhost:8000/api/v1/docs
```

---

## Your First Contract

Now that HyperAgent is running, let's create your first smart contract!

### Step 1: Install CLI (Optional but Recommended)

```bash
# Install the package in development mode
pip install -e .

# Verify installation
hyperagent --help
```

### Step 2: Create Your First Workflow

We'll create a simple ERC20 token. The CLI makes this easy:

```bash
hyperagent workflow create \
  -d "Create an ERC20 token with name 'MyFirstToken', symbol 'MFT', and initial supply of 1000000" \
  --network hyperion_testnet \
  --type ERC20
```

**Important**: Notice how we specified the constructor values (name, symbol, supply) in the description. This is crucial for contracts with constructor parameters.

### Step 3: Monitor Progress

The workflow will return a `workflow_id`. Use it to monitor progress:

```bash
# Replace <workflow_id> with the ID from step 2
hyperagent workflow status --workflow-id <workflow_id> --watch
```

You'll see a real-time progress bar showing:
- Generating (20%)
- Compiling (40%)
- Auditing (60%)
- Testing (80%)
- Deploying (100%)

### Step 4: View Results

Once completed, view your contract:

```bash
# Get contract details
hyperagent contract list --workflow-id <workflow_id>

# View contract code
hyperagent contract show --contract-id <contract_id>
```

### Step 5: Check Deployment

If deployment was included, check the deployment:

```bash
# Get deployment details
hyperagent deployment list --workflow-id <workflow_id>

# View deployment with explorer links
hyperagent deployment show --deployment-id <deployment_id>
```

### What Happened?

Your workflow went through these stages:
1. **Generation**: AI converted your description into Solidity code
2. **Compilation**: Contract was compiled to bytecode
3. **Audit**: Security vulnerabilities were checked
4. **Testing**: Unit tests were generated and run
5. **Deployment**: Contract was deployed to Hyperion testnet

### Success Indicators

- ✅ Workflow status shows "completed"
- ✅ Contract code generated
- ✅ Deployment transaction hash available
- ✅ Contract address on explorer

---

## Next Steps

Now that you've created your first contract, explore more:

1. **Learn More**:
   - [User Guide](./USER_GUIDE.md) - How to accomplish specific tasks
   - [API Documentation](./API.md) - Complete API reference
   - [Deployment Guide](./DEPLOYMENT.md) - Advanced deployment options

2. **Try More Examples**:
   - Create an ERC721 NFT collection
   - Deploy to Mantle testnet
   - Create a custom contract with complex logic

3. **Explore Features**:
   - Constructor argument generation
   - Security auditing
   - Batch deployment
   - Template retrieval

---

## Example Workflows

### Example 1: Simple ERC20 Token with Constructor Arguments

**Important**: When creating contracts with constructor parameters, specify the values in your NLP description. HyperAgent will automatically extract and use these values.

```bash
# CLI - Good example with constructor values specified
hyperagent workflow create \
  -d "Create an ERC20 token with name 'MyToken', symbol 'MTK', and initial supply of 1000000" \
  --network hyperion_testnet \
  --type ERC20

# API - Good example
curl -X POST http://localhost:8000/api/v1/workflows/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nlp_input": "Create an ERC20 token with name '\''MyToken'\'', symbol '\''MTK'\'', and initial supply of 1000000",
    "network": "hyperion_testnet",
    "contract_type": "ERC20"
  }'

# Monitor progress
hyperagent workflow status --workflow-id <workflow_id> --watch
```

**Constructor Argument Tips**:
- ✅ **Good**: "Create token with name 'MyToken', symbol 'MTK', and 1 million supply"
- ✅ **Good**: "Create ERC721 NFT with name 'MyNFT' and symbol 'MNFT'"
- ❌ **Bad**: "Create ERC20 token" (no constructor values specified)

### Example 2: NFT Collection with Constructor

```bash
# CLI
hyperagent workflow create \
  -d "Create an ERC721 NFT collection with name 'MyNFTCollection', symbol 'MNFT', and base URI 'https://api.example.com/metadata/'" \
  --network hyperion_testnet \
  --type ERC721

# API
curl -X POST http://localhost:8000/api/v1/workflows/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nlp_input": "Create an ERC721 NFT collection with name '\''MyNFTCollection'\'', symbol '\''MNFT'\'', and base URI '\''https://api.example.com/metadata/'\''",
    "network": "hyperion_testnet",
    "contract_type": "ERC721"
  }'
```

### Example 3: Custom Contract with Multiple Constructor Parameters

```bash
# CLI - Complex constructor with multiple parameters
hyperagent workflow create \
  -d "Create a voting contract with name 'DAO Voting', minimum voting period of 7 days, and quorum threshold of 50 percent" \
  --network hyperion_testnet \
  --type Custom

# The system will automatically:
# 1. Extract constructor parameter definitions from generated contract
# 2. Generate values from your NLP description using AI
# 3. Pass values to deployment
```

### Example 4: Manual Constructor Arguments Override

If automatic generation fails, you can manually provide constructor arguments:

```bash
# Deploy with manual constructor args
hyperagent deployment deploy \
  --contract-id <contract_id> \
  --network hyperion_testnet \
  --constructor-args '["MyToken", "MTK", 1000000]'

# Format: JSON array matching constructor parameter order
# String values: Use quotes
# Numbers: No quotes
# Addresses: Hex strings starting with 0x
# Booleans: true or false
# Arrays: JSON array syntax
```

---

## Troubleshooting

### Issue 1: Python Command Not Found

**Problem:** `python3.10: command not found`

**Solution:** Use `python` instead (Python 3.12 works fine):
```bash
python -m venv venv
```

### Issue 2: Virtual Environment Not Found

**Problem:** `venv/Scripts/activate: No such file or directory`

**Solution:** Create the virtual environment first:
```bash
python -m venv venv
```

Then activate:
```bash
# Windows Git Bash
source venv/Scripts/activate

# Windows Command Prompt
venv\Scripts\activate
```

### Issue 3: Database Connection Failed

**Problem:** `Connection refused` or `database does not exist`

**Solution:**
1. Check PostgreSQL is running:
   ```bash
   # Windows
   net start postgresql-x64-15
   ```

2. Verify DATABASE_URL in `.env`:
   ```bash
   # Format: postgresql://user:password@host:port/database
   DATABASE_URL=postgresql://hyperagent_user:password@localhost:5432/hyperagent_db
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

### Issue 4: Redis Connection Failed

**Problem:** `Connection refused` to Redis

**Solution:**
1. Check Redis is running:
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:7-alpine
   
   # Or install Redis for Windows
   # Download from: https://github.com/microsoftarchive/redis/releases
   ```

2. Verify REDIS_URL in `.env`:
   ```bash
   REDIS_URL=redis://localhost:6379/0
   ```

3. Test connection:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Issue 5: LLM API Errors

**Problem:** `Invalid API key` or `API quota exceeded`

**Solution:**
1. Verify API key is set:
   ```bash
   # Check .env file
   GEMINI_API_KEY=your_actual_key_here
   ```

2. Test API key:
   ```python
   python -c "import google.generativeai as genai; genai.configure(api_key='YOUR_KEY'); print('OK')"
   ```

### Issue 6: Migration Errors

**Problem:** `alembic upgrade head` fails

**Solution:**
1. Check database exists:
   ```sql
   CREATE DATABASE hyperagent_db;
   ```

2. Enable pgvector extension:
   ```sql
   CREATE EXTENSION vector;
   ```

3. Check current migration version:
   ```bash
   alembic current
   ```

4. Reset if needed (WARNING: deletes all data):
   ```bash
   alembic downgrade base
   alembic upgrade head
   ```

### Issue 7: Port Already in Use

**Problem:** `Address already in use` on port 8000

**Solution:**
1. Find process using port:
   ```bash
   # Windows
   netstat -ano | findstr :8000
   ```

2. Kill process or use different port:
   ```bash
   uvicorn hyperagent.api.main:app --port 8001
   ```

---

## Quick Reference

### Important URLs

- API Base: `http://localhost:8000/api/v1`
- Health Check: `http://localhost:8000/api/v1/health`
- API Docs: `http://localhost:8000/api/v1/docs`
- ReDoc: `http://localhost:8000/api/v1/redoc`
- Metrics: `http://localhost:8000/api/v1/metrics/prometheus`

### Important Commands

```bash
# Activate virtual environment
venv\Scripts\activate  # Windows CMD
source venv/Scripts/activate  # Windows Git Bash

# Run migrations
alembic upgrade head

# Start API server
uvicorn hyperagent.api.main:app --reload

# Check health
curl http://localhost:8000/api/v1/health
```

---

## Next Steps

1. **Explore API Documentation**: Open http://localhost:8000/api/v1/docs in your browser
2. **Read API Reference**: See `docs/API.md`
3. **Check Deployment Guide**: See `docs/DEPLOYMENT.md`
4. **Review Production Readiness**: See `docs/PRODUCTION_READINESS.md`

---

## Need Help?

- Check logs: Look for error messages in terminal output
- Review documentation: See `docs/` directory
- Check environment: Verify all `.env` variables are set correctly
- Test connections: Verify PostgreSQL and Redis are accessible

