# CLI Interactive Mode Guide

The HyperAgent CLI offers an interactive mode for users who prefer guided prompts over command-line flags. This mode walks you through workflow creation step by step, making it accessible for beginners while remaining powerful for advanced users.

## What is Interactive Mode?

Interactive mode provides:
- Guided prompts for all workflow parameters
- Multi-line contract description support
- Network selection with feature previews
- Task configuration (audit, deployment, testing)
- Real-time progress monitoring
- Input validation at each step

## Prerequisites

### 1. Python Environment
Ensure Python 3.11+ is installed:
```bash
python --version
# Should show 3.11 or higher
```

### 2. Backend Services Running
The CLI communicates with the FastAPI backend. Start services using Docker:
```bash
# From project root
docker compose up -d

# Verify services are running
docker compose ps
```

Or run locally:
```bash
# Terminal 1: Start backend
cd hyperagent
uvicorn hyperagent.api.main:app --reload --port 8000

# Terminal 2: Start Redis (if using caching)
redis-server
```

### 3. Environment Configuration
Set required API keys in `.env`:
```env
# LLM Provider (at least one required)
GEMINI_API_KEY=your_gemini_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Blockchain RPC (optional - falls back to config/networks.yaml)
THIRDWEB_CLIENT_ID=your_thirdweb_client_id

# Deployment (required for deploy step)
DEPLOYER_PRIVATE_KEY=0x...your_private_key
```

### 4. Install CLI Dependencies
```bash
# From project root
pip install -r requirements.txt
```

## Starting Interactive Mode

### Method 1: Python Module (Recommended)
```bash
# From project root
python -m hyperagent.cli.main interactive
```

### Method 2: Direct CLI Script
```bash
# If CLI is globally installed
hyperagent interactive
```

## Step-by-Step Walkthrough

### Step 1: Contract Description
The CLI prompts for your contract description. This supports multi-line input.

```
[i] Contract Description:
[i] (Enter description, press Enter twice to finish)
```

**Example input:**
```
Create an ERC20 token called MyToken with symbol MTK
Supply: 1,000,000 tokens
Include mint and burn functions
Add role-based access control for minting

```
**Note:** Press Enter twice (one blank line) to finish the description.

**Tips:**
- Be specific about token economics (supply, decimals)
- Mention desired features (mint, burn, pause, transfer restrictions)
- Include access control requirements (owner-only, role-based)
- Reference standards (ERC20, ERC721, ERC1155)

### Step 2: Wallet Address
Enter your EVM-compatible wallet address. This is required for all workflows.

```
[>] Wallet Address:
[i] (Required for all workflows - format: 0x followed by 40 hex characters)
Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2
```

**Validation:**
- Must start with `0x`
- Must be exactly 42 characters long (0x + 40 hex digits)
- Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2`

**Where to get your wallet address:**
- **MetaMask**: Click account name at top, copy address
- **Core Wallet**: Tap account, select "Copy Address"
- **Phantom**: Click settings, copy address
- **Hardware Wallet**: Export public address from device

### Step 3: Network Selection
Choose which blockchain network to deploy to. The CLI shows available networks with feature support.

```
[>] Select Network:
  1. mantle_testnet (7/8 features)
  2. mantle_mainnet (7/8 features)
  3. avalanche_fuji (6/8 features)
  4. avalanche_mainnet (6/8 features)
  5. ethereum_mainnet (8/8 features)
  6. polygon_mainnet (7/8 features)
Network [1]: 1
```

**Network features explained:**
- **7/8 features**: Network supports most HyperAgent capabilities
- **8/8 features**: Full feature support (account abstraction, gasless, etc.)
- **6/8 features**: Basic support (may lack gasless or x402)

**Choosing a network:**
- **Testnet** (fuji, sepolia): For development and testing (free gas from faucets)
- **Mainnet**: For production deployments (requires real funds)
- **Mantle**: Recommended for low-cost deployments ($0.001 gas)
- **Ethereum**: Most established, highest gas fees ($5-50)
- **Avalanche**: Fast finality, moderate fees ($0.10-2)

### Step 4: Contract Type
Select the primary contract standard.

```
[>] Contract Type:
  1. ERC20
  2. ERC721
  3. ERC1155
  4. Custom
