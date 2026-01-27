<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Step-by-step to clone all and adapt a TypeScript agent framework for our use and give me a prompt what should I describe

Here’s a **step-by-step blueprint** to clone VoltAgent, adapt it for HyperKit, and ship a working smart contract security agent in under a day. [^1][^2]

***

## Prerequisites (5 minutes)

- Node.js ≥ v20 and pnpm installed
- OpenAI API key (or Anthropic/Gemini)
- GitHub CLI (`gh`) for forking

***

## Step 1: Fork \& Clone VoltAgent (2 minutes)

```bash
# Fork the repo to your HyperKit org
gh repo fork VoltAgent/voltagent --clone=true --org=hyperkit-labs

# Clone your fork
git clone https://github.com/hyperkit-labs/voltagent.git
cd voltagent
pnpm install
```


***

## Step 2: Run the Console \& Hello-World Agent (3 minutes)

```bash
# Start the built-in console (UI on localhost:3000)
pnpm dev:console

# In another terminal, run the example agent
cd examples/basic-agent
cp .env.example .env
# Add your API key to .env
pnpm dev
```

Open `http://localhost:3000` → you now have a live agent chat UI. [^1]

***

## Step 3: Create Your HyperKit Agent Package (5 minutes)

```bash
# In the repo root
mkdir -p packages/hyperkit-agent
cd packages/hyperkit-agent
pnpm init
```

Edit `package.json`:

```json
{
  "name": "@hyperkitlab/agent",
  "version": "0.1.0",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "voltagent": "workspace:*",
    "@hyperkitlab/sdk": "^0.1.0" // your existing SDK
  }
}
```


***

## Step 4: Define Your Agent \& Tools (15 minutes)

Create `packages/hyperkit-agent/src/index.ts`:

```typescript
import { Agent, openAI, tool } from 'voltagent';
import { HyperKitSDK } from '@hyperkitlab/sdk';

// Initialize your SDK
const hyperkit = new HyperKitSDK({ apiKey: process.env.HYPERKIT_API_KEY });

// Define a tool: Audit a contract
const auditContract = tool({
  name: 'audit_contract',
  description: 'Audit a smart contract for vulnerabilities using HyperKit',
  parameters: {
    contractAddress: { type: 'string', description: 'Contract address to audit' },
    chainId: { type: 'string', description: 'Chain ID (e.g., ethereum, polygon)' }
  },
  execute: async ({ contractAddress, chainId }) => {
    const report = await hyperkit.audit({
      address: contractAddress,
      chain: chainId,
      tools: ['slither', 'mythril']
    });
    return {
      summary: report.summary,
      vulnerabilities: report.vulnerabilities,
      recommendations: report.recommendations
    };
  }
});

// Define the agent
const hyperkitAgent = new Agent({
  name: 'HyperKit Security Agent',
  model: openAI('gpt-4o'),
  instructions: `You are an expert smart contract security auditor. 
  When given a contract address, use the audit_contract tool to analyze it.
  Explain vulnerabilities in plain English and provide code fixes.
  Always ask for clarification if the chain is not specified.`,
  tools: [auditContract]
});

// Start the agent server
hyperkitAgent.serve({ port: 8000 });
console.log('HyperKit agent running on http://localhost:8000');
```


***

## Step 5: Wire Tools into the Console (5 minutes)

Edit `packages/hyperkit-agent/src/index.ts` to register with the console:

```typescript
import { registerAgent } from 'voltagent/console';

// After defining hyperkitAgent
registerAgent(hyperkitAgent);
```

Now restart the console (`pnpm dev:console`) → your agent appears in the UI dropdown. [^1]

***

## Step 6: Add a Custom Skill (10 minutes)

Create `packages/hyperkit-agent/src/skills.ts`:

```typescript
import { Skill } from 'voltagent';

// A skill that generates a Foundry PoC for a vulnerability
export const generatePoCSkill = new Skill({
  name: 'generate_poc',
  description: 'Generate a Foundry proof-of-concept test for a vulnerability',
  execute: async (vuln: any) => {
    const template = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "forge-std/Test.sol";

contract ${vuln.name}PoC is Test {
    function testExploit() public {
        // TODO: Implement exploit simulation
        ${vuln.recommendation}
    }
}`;
    return template;
  }
});
```

Register it in your agent:

```typescript
import { generatePoCSkill } from './skills';

hyperkitAgent.addSkill(generatePoCSkill);
```


***

## Step 7: Deploy \& Demo (5 minutes)

```bash
# Build the agent
pnpm build

# Run in production mode
pnpm start

# Or deploy to Vercel/Render
vercel deploy --prod
```

You now have a **live API endpoint** that anyone can call:

```bash
curl -X POST https://your-agent.vercel.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Audit 0x123... on ethereum"}'
```


***

## Prompt to Describe This Project

Use this template for your GitHub README, landing page, or pitch:

***

### **HyperKit Security Agent**

**One-liner**: An AI agent that autonomously audits smart contracts, generates proof-of-concept exploits, and suggests fixes—powered by HyperKit and VoltAgent.

**The problem**: Smart contract security is manual, slow, and requires expert auditors. Teams ship vulnerable code because audits are expensive and bottlenecked.

**Our solution**: A TypeScript agent that:

- Takes a contract address + chain
- Runs HyperKit’s security toolkit (Slither, Mythril, custom rules)
- Explains vulnerabilities in plain English
- Auto-generates Foundry PoC tests for each bug
- Suggests ready-to-merge code fixes

**Tech stack**: Forked VoltAgent (open-source TS agent framework) + HyperKit SDK + OpenAI GPT-4o.

**Why we forked**: Building agent orchestration, memory, and UI from scratch would take months. VoltAgent gave us a production-ready console, tool-use primitives, and observability in 1 day.

**Current status**: Working MVP. Agent runs locally and on Vercel. Can audit Ethereum, Polygon, Base.

**Next**: Add multi-agent collaboration (planner + executor + validator agents), integrate with GitHub for auto-PRs, and launch a freemium tier.

***

This gives you a **shippable, demoable product** in a day, with a clear story about why you forked and what you added.

<div align="center">⁂</div>

[^1]: https://voltagent.dev

[^2]: https://github.com/VoltAgent/voltagent

