# HyperAgent Troubleshooting Guide

Common issues and solutions.

### 1. Constructor Argument Errors

#### Error: "Gas estimation failed: Incorrect argument count. Expected '3'. Got '0'"

**Cause**: Constructor arguments are not being generated or passed correctly.

**Solutions**:
1. **Check NLP Description**: Ensure your description includes constructor parameter values
   - ✅ Good: "Create ERC20 token with name 'MyToken', symbol 'MTK', and 1 million supply"
   - ❌ Bad: "Create ERC20 token" (no values specified)

2. **Verify Constructor Args in Workflow**:
   ```bash
   hyperagent workflow status --workflow-id <id> --format json
   ```
   Check the `constructor_args` field in the contract data.

3. **Manual Override**: If automatic generation fails, provide constructor args manually:
   ```bash
   hyperagent deployment deploy --contract-id <id> --network hyperion_testnet \
     --constructor-args '["MyToken", "MTK", 1000000]'
   ```

4. **Check Logs**: Review generation service logs for LLM extraction errors:
   ```bash
   docker-compose logs hyperagent | grep "constructor"
   ```

---

### 2. Windows Encoding Errors

#### Error: "'charmap' codec can't encode characters"

**Cause**: Windows terminal doesn't support Unicode characters.

**Solutions**:
1. **Use PowerShell or WSL**: Recommended for better compatibility
2. **Set Environment Variable**:
   ```powershell
   $env:PYTHONIOENCODING="utf-8"
   ```
3. **Use ASCII Mode**: The CLI automatically falls back to ASCII on Windows
4. **Check Terminal**: Ensure your terminal supports UTF-8 encoding

**Status**: ✅ Fixed in latest version - automatic fallback to ASCII

---

### 3. Progress Bar Not Updating

#### Issue: Progress bar stuck at 0% or not updating

**Solutions**:
1. **Check API Connection**:
   ```bash
   hyperagent system health
   ```

2. **Verify Workflow Status**:
   ```bash
   hyperagent workflow status --workflow-id <id>
   ```

3. **Check Database**: Ensure workflow progress is being updated:
   ```sql
   SELECT id, status, progress_percentage FROM workflows WHERE id = '<workflow_id>';
   ```

4. **Restart Services**: If progress tracking is broken:
   ```bash
   docker-compose restart hyperagent
   ```

---

### 4. Deployment Failures

#### Error: "Private key required for deployment"

**Solutions**:
1. **Set Environment Variable**:
   ```bash
   export PRIVATE_KEY="your_private_key_here"
   ```

2. **Check .env File**:
   ```bash
   grep PRIVATE_KEY .env
   ```

3. **Use CLI Option**:
   ```bash
   hyperagent deployment deploy --contract-id <id> --network hyperion_testnet \
     --private-key "your_private_key"
   ```

#### Error: "Insufficient balance"

**Solutions**:
1. **Check Wallet Balance**:
   ```bash
   hyperagent wallet balance --network hyperion_testnet
   ```

2. **Fund Wallet**: Get testnet tokens from faucet
   - Hyperion: [Faucet URL]
   - Mantle: [Faucet URL]

3. **Verify Address**: Ensure `PUBLIC_ADDRESS` matches your `PRIVATE_KEY`:
   ```bash
   python scripts/verify_wallet.py
   ```

---

### 5. API Connection Errors

#### Error: "Failed to connect to API" or "Connection refused"

**Solutions**:
1. **Check API Status**:
   ```bash
   hyperagent system health
   ```

2. **Verify Docker Services**:
   ```bash
   docker-compose ps
   ```

3. **Start Services**:
   ```bash
   docker-compose up -d
   ```

4. **Check Ports**:
   ```bash
   netstat -an | grep 8000  # Windows
   lsof -i :8000            # Linux/macOS
   ```

5. **Check API URL**: Ensure `API_HOST` and `API_PORT` are correct in `.env`

---

### 6. LLM Generation Failures

#### Error: "LLM generation failed" or "Failed to generate contract"

**Solutions**:
1. **Check API Keys**:
   ```bash
   grep GEMINI_API_KEY .env
   grep OPENAI_API_KEY .env
   ```

2. **Verify API Quota**: Check your LLM provider dashboard for rate limits