Type [4]: 1
```

**Contract types:**
1. **ERC20**: Fungible tokens (currencies, utility tokens)
2. **ERC721**: Non-fungible tokens (NFTs, unique assets)
3. **ERC1155**: Multi-token standard (gaming, mixed assets)
4. **Custom**: Advanced contracts (DEX, lending, governance)

**Template features by type:**
- **ERC20**: Mint, burn, pause, role-based access, supply cap
- **ERC721**: Mint, burn, transfer, URI storage, royalties
- **ERC1155**: Batch operations, URI per token, hybrid tokens
- **Custom**: No template (AI generates from description)

### Step 5: Task Options
Configure which workflow tasks to execute.

```
[>] Options:
Run security audit? [Y/n]: Y
Deploy to blockchain? [Y/n]: Y
```

**Task breakdown:**
- **Security Audit** (Y): Runs Slither static analysis, checks for vulnerabilities
- **Deploy to Blockchain** (Y): Compiles and deploys contract to selected network

**When to skip tasks:**
- Skip audit: Quick prototyping, trusted code, re-deploy
- Skip deployment: Code review only, local testing

## Real-Time Progress Monitoring

After submitting your workflow, the CLI enters monitoring mode with a live progress bar.

### Progress Display
```
[...] Workflow |████████████████████--------| 67% - Auditing contract...
```

**Progress stages:**
1. **Generating** (0-30%): AI creates Solidity code
2. **Compiling** (30-50%): Foundry compiles contract
3. **Auditing** (50-75%): Slither analyzes security
4. **Testing** (75-90%): Runs unit tests
5. **Deploying** (90-100%): Sends transaction to network

### Monitoring Controls
- **Ctrl+C**: Stop monitoring (workflow continues in background)
- **Poll interval**: Updates every 2 seconds
- **Auto-refresh**: Progress bar updates in-place

## Understanding Results

### Successful Completion
```
[✓] Workflow completed successfully!

Contract Details:
  Name: MyToken
  Symbol: MTK
  Address: 0x1234...5678
  Network: mantle_testnet (5003)
  Explorer: https://sepolia.mantlescan.xyz/address/0x1234...5678

Security Audit:
  Critical: 0
  High: 0
  Medium: 1
  Low: 2
  Info: 3
```

### Handling Errors
If the workflow fails, you'll see detailed error information:
```
[✗] Workflow failed: Compilation error

Error Details:
  File: MyToken.sol:45
  Message: ParserError: Expected ';' but got 'function'
  
Suggested fix:
  Add semicolon at line 45: uint256 public totalSupply;
```

**Common errors:**
- **Compilation**: Syntax errors, missing imports
- **Audit**: Critical security issues (reentrancy, overflow)
- **Deployment**: Insufficient gas, wrong network
- **API**: Backend not running, timeout

## Advanced Features

### Multi-Line Descriptions
For complex contracts, use detailed multi-line descriptions:
```
[i] Contract Description:
Create a decentralized exchange (DEX) contract
Features:
- Token swapping (ERC20 <> ERC20)
- Liquidity pools with LP tokens
- 0.3% swap fee
- Price oracle integration
- Slippage protection
Security requirements:
- Reentrancy guards on all functions
- Access control for admin functions
- Emergency pause mechanism

```

### Network Feature Preview
Before selecting a network, review its capabilities:
```
  1. mantle_testnet (7/8 features)
     ✓ EVM Compatible
     ✓ Account Abstraction
     ✓ Gasless Deployment
     ✓ x402 Payment
     ✓ Block Explorer
     ✓ Testnet Faucet
     ✓ Fast Finality
     ✗ Cross-chain Bridge
