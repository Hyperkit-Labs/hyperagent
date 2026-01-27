# Hyperkit CLI - Quick Start Guide

> **💡 Want to use `hyperagent` globally?** See the [Global Installation Guide](./packages/cli/GLOBAL_INSTALL.md) for `npm link` and global install instructions.

## 🚀 Running Hyperkit from Project Root

You can now run the Hyperkit CLI from the project root using multiple methods:

### Method 1: Using npm scripts (Recommended)
```bash
# Show help
npm run hyperagent -- --help

# Initialize workspace
npm run hyperagent -- init

# Generate a contract
npm run hyperagent -- generate "Create an ERC20 token called MyToken"

# Audit a contract
npm run hyperagent -- audit path/to/Contract.sol

# Deploy a contract
npm run hyperagent -- deploy path/to/Contract.sol --network mantle-testnet
```

### Method 2: Using the batch file (Windows CMD)
```cmd
# From project root
hyperagent --help
hyperagent generate "Create an ERC20 token"
```

### Method 3: Using the shell script (Git Bash/WSL)
```bash
# From project root
./hyperagent.sh --help
./hyperagent.sh generate "Create an ERC20 token"
```

### Method 4: Development mode (with auto-reload)
```bash
# For development - uses ts-node, no build needed
npm run hyperagent:dev generate "Create an ERC20 token"
```

## 📋 Available Commands

### `init` - Initialize Workspace
Creates a `hyperagent.config.json` configuration file in the current directory.

```bash
npm run hyperagent -- init
```

**Generated config:**
```json
{
  "project": {
    "name": "my-project",
    "network": "mantle-testnet"
  },
  "agent": {
    "model": "claude-3-5-sonnet-20241022",
    "autoApprove": false
  },
  "x402": {
    "paymentRequired": true,
    "maxSpendPerRun": 1.00
  }
}
```

### `generate` - Generate Smart Contract
Generates a smart contract from a natural language prompt using the Anti-Hallucination Engine.

```bash
npm run hyperagent -- generate "Create a simple ERC20 token called TestToken with symbol TT"
```

**Features:**
- ✅ Intent analysis and refinement
- ✅ x402 payment integration
- ✅ Automated security auditing
- ✅ Self-repair loop (anti-hallucination)
- ✅ Deterministic code generation

### `audit` - Audit Contract
Runs security analysis on an existing Solidity contract.

```bash
npm run hyperagent -- audit contracts/MyToken.sol
```

### `deploy` - Deploy Contract
Deploys a compiled contract to the specified network.

```bash
npm run hyperagent -- deploy contracts/MyToken.sol --network mantle-testnet
```

**Supported networks:**
- `mantle-testnet`
- `mantle-mainnet`
- `avalanche-fuji`
- `avalanche-mainnet`

## 🔧 Build & Development

### Build the CLI
```bash
npm run hyperagent:build
```

### Development Mode
```bash
# Run without building (uses ts-node)
npm run hyperagent:dev -- generate "Your prompt here"
```

## 🎯 Example Workflows

### Complete E2E Flow
```bash
# 1. Initialize workspace
npm run hyperagent -- init

# 2. Generate contract
npm run hyperagent -- generate "Create an ERC721 NFT collection called CoolNFTs"

# 3. Audit the generated contract
npm run hyperagent -- audit contracts/CoolNFTs.sol

# 4. Deploy to testnet
npm run hyperagent -- deploy contracts/CoolNFTs.sol --network mantle-testnet
```

### Quick Generation Test
```bash
npm run hyperagent -- generate "Create a simple counter contract with increment and decrement functions"
```

## 🐛 Troubleshooting

### Command not found
Make sure you're in the project root directory:
```bash
cd c:/Users/JustineDevs/Downloads/Hyperkit_agent
```

### Build errors
Rebuild the CLI:
```bash
npm run hyperagent:build
```

### Permission errors (Git Bash)
Make the script executable:
```bash
chmod +x hyperagent.sh
```

## 📚 Advanced Usage

### Custom Configuration
Edit `hyperagent.config.json` to customize:
- Default network
- AI model selection
- Payment limits
- Auto-approve settings

### Environment Variables
Set in `.env` file:
```env
GEMINI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
THIRDWEB_CLIENT_ID=your_client_id
```

## 🎨 Output Format

The CLI provides rich terminal output:
- 🎨 Colored status messages
- 📊 Progress indicators
- ✅ Success confirmations
- ❌ Error details
- 🔄 Self-repair loop status

## 🔗 Related Commands

```bash
# Check CLI version
npm run hyperagent -- --version

# Get help for specific command
npm run hyperagent -- help generate

# View all available commands
npm run hyperagent -- --help
```