3. **Check Logs**:
   ```bash
   docker-compose logs hyperagent | grep -i "llm\|generation"
   ```

4. **Try Different Provider**: Switch between Gemini and OpenAI in settings

5. **Reduce Prompt Complexity**: Simplify your NLP description

---

### 7. Constructor Value Generation Issues

#### Issue: Constructor values are defaults instead of extracted values

**Solutions**:
1. **Improve NLP Description**: Be more specific about constructor values
   - ✅ "Create token with name 'MyToken', symbol 'MTK', and 1 million supply"
   - ❌ "Create token" (too vague)

2. **Check LLM Response**: Review logs for LLM extraction:
   ```bash
   docker-compose logs hyperagent | grep "constructor"
   ```

3. **Manual Override**: Provide constructor args manually if needed

4. **Verify Contract Code**: Ensure contract has constructor with parameters

---

### 8. Workflow Stuck in "Generating" Status

#### Issue: Workflow doesn't progress past generation stage

**Solutions**:
1. **Check Service Logs**:
   ```bash
   docker-compose logs hyperagent | tail -100
   ```

2. **Verify LLM Service**: Test LLM connection:
   ```python
   from hyperagent.llm.provider import LLMProviderFactory
   provider = LLMProviderFactory.create("gemini", api_key="your_key")
   result = await provider.generate("Test prompt")
   ```

3. **Check Database**: Verify workflow record exists and is not locked

4. **Restart Workflow**: Cancel and recreate if stuck:
   ```bash
   hyperagent workflow cancel --workflow-id <id>
   ```

---

### 9. Template Search Not Working

#### Error: "Failed to search templates" or empty results

**Solutions**:
1. **Check Vector Store**: Ensure templates are indexed:
   ```bash
   hyperagent template list
   ```

2. **Reindex Templates**: If needed:
   ```bash
   # Run template indexing script
   python scripts/index_templates.py
   ```

3. **Check Embeddings**: Verify LLM embeddings are working

4. **Try Different Query**: Use more specific search terms

---

### 10. Network Connection Issues

#### Error: "Network not available" or "RPC connection failed"

**Solutions**:
1. **Check Network Config**:
   ```bash
   hyperagent network info hyperion_testnet
   ```

2. **Verify RPC URLs**: Check `.env` for network RPC URLs:
   ```bash
   grep HYPERION_TESTNET_RPC .env
   ```

3. **Test RPC Connection**:
   ```python
   from web3 import Web3
   w3 = Web3(Web3.HTTPProvider("your_rpc_url"))
   print(w3.is_connected())
   ```

4. **Check Network Status**: Verify testnet/mainnet is operational

---

## Debugging Commands

### Check System Health
```bash
hyperagent system health
```

### View Workflow Details
```bash
hyperagent workflow status --workflow-id <id> --format json
```

### Check Contract Details
```bash
hyperagent contract view <contract-id>
```

### View Deployment Info
```bash
hyperagent deployment view <deployment-id>
```

### Check Logs
```bash
# Docker logs
docker-compose logs -f hyperagent

# Specific service
docker-compose logs hyperagent | grep "error\|exception"
```

### Database Queries
```bash
# Connect to database
docker-compose exec postgres psql -U hyperagent -d hyperagent

# Check workflows
SELECT id, status, progress_percentage, created_at FROM workflows ORDER BY created_at DESC LIMIT 10;

# Check contracts
SELECT id, contract_name, constructor_args FROM contracts ORDER BY created_at DESC LIMIT 10;
```

---

## Getting Help

1. **Check Logs**: Always review logs first
2. **Verify Configuration**: Check `.env` file and settings
3. **Test Components**: Isolate the failing component
4. **Review Documentation**: Check relevant guides
5. **Open Issue**: If problem persists, open a GitHub issue with:
   - Error message
   - Steps to reproduce
   - Logs
   - System information

---

## Prevention Tips

1. **Always specify constructor values** in NLP descriptions
2. **Keep API keys secure** and rotate regularly
3. **Monitor wallet balances** before deployment
4. **Test on testnet** before mainnet
5. **Review generated contracts** before deployment
6. **Keep services updated** with latest versions
7. **Backup important data** regularly

---

**Last Updated**: 2025-11-18