```

### Wallet Address Validation
The CLI validates wallet addresses in real-time:
```bash
Wallet Address: 0x123  # Too short
[✗] Invalid wallet address format. Expected 0x followed by 40 hexadecimal characters, got 5 characters

Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2  # Valid
[✓] Valid wallet address
```

## Integration with Other Tools

### Export Workflow ID
After creating a workflow, save the ID for later use:
```bash
# Interactive mode creates workflow
python -m hyperagent.cli.main interactive

# Output:
[✓] Workflow created: wf_abc123xyz

# Use workflow ID with other commands
python -m hyperagent.cli.main status wf_abc123xyz
python -m hyperagent.cli.main logs wf_abc123xyz
```

### Combine with Direct Commands
Start with interactive mode, then use direct commands for iteration:
```bash
# First: Create workflow interactively
python -m hyperagent.cli.main interactive

# Then: Check status directly
python -m hyperagent.cli.main status wf_abc123xyz

# Or: Re-audit a contract
python -m hyperagent.cli.main audit contracts/MyToken.sol
```

## Configuration Files

### Global CLI Config
Create `~/.hyperagent/config.json` for persistent settings:
```json
{
  "default_network": "mantle_testnet",
  "default_wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
  "auto_approve": false,
  "poll_interval": 2,
  "output_format": "table"
}
```

### Project-Level Config
Create `hyperagent.config.json` in your project directory:
```json
{
  "project": {
    "name": "my-defi-project",
    "network": "avalanche_fuji"
  },
  "agent": {
    "model": "claude-opus-4.5",
    "autoApprove": false
  },
  "x402": {
    "paymentRequired": true,
    "maxSpendPerRun": 1.00
  }
}
```

## Troubleshooting

### Issue: "Backend connection refused"
**Cause:** FastAPI backend is not running.

**Solution:**
```bash
# Start backend services
docker compose up -d

# Or run locally
python -m uvicorn hyperagent.api.main:app --reload
```

### Issue: "Invalid network configuration"
**Cause:** Network not found in `config/networks.yaml`.

**Solution:**
```bash
# Check available networks
cat config/networks.yaml

# Or list via CLI
python -m hyperagent.cli.main networks list
```

### Issue: "Deployment failed: insufficient funds"
**Cause:** Deployer wallet has no gas tokens.

**Solution:**
```bash
# Testnet: Get free tokens from faucet
# Mantle Sepolia: https://faucet.sepolia.mantle.xyz
# Avalanche Fuji: https://faucet.avax.network

# Mainnet: Transfer tokens to deployer wallet
# Check balance first:
python -m hyperagent.cli.main wallet balance
```

### Issue: "Workflow stuck at 45%"
**Cause:** Long-running audit or compilation.

**Solution:**
- Wait 2-5 minutes for complex contracts
- Press Ctrl+C to stop monitoring (workflow continues)
- Check logs: `docker compose logs -f hyperagent`
- Verify in dashboard: `http://localhost:3000/workflows`

### Issue: "Unicode encoding error" (Windows)
**Cause:** Windows terminal doesn't support Unicode characters.

**Solution:**
The CLI automatically uses ASCII-safe progress bars on Windows. If you still see errors:
```bash
# Set console encoding
chcp 65001

# Or use Git Bash instead of CMD
```

## Best Practices

### 1. Start with Testnets
Always test on testnets before mainnet deployment:
- **Avalanche Fuji**: Fast, free testnet
- **Mantle Sepolia**: Low-cost testnet
- **Ethereum Sepolia**: Most tested, widely supported

### 2. Use Descriptive Prompts
Good descriptions lead to better contracts:
- ✅ "Create ERC20 token with 1M supply, mint/burn, pausable"
- ❌ "Make me a token"

### 3. Review Audit Results
Always check security audit output:
- **Critical/High**: Fix before deployment
- **Medium**: Review and decide
- **Low/Info**: Optional improvements

### 4. Save Workflow IDs
Keep track of workflow IDs for reference:
```bash
# Create a deployment log
echo "$(date): MyToken deployed - wf_abc123xyz" >> deployments.log
```

