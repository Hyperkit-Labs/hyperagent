# HyperAgent User Guide

Step-by-step guide to accomplish specific tasks with HyperAgent.

## Table of Contents

- [Generate Your First Smart Contract](#generate-your-first-smart-contract)
- [Deploy a Contract to Blockchain](#deploy-a-contract-to-blockchain)
- [Audit an Existing Contract](#audit-an-existing-contract)
- [Monitor Workflow Progress](#monitor-workflow-progress)
- [Use Constructor Arguments](#use-constructor-arguments)
- [Export and Share Contracts](#export-and-share-contracts)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Generate Your First Smart Contract

**Goal**: Create a smart contract from a natural language description.

### Prerequisites

- HyperAgent API running (see [Getting Started Guide](./GETTING_STARTED.md))
- API access token (if authentication is enabled)
- Gemini or OpenAI API key configured

### Steps

1. **Create a workflow using CLI**:

```bash
hyperagent workflow create \
  -d "Create an ERC20 token with name 'MyToken', symbol 'MTK', and initial supply of 1000000" \
  --network hyperion_testnet \
  --type ERC20
```

2. **Or use the API**:

```bash
curl -X POST http://localhost:8000/api/v1/workflows/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nlp_input": "Create an ERC20 token with name '\''MyToken'\'', symbol '\''MTK'\'', and initial supply of 1000000",
    "network": "hyperion_testnet",
    "contract_type": "ERC20"
  }'
```

3. **Save the workflow ID** from the response for status checking.

### Expected Result

- Workflow created with status "created"
- Contract generation starts automatically
- You receive a `workflow_id` to track progress

### Tips

- Be specific in your description: include contract name, symbol, and initial supply
- Specify constructor values in your description (see [Use Constructor Arguments](#use-constructor-arguments))
- Use `--watch` flag to monitor progress in real-time

---

## Deploy a Contract to Blockchain

**Goal**: Deploy a generated contract to Hyperion or Mantle testnet.

### Prerequisites

- A completed workflow with generated contract
- Sufficient testnet tokens in your wallet
- Network RPC configured in `.env`

### Steps

1. **Check if your workflow includes deployment**:

```bash
hyperagent workflow status --workflow-id <workflow_id>
```

2. **If deployment is not included, deploy manually**:

```bash
# Get contract ID from workflow
hyperagent contract list --workflow-id <workflow_id>

# Deploy the contract
hyperagent deployment deploy \
  --contract-id <contract_id> \
  --network hyperion_testnet
```

3. **Monitor deployment**:

```bash
hyperagent deployment status --deployment-id <deployment_id>
```

### Expected Result

- Contract deployed to blockchain
- Transaction hash returned
- Contract address available
- Explorer link provided

### Tips

- Ensure your wallet has sufficient balance for gas fees
- Constructor arguments are automatically generated from your NLP description
- Deployment status updates in real-time

---

## Audit an Existing Contract

**Goal**: Security audit an existing smart contract.

### Prerequisites

- Contract source code (Solidity file)
- HyperAgent API running

### Steps

1. **Audit via CLI**:

```bash
# From file
hyperagent contract audit --file path/to/contract.sol

# From contract ID
hyperagent contract audit --contract-id <contract_id>
```

2. **Or use the API**:

```bash
curl -X POST http://localhost:8000/api/v1/contracts/audit \
  -H "Content-Type: application/json" \
  -d '{
    "contract_code": "pragma solidity ^0.8.0; contract MyContract { ... }"
  }'
```

### Expected Result

- Security vulnerabilities identified
- Risk score calculated
- Detailed audit report with recommendations
- Severity levels: Critical, High, Medium, Low, Info

### Tips

- Review critical and high-severity issues first
- Fix issues and re-audit before deployment
- Use multiple audit tools (Slither, Mythril, Echidna) for comprehensive coverage

---

## Monitor Workflow Progress

**Goal**: Track the progress of a running workflow in real-time.

### Prerequisites

- Workflow ID from workflow creation

### Steps

1. **Watch workflow progress**:

```bash
hyperagent workflow status --workflow-id <workflow_id> --watch
```

2. **Check status once**:

```bash
hyperagent workflow status --workflow-id <workflow_id>
```

3. **Use API polling**:

```bash
# Poll every 2 seconds
while true; do
  curl http://localhost:8000/api/v1/workflows/<workflow_id>
  sleep 2
done
```

### Expected Result

- Real-time progress bar showing percentage
- Current stage displayed (generating, compiling, auditing, testing, deploying)
- Status updates every 2 seconds
- Final status: "completed" or "failed"

### Tips

- Use `--watch` flag for continuous monitoring
- Progress updates automatically after each stage
- Deployment completion is marked immediately after on-chain confirmation

---

## Use Constructor Arguments

**Goal**: Create contracts with constructor parameters and ensure correct values are passed.

### Prerequisites

- Understanding of your contract's constructor requirements

### Steps

1. **Specify constructor values in NLP description**:

```bash
# Good example - values specified
hyperagent workflow create \
  -d "Create ERC20 token with name 'MyToken', symbol 'MTK', and initial supply of 1000000" \
  --network hyperion_testnet

# Bad example - no values specified
hyperagent workflow create \
  -d "Create ERC20 token" \
  --network hyperion_testnet
```

2. **Verify constructor arguments**:

```bash
# Check generated constructor args
hyperagent workflow status --workflow-id <workflow_id> | grep constructor
```

3. **Override manually if needed**:

```bash
hyperagent deployment deploy \
  --contract-id <contract_id> \
  --network hyperion_testnet \
  --constructor-args '["MyToken", "MTK", 1000000]'
```

### Expected Result

- Constructor arguments automatically extracted from description
- Values generated using AI from your description
- Correct number and types of arguments passed to deployment

### Tips

- Always specify constructor values in your NLP description
- Format: `'name'` for strings, numbers without quotes, `0x...` for addresses
- Check constructor signature in generated contract code if unsure

### Common Constructor Patterns

**ERC20 Token**:
```bash
-d "Create ERC20 token with name 'TokenName', symbol 'SYMBOL', and initial supply of 1000000"
```

**ERC721 NFT**:
```bash
-d "Create ERC721 NFT with name 'NFTName', symbol 'NFT', and base URI 'https://api.example.com/metadata/'"
```

**Custom Contract**:
```bash
-d "Create voting contract with name 'DAO Voting', minimum voting period of 7 days, and quorum threshold of 50 percent"
```

---

## Export and Share Contracts

**Goal**: Export generated contracts for sharing or backup.

### Prerequisites

- Completed workflow with generated contract

### Steps

1. **Export workflow**:

```bash
hyperagent workflow export --workflow-id <workflow_id> --output workflow.json
```

2. **Export contract code**:

```bash
# Get contract details
hyperagent contract show --contract-id <contract_id>

# Save to file
hyperagent contract show --contract-id <contract_id> --format json > contract.json
```

3. **Share deployment details**:

```bash
# Get deployment information
hyperagent deployment show --deployment-id <deployment_id>

# Includes:
# - Contract address
# - Transaction hash
# - Explorer links
# - Network information
```

### Expected Result

- Workflow data exported to JSON file
- Contract source code and ABI available
- Deployment details with explorer links

### Tips

- Export workflows for backup before deletion
- Share explorer links for deployed contracts
- Include contract ABI for integration with other tools

---

## Troubleshooting Common Issues

**Goal**: Resolve common problems when using HyperAgent.

### Issue: Workflow Stuck at "Generating"

**Symptoms**: Workflow status shows "generating" for extended period.

**Solutions**:
1. Check LLM API key is valid:
   ```bash
   # Test Gemini API
   python -c "import google.generativeai as genai; genai.configure(api_key='YOUR_KEY'); print('OK')"
   ```

2. Check API quota/rate limits
3. Review logs for errors:
   ```bash
   docker-compose logs -f hyperagent
   ```

### Issue: Deployment Fails with "Insufficient Balance"

**Symptoms**: Deployment fails with balance error.

**Solutions**:
1. Check wallet balance:
   ```bash
   hyperagent wallet balance --network hyperion_testnet
   ```

2. Get testnet tokens from faucet
3. Verify `PRIVATE_KEY` in `.env` matches funded wallet

### Issue: Constructor Arguments Mismatch

**Symptoms**: Deployment fails with "Incorrect argument count" error.

**Solutions**:
1. Verify constructor values in description:
   ```bash
   # Check what was generated
   hyperagent workflow status --workflow-id <workflow_id>
   ```

2. Manually override constructor args:
   ```bash
   hyperagent deployment deploy \
     --contract-id <contract_id> \
     --constructor-args '["value1", "value2", 123]'
   ```

3. Check constructor signature in generated contract

### Issue: API Connection Failed

**Symptoms**: CLI cannot connect to API.

**Solutions**:
1. Verify API is running:
   ```bash
   curl http://localhost:8000/api/v1/health
   ```

2. Check API URL in CLI config:
   ```bash
   hyperagent config show
   ```

3. Update API URL if needed:
   ```bash
   # If using Docker, use localhost
   # If using remote, update API_HOST in .env
   ```

### Issue: Progress Not Updating

**Symptoms**: Workflow status shows old progress percentage.

**Solutions**:
1. Refresh status:
   ```bash
   hyperagent workflow status --workflow-id <workflow_id> --watch
   ```

2. Check if workflow is actually running:
   ```bash
   # Check logs
   docker-compose logs -f hyperagent | grep <workflow_id>
   ```

3. Restart API if needed:
   ```bash
   docker-compose restart hyperagent
   ```

---

## Related Documentation

- **[Getting Started Guide](./GETTING_STARTED.md)** - Initial setup and installation
- **[API Documentation](./API.md)** - Complete API reference
- **[Deployment Guide](./DEPLOYMENT.md)** - Detailed deployment procedures
- **[Troubleshooting Guide](../docs/TROUBLESHOOTING.md)** - Comprehensive troubleshooting

---

## Need Help?

- Check [Troubleshooting Guide](../docs/TROUBLESHOOTING.md) for detailed solutions
- Review API documentation at `http://localhost:8000/api/v1/docs`
- Open an issue on [GitHub](https://github.com/JustineDevs/HyperAgent)

