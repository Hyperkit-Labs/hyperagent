# HyperAgent CLI - Global Installation Guide

## 🌐 Installing HyperAgent CLI Globally

There are two ways to make the `hyperagent` command available globally on your system:

### Method 1: Using npm link (Recommended for Development)

This method creates a symlink to your local development version, so changes are immediately reflected.

```bash
# From the project root
cd packages/cli

# Build the CLI first
npm run build

# Create global symlink
npm link

# Verify installation
hyperagent --version
```

Now you can use `hyperagent` from anywhere:

```bash
# From any directory
hyperagent init
hyperagent generate "Create an ERC20 token"
hyperagent audit contracts/MyToken.sol
hyperagent deploy contracts/MyToken.sol --network mantle-testnet
```

#### Unlinking

To remove the global symlink:

```bash
cd packages/cli
npm unlink -g
```

### Method 2: Global npm install (For Production Use)

This method installs the CLI globally from npm (requires publishing first).

```bash
# Install from npm (once published)
npm install -g @hyperagent/cli

# Or install from local package
cd packages/cli
npm pack
npm install -g hyperagent-cli-1.0.0.tgz
```

## 🔄 Updating the Global Installation

### For npm link:
```bash
# Navigate to CLI package
cd packages/cli

# Rebuild
npm run build

# The link automatically uses the new build
```

### For global install:
```bash
# Reinstall
npm install -g @hyperagent/cli@latest
```

## 🛠️ Troubleshooting

### Command not found after npm link

**Windows (PowerShell/CMD):**
```powershell
# Check npm global bin directory
npm config get prefix

# Add to PATH if needed (PowerShell)
$env:Path += ";C:\Users\<YourUsername>\AppData\Roaming\npm"

# Or permanently via System Properties > Environment Variables
```

**macOS/Linux:**
```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH in ~/.bashrc or ~/.zshrc
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

### Permission errors on macOS/Linux

```bash
# Use sudo (not recommended)
sudo npm link

# Or fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### TypeScript errors

```bash
# Make sure dependencies are installed
cd packages/cli
npm install

# Rebuild
npm run build
```

## 📦 Package Structure

The CLI package is configured for global installation:

**package.json:**
```json
{
  "name": "@hyperagent/cli",
  "version": "1.0.0",
  "bin": {
    "hyperagent": "./dist/index.js"
  }
}
```

**dist/index.js** (first line):
```javascript
#!/usr/bin/env node
```

This shebang tells the system to execute the file with Node.js.

## 🚀 Quick Start After Global Install

```bash
# 1. Create a new project directory
mkdir my-web3-project
cd my-web3-project

# 2. Initialize HyperAgent
hyperagent init

# 3. Generate a contract
hyperagent generate "Create an ERC721 NFT collection"

# 4. Audit the generated contract
hyperagent audit contracts/NFTCollection.sol

# 5. Deploy to testnet
hyperagent deploy contracts/NFTCollection.sol --network mantle-testnet
```

## 🔗 Integration with Other Tools

### Use with npx (No installation required)

```bash
# Run directly from npm (once published)
npx @hyperagent/cli generate "Create a token"

# Or from local package
cd packages/cli
npm pack
npx ./hyperagent-cli-1.0.0.tgz generate "Create a token"
```

### Use in package.json scripts

```json
{
  "scripts": {
    "contract:generate": "hyperagent generate",
    "contract:audit": "hyperagent audit",
    "contract:deploy": "hyperagent deploy"
  }
}
```

## 📝 Environment Variables

The CLI respects the following environment variables:

```bash
# LLM API Keys
GEMINI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key

# Blockchain
PRIVATE_KEY=your_private_key
THIRDWEB_CLIENT_ID=your_client_id

# Networks
RPC_URLS='{"avalanche_fuji":"https://api.avax-test.network/ext/bc/C/rpc"}'
```

Set these in your shell profile or use a `.env` file in your project directory.

## 🎯 Best Practices

1. **Development**: Use `npm link` for active development
2. **Testing**: Use `npm pack` + local install for testing before publishing
3. **Production**: Install from npm registry for end users
4. **CI/CD**: Use `npx` to avoid global installation in pipelines

## 📚 Additional Resources

- [CLI Usage Guide](./CLI_USAGE.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [API Documentation](../../docs/api/)
