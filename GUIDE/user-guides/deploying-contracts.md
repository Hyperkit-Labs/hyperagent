# Deploying Smart Contracts with HyperAgent

HyperAgent makes smart contract deployment simple and accessible. You don't need to own native gas tokens like AVAX or ETH. Our gasless deployment system handles all network fees automatically.

## Gasless Deployment

### How It Works

When you deploy a contract with HyperAgent:

1. **You pay 0.10 USDC** as a service fee
2. **HyperAgent server wallet pays the network gas** (AVAX, ETH, etc.)
3. **Contract deploys in 10-30 seconds** depending on network congestion
4. **You receive full ownership** of the deployed contract address

No need to visit an exchange, buy gas tokens, or understand gas prices. Just connect your wallet and deploy.

---

## Step-by-Step Guide

### 1. Connect Your Wallet

Supported wallets:
- MetaMask
- Core Wallet
- OKX Wallet
- Phantom
- Coinbase Wallet
- Rainbow

Click "Connect Wallet" and approve the connection in your wallet.

### 2. Generate or Upload Contract

Choose one of:
- **AI Generation**: Describe your contract in plain English
- **Template**: Select from ERC-20, ERC-721, ERC-1155, or DEX templates
- **Upload**: Paste existing Solidity code

### 3. Review Contract

HyperAgent automatically:
- Compiles your Solidity code
- Runs security audits
- Estimates deployment costs
- Shows you the contract code

Review the contract details and security report.

### 4. Deploy

Click "Deploy Contract" and:

1. **Approve USDC Payment**: A popup will appear asking you to approve 0.10 USDC
2. **Wait for Deployment**: Server wallet pays gas and broadcasts transaction (10-30 seconds)
3. **Receive Contract Address**: Your contract is live on the blockchain

### 5. Verify and Interact

After deployment:
- View your contract on the blockchain explorer
- Copy the contract address
- Add to your dashboard
- Start interacting with your contract

---

## Supported Networks

### Avalanche
- **Fuji Testnet** (Testing)
- **Avalanche Mainnet** (Production)

### Coming Soon
- Polygon
- Ethereum
- Base
- Arbitrum
- SKALE
- BNB
---

## Security Model

### Who Signs What?

**Your Wallet Signs:**
- USDC payment authorization (0.10 USDC service fee)

**Server Wallet Signs:**
- Contract deployment transaction
- Gas payment for deployment

### Contract Ownership

You own the deployed contract from the moment it's created. The server wallet:
- Does NOT have admin rights to your contract
- Does NOT control your contract
- Cannot modify or upgrade your contract

The server wallet only pays for the deployment gas on your behalf.

### Server Wallet Disclosure

For transparency:
- **Server Wallet Address**: `0xa98107Fe1fEb5606B5163479e1b9B868234AdEE2` (Avalanche Fuji)
- **Purpose**: Pay network gas for user deployments
- **Security**: Private key stored in AWS Secrets Manager
- **Audit**: All deployments logged and auditable

---

## Pricing

| Action | Cost | What You Pay | What We Pay |
|---|---|---|---|
| Contract Deployment | 0.10 USDC | 0.10 USDC (service fee) | Network gas (AVAX/ETH) |
| Contract Generation | 0.01 USDC | 0.01 USDC (generation) | LLM API costs |
| Audit | Included | Free | Automated |

All prices in USDC. No hidden fees.

---

## Rate Limits

To prevent abuse and manage costs:

- **Per Wallet**: 10 deployments per hour
- **Per Network**: 100 deployments per hour

If you need higher limits for production use, contact support for enterprise pricing.

---

## Frequently Asked Questions

### Do I need AVAX to deploy on Avalanche?

No. HyperAgent pays all network gas fees. You only need USDC for the service fee.

### Who owns the deployed contract?

You own the contract address immediately. You can verify ownership on the blockchain explorer.

### Is my private key safe?

Yes. Your private key never leaves your wallet. HyperAgent never has access to your private keys.

### What if deployment fails?

If deployment fails due to network issues, you are NOT charged. The USDC payment only completes after successful deployment.

### Can I use my own gas?

Not currently. Gasless deployment is the only option to simplify the user experience. In V2, user-signed deployments with custom gas will be available.

### How long does deployment take?

Typically 10-30 seconds. During network congestion, it may take up to 2 minutes.

### Can I deploy the same contract multiple times?

Yes. Each deployment creates a new contract instance with a unique address.

### What happens if I run out of rate limit?

You'll see a message: "Rate limit exceeded: max 10 deployments per hour. Retry after X seconds."

Wait for the rate limit window to reset, or contact support for higher limits.

---

## Troubleshooting

### "Payment Required" Error

This means your USDC payment hasn't been confirmed yet. Check:
1. Do you have 0.10 USDC in your wallet?
2. Did you approve the payment popup?
3. Is your wallet connected to the correct network?

### "Rate Limit Exceeded" Error

You've deployed 10 contracts in the past hour. Wait for the rate limit to reset or contact support.

### "Deployment Failed" Error

This may happen if:
- Your contract has a compilation error
- The network is experiencing issues
- Gas estimation failed

Review the error message for specific details. Contact support if the issue persists.

---

## Advanced: Contract Verification

After deployment, you can verify your contract on the blockchain explorer:

1. Go to the explorer (e.g., Snowtrace for Avalanche)
2. Find your contract address
3. Click "Verify and Publish"
4. Upload your source code and compiler settings
5. Contract will show as "Verified" with source code visible

HyperAgent will soon support automatic contract verification.

---

## Need Help?

- **Discord**: [Join our community](https://discord.gg/hyperagent)
- **Email**: support@hyperagent.xyz
- **Documentation**: [Full docs](https://docs.hyperagent.xyz)
- **Status**: [Network status](https://status.hyperagent.xyz)

---

## Security Disclosure

For full security details, see [Server-Wallet Security Model](../security/server-wallet-model.md).

For security researchers, see our [Bug Bounty Program](../security/bug-bounty.md).