### 5. Test Locally First
Use Foundry for local testing before deploying:
```bash
# After generation, test locally
cd contracts
forge test -vvv
```

## Example Workflows

### Example 1: Simple ERC20 Token
```bash
$ python -m hyperagent.cli.main interactive

[i] Contract Description:
Create an ERC20 token called SimpleToken with symbol SIMP
Total supply: 1,000,000 tokens
Include basic transfer functionality only

[>] Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2
[>] Network [1]: 1  # mantle_testnet
[>] Type [4]: 1     # ERC20
[>] Run security audit? [Y/n]: Y
[>] Deploy to blockchain? [Y/n]: Y

[...] Workflow |████████████████████████████| 100% - Deployed!
[✓] Workflow completed successfully!
```

### Example 2: Advanced NFT Collection
```bash
$ python -m hyperagent.cli.main interactive

[i] Contract Description:
Create an ERC721 NFT collection called CyberPunks
Features:
- Max supply: 10,000 NFTs
- Mint price: 0.1 ETH
- Whitelist for early access
- Royalties: 5% to creator
- Reveal mechanism for metadata
- Pausable minting

[>] Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2
[>] Network [1]: 5  # ethereum_mainnet
[>] Type [4]: 2     # ERC721
[>] Run security audit? [Y/n]: Y
[>] Deploy to blockchain? [Y/n]: n  # Review first

[...] Workflow |████████████████████--------| 75% - Auditing...
```

### Example 3: Custom DeFi Protocol
```bash
$ python -m hyperagent.cli.main interactive

[i] Contract Description:
Build a lending protocol with these features:
Core contracts:
1. LendingPool - deposit/withdraw/borrow/repay
2. InterestRateModel - calculate APY dynamically
3. PriceOracle - Chainlink integration
4. LiquidationEngine - liquidate undercollateralized positions
Parameters:
- Collateral ratio: 150%
- Liquidation bonus: 5%
- Supported assets: ETH, USDC, DAI
Security:
- ReentrancyGuard on all state-changing functions
- Timelock for admin operations
- Emergency pause mechanism

[>] Wallet Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2
[>] Network [1]: 3  # avalanche_fuji (test first)
[>] Type [4]: 4     # Custom
[>] Run security audit? [Y/n]: Y
[>] Deploy to blockchain? [Y/n]: n  # Manual review required

[...] Workflow |████████████████████--------| 75% - Auditing...
```

## Related Documentation

- [Deploying Contracts Guide](./deploying-contracts.md) - Detailed deployment instructions
- [Mantle Demo](./mantle-demo.md) - Step-by-step Mantle deployment
- [Global CLI Install](./GLOBAL_INSTALL.md) - Install CLI globally
- [CLI Usage](../../CLI_USAGE.md) - Direct command-line usage
- [YAML Config Architecture](../../docs/YAML_CONFIG_ARCHITECTURE.md) - Network configuration

## Support

### Community Resources
- **Discord**: https://discord.gg/hyperkit
- **GitHub Issues**: https://github.com/hyperkit/hyperagent/issues
- **Documentation**: https://docs.hyperkit.dev

### Getting Help
If you encounter issues:
1. Check this guide's troubleshooting section
2. Review backend logs: `docker compose logs -f hyperagent`
3. Search existing GitHub issues
4. Create a new issue with workflow ID and error logs

### Debug Mode
Enable verbose logging for troubleshooting:
```bash
# Set in .env
DEBUG=true
LOG_LEVEL=DEBUG

# Or via environment variable
DEBUG=true python -m hyperagent.cli.main interactive
```

## Summary

Interactive mode provides a user-friendly way to create smart contract workflows without memorizing command flags. It guides you through each step with validation, offers real-time progress updates, and integrates seamlessly with the HyperAgent backend.

**Key takeaways:**
- Use for guided workflow creation
- Press Enter twice to finish multi-line input
- Always test on testnets first
- Review audit results before deployment
- Save workflow IDs for reference

Ready to create your first interactive workflow? Run:
```bash
python -m hyperagent.cli.main interactive
```

