# Troubleshooting Guide

<<<<<<< HEAD
**Document Type**: How-To Guide (Goal-Oriented)  
**Category**: Support  
**Audience**: All Users  
**Location**: `docs/TROUBLESHOOTING.md`
=======
Common issues and solutions.
>>>>>>> development

Common issues and solutions for HyperAgent.

## Quick Diagnostics

### Check System Health

```bash
# Basic health check
curl http://localhost:8000/api/v1/health/

# Detailed health check (includes service status)
curl http://localhost:8000/api/v1/health/detailed
```

### Check Logs

```bash
# Docker logs
docker-compose logs -f hyperagent

# Local installation
tail -f logs/hyperagent.log
```

## Common Issues

### Database Connection Issues

#### Error: "Database connection failed"

**Symptoms:**
- API returns 500 errors
- Health check shows database as unhealthy
- Logs show connection errors

**Solutions:**

1. **Check PostgreSQL is running:**
   ```bash
   # Docker
   docker-compose ps postgres
   
   # Local
   sudo systemctl status postgresql
   ```

2. **Verify connection string:**
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```
   - Check username, password, host, port, database name
   - Ensure no special characters in password (URL encode if needed)

3. **Test connection manually:**
   ```bash
   psql -U user -h host -d database
   ```

4. **Check firewall rules:**
   - Ensure port 5432 is accessible
   - Check Docker network configuration

5. **Verify database exists:**
   ```sql
   \l  -- List databases
   CREATE DATABASE hyperagent_db;  -- If missing
   ```

6. **Check pgvector extension:**
   ```sql
   \c hyperagent_db
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### Redis Connection Issues

#### Error: "Redis connection failed"

**Symptoms:**
- Workflow events not working
- Health check shows Redis as unhealthy
- Cache operations failing

**Solutions:**

1. **Check Redis is running:**
   ```bash
   # Docker
   docker-compose ps redis
   
   # Local
   redis-cli ping
   # Should return: PONG
   ```

2. **Verify connection URL:**
   ```env
   REDIS_URL=redis://:password@host:6379/0
   ```
   - Format: `redis://[:password@]host:port/db`
   - If no password: `redis://host:6379/0`

3. **Test connection:**
   ```bash
   redis-cli -h host -p 6379 -a password ping
   ```

4. **Check authentication:**
   - If Redis has password, ensure `REDIS_PASSWORD` is set
   - Verify password is correct

### LLM API Issues

#### Error: "LLM API call failed" or "Timeout"

**Symptoms:**
- Contract generation fails
- Timeout errors in logs
- API returns 500 errors

**Solutions:**

1. **Verify API key:**
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   - Check key is correct
   - Ensure no extra spaces or quotes
   - Verify key has quota remaining

2. **Check API quota:**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Check quota limits
   - Verify billing is set up if needed

3. **Increase timeout (if needed):**
   ```env
   LLM_TIMEOUT_SECONDS=60  # Increase from default 30
   ```

4. **Try fallback provider:**
   ```env
   OPENAI_API_KEY=your_openai_key
   ```

5. **Check network connectivity:**
   ```bash
   curl https://generativelanguage.googleapis.com
   ```

### Deployment Issues

#### Error: "Gas estimation failed"

**Symptoms:**
- Deployment fails during gas estimation
- Constructor argument errors

**Solutions:**

1. **Check constructor arguments:**
   - Verify constructor arguments match contract signature
   - Ensure correct number and types of arguments
   - Check argument values are valid

2. **Verify wallet balance:**
   ```env
   MIN_WALLET_BALANCE_ETH=0.001  # Minimum required
   ```
   - Ensure wallet has sufficient balance
   - Check balance on network explorer

3. **Check network RPC:**
   ```env
   HYPERION_TESTNET_RPC=https://hyperion-testnet.metisdevops.link
   ```
   - Verify RPC URL is correct
   - Test RPC connectivity

4. **Verify private key:**
   ```env
   PRIVATE_KEY=your_private_key_without_0x
   PUBLIC_ADDRESS=0xYourPublicAddress
   ```
   - Ensure private key matches public address
   - Verify key format (hex, no 0x prefix)

#### Error: "Transaction failed" or "Zero balance"

**Solutions:**

1. **Fund wallet:**
   - Get testnet tokens from faucet
   - Verify balance on explorer

2. **Check network:**
   - Ensure correct network (testnet vs mainnet)
   - Verify chain ID matches

### Workflow Status Issues

#### Error: "Workflow stuck" or "Progress not updating"

**Symptoms:**
- Workflow shows low progress even after completion
- Status doesn't update

**Solutions:**

1. **Check workflow status:**
   ```bash
   curl http://localhost:8000/api/v1/workflows/{workflow_id}
   ```

2. **Check logs for errors:**
   ```bash
   docker-compose logs hyperagent | grep {workflow_id}
   ```

3. **Verify services are running:**
   - Database connection
   - Redis connection
   - LLM API access

4. **Check for background tasks:**
   - EigenDA storage may be running in background
   - Wait a few minutes for completion

### Compilation Issues

#### Error: "Compilation failed"

**Symptoms:**
- Contract generation succeeds but compilation fails
- Solidity version errors

**Solutions:**

1. **Check Solidity compiler:**
   ```bash
   # Verify solc is installed
   solc --version
   ```

2. **Verify compiler version:**
   - Check contract pragma version
   - Ensure compatible compiler version

3. **Check for syntax errors:**
   - Review generated contract code
   - Look for missing imports or syntax issues

### Docker Issues

#### Error: "Container won't start"

**Solutions:**

1. **Check Docker resources:**
   ```bash
   docker system df
   docker stats
   ```
   - Ensure sufficient disk space
   - Check memory/CPU limits

2. **Rebuild containers:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. **Check port conflicts:**
   ```bash
   # Check if port is in use
   netstat -an | grep 8000
   ```
   - Change port if needed: `API_PORT=8001`

4. **Check Docker logs:**
   ```bash
   docker-compose logs hyperagent
   ```

### Configuration Issues

#### Error: "Configuration validation failed"

**Solutions:**

1. **Check environment variables:**
   ```bash
   # Docker
   docker-compose exec hyperagent env | grep -E "GEMINI|DATABASE|REDIS"
   
   # Local
   cat .env
   ```

2. **Verify required variables:**
   - `GEMINI_API_KEY` (required)
   - `DATABASE_URL` (required)
   - `REDIS_URL` (required)
   - `PRIVATE_KEY` (required for deployment)
   - `PUBLIC_ADDRESS` (required for deployment)

3. **Check variable format:**
   - No quotes around values (unless needed)
   - Correct boolean values: `true`/`false` or `1`/`0`
   - Valid URLs and connection strings

## Performance Issues

### Slow Contract Generation

**Solutions:**

1. **Check LLM API response time:**
   - Monitor API latency
   - Consider using faster model

2. **Increase timeout:**
   ```env
   LLM_TIMEOUT_SECONDS=60
   ```

3. **Check database performance:**
   - Verify database indexes
   - Check connection pooling

### High Memory Usage

**Solutions:**

1. **Reduce workers:**
   ```env
   API_WORKERS=2  # Reduce from default 4
   ```

2. **Optimize Redis:**
   ```env
   # In docker-compose.yml
   redis:
     command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
   ```

3. **Check for memory leaks:**
   - Monitor memory usage over time
   - Review logs for errors

## Getting Help

### Before Asking for Help

1. **Check logs:**
   ```bash
   docker-compose logs hyperagent | tail -100
   ```

2. **Verify configuration:**
   - Review `.env` file
   - Check all required variables

3. **Test health endpoints:**
   ```bash
   curl http://localhost:8000/api/v1/health/detailed
   ```

4. **Check documentation:**
   - [Quick Start Guide](./QUICK_START.md)
   - [Configuration Guide](./CONFIGURATION.md)
   - [API Reference](./API_REFERENCE.md)

### Reporting Issues

When reporting issues, include:

1. **Error message** (full text)
2. **Logs** (relevant sections)
3. **Configuration** (sanitized, no secrets)
4. **Steps to reproduce**
5. **Environment** (Docker/local, OS, versions)

**GitHub Issues:** [https://github.com/JustineDevs/HyperAgent/issues](https://github.com/JustineDevs/HyperAgent/issues)

## Additional Resources

- [Quick Start Guide](./QUICK_START.md) - Installation and setup
- [Configuration Guide](./CONFIGURATION.md) - All configuration options
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [API Reference](./API_REFERENCE.md) - API documentation

---

**Still stuck?** Open an issue on GitHub with the information above.

