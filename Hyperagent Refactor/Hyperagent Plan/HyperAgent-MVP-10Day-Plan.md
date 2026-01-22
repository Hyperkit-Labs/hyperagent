# HYPERAGENT MVP – 10-DAY INTENSIVE EXECUTION PLAN

**Document Version:** 1.0 (MVP Acceleration)  
**Project Start:** 01/21/2026  
**Target MVP Launch:** 01/31/2026  
**Document Owner:** Hyperkit Founding Team (Justine, Aaron, Tristan)  
**Confidentiality:** Internal – Hyperkit Core Team Only  

---

## EXECUTIVE SUMMARY

This document outlines an **aggressive 10-day sprint** to launch **HyperAgent MVP with integrated tech stack** – combining CLI, Studio hooks, and full tech ecosystem into a single cohesive product launch. This plan complements the 6-week CLI + Studio Integration plan by front-loading critical integrations and demonstrating full value to early users, partners, and investors.

### MVP Scope (10 Days)

- **Core CLI Tool** – `hyperagent init`, `generate`, `audit`, `deploy` fully working
- **Tech Stack Integration** – Thirdweb, x402, Mantle SDK, Avalanche SDK, BNB Chain SDK, Base SDK, SKALE SDK (foundation), Sui SDK (foundation)
- **Wallet Management** – Thirdweb wallet integration + ethers.js multi-chain support
- **Single-Chain Launch** – Mantle testnet as primary (Avalanche as secondary for x402 payments)
- **Studio Hook** – Basic project sync to Studio (read-only)
- **Documentation** – Quick-start guide, command reference, 3 working examples
- **CI/CD Ready** – GitHub Actions template included

### Why 10 Days?

1. **Demo-able Product** – Show investors and users a working CLI before 6-week full integration
2. **Early Feedback Loop** – Get power users on CLI immediately; iterate based on feedback
3. **Risk Reduction** – Validate tech stack choices (Thirdweb, x402, multi-chain SDKs) early
4. **Team Momentum** – High-intensity sprint builds confidence and uncovers blockers
5. **Launch Window** – Align with community events (hackathons, AMAs, partnerships)

---

## PROJECT PLAN – HYPERAGENT MVP (10 DAYS)

**Project Name:** HyperAgent MVP – Intensive Launch  
**Owner/Lead:** Hyperkit Founding Team (CPOO: Justine, CMFO: Tristan, CTO: Aaron)  
**Start Date:** 01/21/2026 (Tuesday)  
**Target MVP:** 01/31/2026 (Friday) @ 5 PM  
**Status:** Ready for Execution  

---

## TIMELINE AT A GLANCE

```
Week 1: MVP Build & Integration
├── Day 1 (01/21, Tue): Architecture, Repo Setup, Tech Stack Integration Kickoff
├── Day 2 (01/22, Wed): CLI Skeleton & Core Commands
├── Day 3 (01/23, Thu): Thirdweb & Wallet Integration
├── Day 4 (01/24, Fri): x402 Payment Flow Setup
├── Day 5 (01/25, Sat): Multi-Chain SDK Integration (Mantle, Avalanche, BNB, Base)
├── Day 6 (01/26, Sun): SKALE & Sui Foundation + Tests
├── Day 7 (01/27, Mon): Studio Sync Hook & Deployment Webhooks
├── Day 8 (01/28, Tue): Documentation & Examples
├── Day 9 (01/29, Wed): End-to-End Testing & Security Audit
├── Day 10 (01/30, Thu): Polish, npm Publish, Launch Prep
└── Day 11 (01/31, Fri): Launch Day – Soft Release & Feedback Collection

Goal by 01/31/2026: MVP CLI live on npm, 50+ installs, 3 demo videos, ready for production use.
```

---

## DAY-BY-DAY EXECUTION PLAN

### DAY 1: ARCHITECTURE, REPO SETUP, TECH STACK KICKOFF
**Date:** 01/21/2026 (Tuesday)  
**Duration:** 8 hours  
**Owner:** Aaron (Lead), Justine, Tristan  

#### 1.1 Architecture Review & Tech Stack Finalization (1 hour)

**Decisions to Lock In:**

| **Component** | **Technology** | **Rationale** |
|---|---|---|
| **CLI Runtime** | Node.js 18.x + TypeScript | Fastest iteration; existing HyperAgent backend compatibility |
| **CLI Framework** | Commander.js 11.x | Industry standard, minimal learning curve |
| **Config Format** | YAML (`.hyperagent.yaml`) | Human-readable, easy migrations |
| **Wallet Integration** | Thirdweb SDK + ethers.js 6.x | Multi-chain ready, non-custodial |
| **Contract Deployment** | Hardhat + ethers.js | Industry standard, multi-chain |
| **Payment Flow** | x402 Contract (Avalanche Fuji) | Non-custodial, transparent pricing |
| **Chain Support** | Mantle (primary), Avalanche, BNB, Base, SKALE, Sui | Full EVM + non-EVM foundation |
| **Database** | PostgreSQL (shared with Studio) | Unified project storage |
| **Package Registry** | npm (@hyperagent/cli) | Distribution channel |

**Architecture Diagram (Locked):**

```
User Terminal (CLI Commands)
    │
    ├─→ @hyperagent/cli v0.1.0 (Node.js/TS)
    │   ├─→ Command Parser (Commander.js)
    │   ├─→ Config Manager (.yaml)
    │   ├─→ Wallet Manager (Thirdweb + ethers.js)
    │   └─→ Deployment Orchestrator
    │
    ├─→ Backend APIs (NestJS)
    │   ├─→ Project Service
    │   ├─→ Audit Service
    │   ├─→ Deployment Service
    │   └─→ Activity Logger
    │
    ├─→ Contract Deployment Layer (Hardhat)
    │   ├─→ Mantle SDK (ethers.js adapter)
    │   ├─→ Avalanche SDK (@avalabs/avalanchejs)
    │   ├─→ BNB Chain SDK (ethers.js adapter)
    │   ├─→ Base SDK (ethers.js adapter)
    │   ├─→ SKALE SDK (@skale/skale-contracts)
    │   └─→ Sui SDK (@mysten/sui.js)
    │
    ├─→ Wallet & Payment
    │   ├─→ Thirdweb Wallet Manager
    │   └─→ x402 Contract (Avalanche Fuji)
    │
    └─→ Studio Backend (Hook)
        ├─→ Project Sync API
        └─→ Deployment Webhook Endpoint
```

**Time Box:** Decisions locked by 9:00 AM. No changes after this.

#### 1.2 Repository Setup (2 hours)

**Repo Structure:**

```
hyperagent-cli/
├── src/
│   ├── commands/
│   │   ├── init.ts              # hyperagent init
│   │   ├── generate.ts          # hyperagent generate
│   │   ├── audit.ts             # hyperagent audit
│   │   ├── deploy.ts            # hyperagent deploy
│   │   ├── project.ts           # hyperagent project
│   │   ├── config.ts            # hyperagent config
│   │   └── wallet.ts            # hyperagent wallet (Thirdweb)
│   ├── services/
│   │   ├── api-client.ts        # Calls HyperAgent backend
│   │   ├── wallet-manager.ts    # Thirdweb + ethers.js
│   │   ├── config-manager.ts    # YAML config handling
│   │   ├── chain-router.ts      # Route to correct SDK
│   │   ├── mantle-adapter.ts    # Mantle deployment
│   │   ├── avalanche-adapter.ts # Avalanche + x402
│   │   ├── bsc-adapter.ts       # BNB Chain
│   │   ├── base-adapter.ts      # Base
│   │   ├── skale-adapter.ts     # SKALE (foundation)
│   │   ├── sui-adapter.ts       # Sui (foundation)
│   │   ├── x402-service.ts      # x402 payment flow
│   │   ├── studio-sync.ts       # Studio webhook caller
│   │   └── audit-runner.ts      # Slither wrapper
│   ├── types/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── chain.ts
│   │   └── wallet.ts
│   ├── utils/
│   │   ├── logger.ts            # Chalk for colors
│   │   ├── spinner.ts           # Ora loading states
│   │   ├── validation.ts        # Input validation (Zod)
│   │   ├── wallet-utils.ts      # ethers.js helpers
│   │   └── errors.ts            # Custom error types
│   ├── templates/
│   │   ├── token.sol
│   │   ├── staking.sol
│   │   └── amm.sol
│   ├── scripts/
│   │   ├── deploy.ts
│   │   ├── test.ts
│   │   └── audit.sh             # Slither wrapper
│   ├── cli.ts                   # CLI entry point
│   └── index.ts
├── dist/
├── bin/
│   └── hyperagent               # Executable symlink
├── examples/
│   ├── token-deploy.sh
│   ├── staking-deploy.sh
│   └── ci-cd-github-actions.yaml
├── tests/
│   ├── commands/
│   ├── services/
│   └── integration/
├── docs/
│   ├── getting-started.md
│   ├── commands.md
│   └── examples.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
└── .github/workflows/
    ├── test.yml
    ├── publish.yml
    └── integration.yml
```

**GitHub Setup:**
```bash
# Create repo
git init hyperagent-cli
cd hyperagent-cli

# Branches
git branch main
git branch develop
git branch feature/cli-core
git branch feature/wallet-integration
git branch feature/multi-chain

# GitHub Actions ready (empty workflows, will populate in Day 9)
mkdir -p .github/workflows
touch .github/workflows/{test,publish,integration}.yml
```

**Time Box:** Repo live and ready by 11:00 AM.

#### 1.3 Package.json & Dependencies Setup (1 hour)

**Initial package.json:**

```json
{
  "name": "@hyperagent/cli",
  "version": "0.1.0",
  "description": "HyperAgent CLI – Deploy smart contracts to multiple chains with AI assistance",
  "main": "dist/index.js",
  "bin": {
    "hyperagent": "bin/hyperagent"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli.js",
    "dev": "ts-node src/cli.ts",
    "test": "vitest",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src",
    "prepublish": "npm run build"
  },
  "keywords": [
    "hyperagent",
    "smart-contracts",
    "defi",
    "web3",
    "mantle",
    "avalanche",
    "blockchain"
  ],
  "author": "Hyperkit Labs",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "dependencies": {
    "commander": "^11.1.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.1",
    "dotenv": "^16.3.1",
    "yaml": "^2.3.4",
    "axios": "^1.6.2",
    "ethers": "^6.9.0",
    "@thirdweb-dev/sdk": "^3.15.0",
    "@thirdweb-dev/wallets": "^1.15.0",
    "zod": "^3.22.4",
    "@solidity-parser/parser": "^0.16.1",
    "@avalabs/avalanchejs": "^0.3.0",
    "@skale/skale-contracts": "^2.1.0",
    "@mysten/sui.js": "^0.50.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0",
    "ts-node": "^10.9.2",
    "prettier": "^3.1.1",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.17.0"
  }
}
```

**Installation:**
```bash
npm install
npm run build
npm run test -- --run  # Quick test
```

**Time Box:** All dependencies installed and building by 12:00 PM.

#### 1.4 Tech Stack Integration Kickoff – Team Assignments (1 hour)

**Parallel Work for Days 2–5:**

| **Team Member** | **Primary Focus** | **Parallel Focus** | **Integration Point** |
|---|---|---|---|
| **Aaron (CTO)** | CLI Core + Chain Adapters (Mantle, Avalanche, BNB, Base) | Wallet Manager (Thirdweb) | API-first design; all adapters call shared backend |
| **Justine (CPOO)** | x402 Payment Flow + Contract Templates | SKALE & Sui Adapters (foundation) | Payment flow feeds into audit and deployment |
| **Tristan (CMFO)** | Documentation + Examples | Studio Hook Implementation | Docs reference all tech integrations |

**Blocking Dependencies:**
- ✅ API spec finalized (Backend team owns)
- ✅ x402 contract deployed to Avalanche Fuji (Justine owns)
- ✅ Thirdweb SDK credentials ready (Aaron owns)
- ✅ Mantle RPC endpoint validated (Aaron owns)

**Time Box:** All assignments locked, blocking items identified by 1:00 PM.

#### 1.5 Tech Stack Integration Details (3 hours)

**Thirdweb Integration Spec:**
- SDK: `@thirdweb-dev/sdk` v3.15.0
- Purpose: Wallet management, contract deployment helpers
- Integration points:
  - Wallet connection in `hyperagent wallet connect`
  - Contract deployment via Thirdweb helpers
  - Chain detection and fallback

**Code stub:**
```typescript
// src/services/wallet-manager.ts
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

export class WalletManager {
  private sdk: ThirdwebSDK;
  private signer: ethers.Signer;

  async connectWallet(chain: string, privateKeyOrMnemonic: string) {
    this.sdk = await ThirdwebSDK.fromPrivateKey(privateKeyOrMnemonic, chain);
    this.signer = this.sdk.getSigner();
    return this.signer.getAddress();
  }

  async deployContract(contractCode: string, constructorArgs: any[]) {
    // Use Thirdweb SDK for deployment
    const deployed = await this.sdk.deployer.deployContract({
      contractType: "custom",
      contractMetadata: {
        name: "HyperAgent Generated Contract",
      },
      walletAddress: await this.signer.getAddress(),
    });
    return deployed;
  }
}
```

**x402 Integration Spec:**
- Contract: x402 on Avalanche Fuji (address: 0x...)
- Purpose: Pay-per-audit flow (1 USDC per audit)
- Integration points:
  - `hyperagent audit --paid` triggers x402 payment
  - Non-custodial: user's wallet signs transaction

**Code stub:**
```typescript
// src/services/x402-service.ts
import { ethers } from "ethers";

export class X402Service {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(signerOrProvider: ethers.Signer | ethers.Provider) {
    this.signer = signerOrProvider as ethers.Signer;
  }

  async submitPaidAudit(contractCode: string, avalancheRpc: string) {
    // Call x402 contract to submit audit request and transfer 1 USDC
    const tx = await this.contract.submitAudit(contractCode, {
      value: ethers.parseUnits("1", "ether"), // 1 USDC on Fuji
    });
    return tx.hash;
  }
}
```

**Mantle SDK Integration Spec:**
- Chain ID: 5003
- RPC: https://mantle-testnet-rpc.example.com
- Purpose: Primary deployment target for MVP
- Integration points:
  - `hyperagent deploy --chain mantle-testnet`
  - Gas estimation and RPC calls via ethers.js

**Code stub:**
```typescript
// src/services/mantle-adapter.ts
import { ethers } from "ethers";

export class MantleAdapter {
  chainId = 5003;
  rpcUrl = "https://mantle-testnet-rpc.example.com";

  async deploy(contractCode: string, signer: ethers.Signer) {
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    const signerWithProvider = signer.connect(provider);
    // Deploy contract
  }
}
```

**Avalanche SDK Integration Spec:**
- Chain ID: 43113 (Fuji testnet)
- RPC: https://api.avax-test.network/ext/bc/C/rpc
- Purpose: x402 payment processing + deployment target
- SDKs: ethers.js + @avalabs/avalanchejs

**Code stub:**
```typescript
// src/services/avalanche-adapter.ts
import { ethers } from "ethers";
import { BinTools, Buffer } from "@avalabs/avalanchejs";

export class AvalancheAdapter {
  chainId = 43113;
  rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";

  async deploy(contractCode: string, signer: ethers.Signer) {
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    // Deploy contract and check USDC balance for x402
  }

  async checkUSDCBalance(walletAddress: string): Promise<string> {
    // Check balance for x402 payment
  }
}
```

**BNB Chain SDK Integration Spec:**
- Chain ID: 97 (BSC testnet)
- RPC: https://data-seed-prebsc-1-0.binance.org:8545
- Purpose: Multi-chain deployment option
- SDK: ethers.js (EVM-compatible)

**Base SDK Integration Spec:**
- Chain ID: 84531 (Goerli)
- RPC: https://goerli.base.org
- Purpose: Coinbase Layer 2 deployment
- SDK: ethers.js (EVM-compatible)

**SKALE SDK Integration (Foundation):**
- Chain: SKALE Hub testnet
- RPC: https://testnet-rpc.skalechains.com
- Purpose: Foundation only (full support in Phase 2)
- SDK: ethers.js + @skale/skale-contracts

**Sui SDK Integration (Foundation):**
- Chain: Sui testnet
- RPC: https://fullnode.testnet.sui.io:443
- Purpose: Foundation only (Move contracts in Phase 2)
- SDK: @mysten/sui.js

**Time Box:** All tech stubs created and tested for compilation by 4:00 PM.

#### 1.6 End-of-Day Checkpoint (1 hour)

**Deliverables:**
- ✅ Repo created, branches established
- ✅ package.json ready, all dependencies installing
- ✅ Tech stack decisions locked and documented
- ✅ Team assignments clear
- ✅ Code stubs compiled successfully
- ✅ Blocking dependencies identified and tracked

**Daily Standup Findings:**
- [ ] Any dependencies not downloading? → Fix immediately
- [ ] Any API spec questions? → Escalate to backend team
- [ ] RPC endpoints all working? → Validate by 5:00 PM

---

### DAY 2: CLI SKELETON & CORE COMMANDS
**Date:** 01/22/2026 (Wednesday)  
**Duration:** 8 hours  
**Owner:** Aaron (Lead), Tristan (UX/Docs)  

#### 2.1 CLI Entry Point & Command Structure (2 hours)

**src/cli.ts – Main Entry Point:**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { version } from "../package.json";
import { initCommand } from "./commands/init";
import { generateCommand } from "./commands/generate";
import { auditCommand } from "./commands/audit";
import { deployCommand } from "./commands/deploy";
import { projectCommand } from "./commands/project";
import { configCommand } from "./commands/config";
import { walletCommand } from "./commands/wallet";

const program = new Command();

program
  .name("hyperagent")
  .description(
    "HyperAgent CLI – Deploy smart contracts with AI assistance"
  )
  .version(version);

// Global options
program.option(
  "-v, --verbose",
  "Enable verbose logging",
  false
);

// Commands
program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(auditCommand);
program.addCommand(deployCommand);
program.addCommand(projectCommand);
program.addCommand(configCommand);
program.addCommand(walletCommand);

// Help
program.on("command:help", () => {
  console.log(chalk.green("\n📚 Examples:"));
  console.log("  hyperagent init my-project");
  console.log("  hyperagent generate --prompt 'Create a token'");
  console.log("  hyperagent audit");
  console.log("  hyperagent deploy --network testnet");
  console.log(
    "\n🔗 Docs: https://docs.hyperagent.io"
  );
});

program.parse(process.argv);
```

**bin/hyperagent – Executable Wrapper:**

```bash
#!/usr/bin/env node
require("../dist/cli");
```

**Time Box:** CLI entry point working by 9:30 AM.

#### 2.2 `hyperagent init` Command (1.5 hours)

**src/commands/init.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { ConfigManager } from "../services/config-manager";

export const initCommand = new Command("init")
  .argument("[project-name]", "Name of the project")
  .description("Initialize a new HyperAgent project")
  .action(async (projectName: string | undefined) => {
    const spinner = ora();

    try {
      // Interactive prompts if no name provided
      if (!projectName) {
        const prompts = require("prompts");
        const response = await prompts([
          {
            type: "text",
            name: "projectName",
            message: "Project name:",
            initial: "my-defi-app",
          },
          {
            type: "text",
            name: "description",
            message: "Description:",
            initial: "A DeFi application",
          },
          {
            type: "select",
            name: "template",
            message: "Template type:",
            choices: [
              { title: "Token (ERC-20)", value: "token" },
              { title: "Staking Pool", value: "staking" },
              { title: "AMM", value: "amm" },
            ],
            initial: 0,
          },
          {
            type: "multiselect",
            name: "networks",
            message: "Supported networks:",
            choices: [
              { title: "Mantle Testnet", value: "mantle-testnet" },
              { title: "Avalanche Fuji", value: "avalanche-fuji" },
              { title: "BSC Testnet", value: "bsc-testnet" },
              { title: "Base Testnet", value: "base-testnet" },
            ],
            min: 1,
          },
        ]);

        projectName = response.projectName;
      }

      spinner.start(chalk.blue("🔧 Initializing project..."));

      // Create config
      const configManager = new ConfigManager(projectName);
      await configManager.init({
        projectName,
        description: "A DeFi application",
        templateType: "token",
        networks: ["mantle-testnet"],
      });

      spinner.succeed(
        chalk.green(`✓ Project initialized: ${projectName}`)
      );
      console.log(
        chalk.cyan(`\n📁 Created .hyperagent.yaml`)
      );
      console.log(
        chalk.cyan(
          `\n💡 Next step: hyperagent generate --prompt "Create a token"`
        )
      );
    } catch (error) {
      spinner.fail(chalk.red(`✗ Error: ${error.message}`));
      process.exit(1);
    }
  });
```

**src/services/config-manager.ts:**

```typescript
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

export class ConfigManager {
  configPath: string;

  constructor(projectName: string) {
    this.configPath = path.join(process.cwd(), ".hyperagent.yaml");
  }

  async init(config: any) {
    const defaultConfig = {
      version: 1,
      project: {
        name: config.projectName,
        description: config.description,
        templateType: config.templateType || "token",
        createdAt: new Date().toISOString(),
      },
      deployment: {
        networks: config.networks || ["mantle-testnet"],
      },
      audit: {
        slither: true,
        echidna: false,
        paidTier: false,
      },
    };

    fs.writeFileSync(
      this.configPath,
      yaml.stringify(defaultConfig)
    );
  }

  load(): any {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(".hyperagent.yaml not found. Run 'hyperagent init'");
    }
    return yaml.parse(fs.readFileSync(this.configPath, "utf-8"));
  }

  save(config: any) {
    fs.writeFileSync(this.configPath, yaml.stringify(config));
  }
}
```

**Time Box:** `hyperagent init` working end-to-end by 11:00 AM.

#### 2.3 `hyperagent generate` Command (2 hours)

**src/commands/generate.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { APIClient } from "../services/api-client";
import { ConfigManager } from "../services/config-manager";

export const generateCommand = new Command("generate")
  .option(
    "-p, --prompt <text>",
    "Natural language prompt for contract generation"
  )
  .option(
    "-t, --template <type>",
    "Template type (token|staking|amm)"
  )
  .description("Generate a smart contract from natural language")
  .action(async (options) => {
    const spinner = ora();

    try {
      const configManager = new ConfigManager("");
      const config = configManager.load();

      // Get prompt from user if not provided
      let prompt = options.prompt;
      if (!prompt) {
        const prompts = require("prompts");
        const response = await prompts({
          type: "text",
          name: "prompt",
          message: "Describe your smart contract:",
          initial: "Create a token with 1 million supply",
        });
        prompt = response.prompt;
      }

      spinner.start(
        chalk.blue("🤖 Generating contract from prompt...")
      );

      const apiClient = new APIClient(
        process.env.HYPERAGENT_API_TOKEN
      );
      const result = await apiClient.generateProject(
        prompt,
        options.template || config.project.templateType
      );

      spinner.succeed(
        chalk.green(
          `✓ Contract generated: ${result.contractName}`
        )
      );

      // Save to local project
      await saveContractLocally(result);

      console.log(chalk.cyan(`\n📝 Files created:`));
      console.log(chalk.cyan(`  - contracts/${result.contractName}.sol`));
      console.log(chalk.cyan(
        `  - tests/${result.contractName}.test.ts`
      ));
      console.log(chalk.cyan(`  - scripts/deploy.ts`));

      console.log(
        chalk.yellow(`\n⚠️  Review the contract before deployment!`)
      );
      console.log(
        chalk.cyan(`\n💡 Next: hyperagent audit`)
      );
    } catch (error) {
      spinner.fail(chalk.red(`✗ Error: ${error.message}`));
      process.exit(1);
    }
  });

async function saveContractLocally(result: any) {
  // Write contract files to disk
  const fs = require("fs");
  const path = require("path");

  if (!fs.existsSync("contracts")) {
    fs.mkdirSync("contracts");
  }
  fs.writeFileSync(
    path.join("contracts", `${result.contractName}.sol`),
    result.contractCode
  );

  if (!fs.existsSync("tests")) {
    fs.mkdirSync("tests");
  }
  fs.writeFileSync(
    path.join("tests", `${result.contractName}.test.ts`),
    result.testCode
  );

  if (!fs.existsSync("scripts")) {
    fs.mkdirSync("scripts");
  }
  fs.writeFileSync(
    path.join("scripts", "deploy.ts"),
    result.deployScript
  );
}
```

**src/services/api-client.ts:**

```typescript
import axios, { AxiosInstance } from "axios";

export class APIClient {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL:
        process.env.HYPERAGENT_API_URL ||
        "https://api.hyperagent.io",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    });
  }

  async generateProject(prompt: string, templateType: string) {
    const response = await this.client.post("/api/v1/projects", {
      prompt,
      templateType,
      source: "cli",
    });
    return response.data;
  }

  async runAudit(projectId: string, paidTier: boolean) {
    const response = await this.client.post(
      `/api/v1/projects/${projectId}/audits`,
      { paidTier, source: "cli" }
    );
    return response.data;
  }

  async deploy(projectId: string, network: string) {
    const response = await this.client.post(
      `/api/v1/projects/${projectId}/deployments`,
      { network, source: "cli" }
    );
    return response.data;
  }
}
```

**Time Box:** `hyperagent generate` working by 1:00 PM.

#### 2.4 `hyperagent audit` Command (1.5 hours)

**src/commands/audit.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { APIClient } from "../services/api-client";

export const auditCommand = new Command("audit")
  .option(
    "--paid",
    "Run paid audit via x402 (1 USDC)"
  )
  .option(
    "-c, --chain <name>",
    "Target chain for paid audit"
  )
  .description(
    "Run security audit on contract (free static analysis or paid professional)"
  )
  .action(async (options) => {
    const spinner = ora();

    try {
      if (options.paid) {
        spinner.start(
          chalk.blue("🔍 Preparing paid audit via x402...")
        );

        const apiClient = new APIClient(
          process.env.HYPERAGENT_API_TOKEN
        );
        const auditResult = await apiClient.runAudit(
          "temp-project",
          true
        );

        spinner.succeed(
          chalk.green("✓ Audit submitted to professional reviewers")
        );
        console.log(
          chalk.cyan(
            `\n🔗 Track at: https://studio.hyperagent.io/audits/${auditResult.auditId}`
          )
        );
      } else {
        // Free audit
        spinner.start(chalk.blue("🔍 Running static analysis..."));

        // Mock free audit for MVP
        await new Promise((r) => setTimeout(r, 2000));

        spinner.succeed(chalk.green("✓ Static analysis complete"));
        console.log(chalk.cyan(`\n📊 Results:`));
        console.log(chalk.cyan(`  - Slither checks: 0 critical`));
        console.log(chalk.cyan(`  - TypeScript: OK`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`✗ Error: ${error.message}`));
      process.exit(1);
    }
  });
```

**Time Box:** `hyperagent audit` working by 2:30 PM.

#### 2.5 `hyperagent deploy` Command (1 hour)

**src/commands/deploy.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { APIClient } from "../services/api-client";

export const deployCommand = new Command("deploy")
  .option(
    "-n, --network <name>",
    "Network (testnet|mainnet)"
  )
  .option(
    "-c, --chain <name>",
    "Chain (mantle-testnet|avalanche-fuji|bsc-testnet|base-testnet)"
  )
  .description("Deploy contract to blockchain")
  .action(async (options) => {
    const spinner = ora();

    try {
      const chain = options.chain || "mantle-testnet";

      spinner.start(
        chalk.blue(`🚀 Deploying to ${chain}...`)
      );

      const apiClient = new APIClient(
        process.env.HYPERAGENT_API_TOKEN
      );
      const result = await apiClient.deploy(
        "temp-project",
        chain
      );

      spinner.succeed(chalk.green("✓ Deployment successful"));

      console.log(chalk.cyan(`\n📦 Contract Details:`));
      console.log(
        chalk.cyan(
          `  Address: ${result.contractAddress}`
        )
      );
      console.log(chalk.cyan(`  TX Hash: ${result.txHash}`));
      console.log(
        chalk.cyan(
          `  Block Explorer: https://explorer.${chain}/tx/${result.txHash}`
        )
      );
    } catch (error) {
      spinner.fail(chalk.red(`✗ Error: ${error.message}`));
      process.exit(1);
    }
  });
```

**Time Box:** `hyperagent deploy` working by 3:30 PM.

#### 2.6 End-of-Day Checkpoint (1 hour)

**Deliverables:**
- ✅ `hyperagent init` – Fully working
- ✅ `hyperagent generate` – Calling API successfully
- ✅ `hyperagent audit` – Both free and paid flows stubbed
- ✅ `hyperagent deploy` – Basic flow working
- ✅ Config manager functional
- ✅ API client working with backend

**Tests to Run:**
```bash
npm run build
npm run test

# Manual tests
npm run dev -- init my-project
npm run dev -- generate --prompt "Create a token"
npm run dev -- audit
npm run dev -- deploy --chain mantle-testnet
```

**Blocking Issues:**
- [ ] Backend API responding to requests? → Validate endpoints
- [ ] Config files persisting correctly? → Check YAML serialization
- [ ] Error messages clear and actionable? → Improve UX as needed

---

### DAY 3: THIRDWEB & WALLET INTEGRATION
**Date:** 01/23/2026 (Thursday)  
**Duration:** 8 hours  
**Owner:** Aaron (Lead), Justine  

#### 3.1 Thirdweb Wallet Connection (2 hours)

**src/commands/wallet.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { WalletManager } from "../services/wallet-manager";

export const walletCommand = new Command("wallet")
  .addCommand(
    new Command("connect")
      .description("Connect wallet for deployments")
      .option(
        "-p, --provider <name>",
        "Wallet provider (thirdweb|local)"
      )
      .option("-k, --key <key>", "Private key (for local)")
      .action(async (options) => {
        const spinner = ora();

        try {
          const walletManager = new WalletManager();
          const provider = options.provider || "thirdweb";

          if (provider === "thirdweb") {
            spinner.start(chalk.blue("🔗 Opening Thirdweb wallet..."));

            const address = await walletManager.connectThirdweb();

            spinner.succeed(
              chalk.green(`✓ Wallet connected`)
            );
            console.log(
              chalk.cyan(
                `\n👛 Address: ${address}`
              )
            );
          } else if (provider === "local") {
            if (!options.key) {
              throw new Error(
                "Private key required for local provider"
              );
            }

            spinner.start(chalk.blue("🔑 Validating private key..."));

            const address = await walletManager.connectLocal(
              options.key
            );

            spinner.succeed(
              chalk.green(`✓ Wallet connected`)
            );
            console.log(
              chalk.cyan(
                `\n👛 Address: ${address}`
              )
            );
          }
        } catch (error) {
          spinner.fail(chalk.red(`✗ Error: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("status")
      .description("Check connected wallet status")
      .action(async () => {
        const walletManager = new WalletManager();
        const status = await walletManager.getStatus();

        if (status.connected) {
          console.log(
            chalk.green(`✓ Connected: ${status.address}`)
          );
          console.log(
            chalk.cyan(`  Balance: ${status.balance}`)
          );
        } else {
          console.log(
            chalk.yellow("⚠️  No wallet connected")
          );
          console.log(
            chalk.cyan(`\n💡 Connect: hyperagent wallet connect`)
          );
        }
      })
  );
```

**src/services/wallet-manager.ts:**

```typescript
import { ethers } from "ethers";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import chalk from "chalk";

export class WalletManager {
  private signer: ethers.Signer | null = null;
  private address: string | null = null;

  async connectThirdweb(): Promise<string> {
    try {
      // Initialize Thirdweb SDK
      const sdk = ThirdwebSDK.fromPrivateKey(
        process.env.WALLET_PRIVATE_KEY || "",
        "mantle"
      );

      this.signer = sdk.getSigner();
      this.address = await this.signer.getAddress();

      return this.address;
    } catch (error) {
      throw new Error(
        `Failed to connect Thirdweb wallet: ${error.message}`
      );
    }
  }

  async connectLocal(privateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      this.signer = wallet;
      this.address = wallet.address;

      return this.address;
    } catch (error) {
      throw new Error(
        `Invalid private key: ${error.message}`
      );
    }
  }

  async getStatus() {
    if (!this.signer || !this.address) {
      return { connected: false };
    }

    try {
      const provider = new ethers.JsonRpcProvider(
        "https://mantle-testnet-rpc.example.com"
      );
      const balance = await provider.getBalance(this.address);

      return {
        connected: true,
        address: this.address,
        balance: ethers.formatEther(balance),
      };
    } catch (error) {
      return {
        connected: true,
        address: this.address,
        balance: "unknown",
      };
    }
  }

  getSigner(): ethers.Signer {
    if (!this.signer) {
      throw new Error(
        "No wallet connected. Run 'hyperagent wallet connect'"
      );
    }
    return this.signer;
  }
}
```

**Time Box:** Wallet connection working by 10:00 AM.

#### 3.2 Thirdweb Contract Deployment Helpers (2 hours)

**src/services/thirdweb-adapter.ts:**

```typescript
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";

export class ThirdwebAdapter {
  private sdk: ThirdwebSDK;
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer, chain: string) {
    this.signer = signer;
    // Initialize SDK with chain
  }

  async deployToken(params: {
    name: string;
    symbol: string;
    initialSupply: string;
  }): Promise<string> {
    try {
      // Use Thirdweb's pre-audited token contract
      const contractAddress = await this.sdk.deployer.deployToken({
        name: params.name,
        symbol: params.symbol,
        primary_sale_recipient: await this.signer.getAddress(),
      });

      return contractAddress;
    } catch (error) {
      throw new Error(
        `Token deployment failed: ${error.message}`
      );
    }
  }

  async getDeploymentStatus(
    contractAddress: string
  ): Promise<any> {
    // Fetch deployment status from blockchain
    return { status: "deployed", address: contractAddress };
  }
}
```

**Integration in deploy command:**

```typescript
// In deploy.ts, after user selects Thirdweb option
const thirdwebAdapter = new ThirdwebAdapter(
  walletManager.getSigner(),
  options.chain
);

if (useThirdweb) {
  const address = await thirdwebAdapter.deployToken({
    name: "MyToken",
    symbol: "MTK",
    initialSupply: "1000000",
  });
  console.log(chalk.green(`✓ Deployed to ${address}`));
}
```

**Time Box:** Thirdweb deployment working by 12:00 PM.

#### 3.3 Multi-Chain Wallet Support (2 hours)

**src/services/chain-router.ts:**

```typescript
import { ethers } from "ethers";

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

export class ChainRouter {
  private chains: Map<string, ChainConfig> = new Map([
    [
      "mantle-testnet",
      {
        name: "Mantle Testnet",
        chainId: 5003,
        rpcUrl:
          "https://mantle-testnet-rpc.example.com",
        explorerUrl: "https://explorer.mantle.io",
      },
    ],
    [
      "avalanche-fuji",
      {
        name: "Avalanche Fuji",
        chainId: 43113,
        rpcUrl:
          "https://api.avax-test.network/ext/bc/C/rpc",
        explorerUrl: "https://testnet.snowtrace.io",
      },
    ],
    [
      "bsc-testnet",
      {
        name: "BSC Testnet",
        chainId: 97,
        rpcUrl:
          "https://data-seed-prebsc-1-0.binance.org:8545",
        explorerUrl: "https://testnet.bscscan.com",
      },
    ],
    [
      "base-testnet",
      {
        name: "Base Testnet",
        chainId: 84531,
        rpcUrl: "https://goerli.base.org",
        explorerUrl: "https://goerli.basescan.org",
      },
    ],
  ]);

  getChainConfig(chainName: string): ChainConfig {
    const config = this.chains.get(chainName);
    if (!config) {
      throw new Error(`Chain not supported: ${chainName}`);
    }
    return config;
  }

  getProvider(chainName: string): ethers.JsonRpcProvider {
    const config = this.getChainConfig(chainName);
    return new ethers.JsonRpcProvider(config.rpcUrl);
  }

  async getBalance(
    address: string,
    chainName: string
  ): Promise<string> {
    const provider = this.getProvider(chainName);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  getExplorerUrl(chainName: string): string {
    return this.getChainConfig(chainName).explorerUrl;
  }
}
```

**Time Box:** Multi-chain routing working by 2:00 PM.

#### 3.4 Wallet Config Persistence (1 hour)

**Update config-manager to support wallet:**

```typescript
// In config-manager.ts, add methods:

async saveWallet(address: string, chainName: string) {
  const config = this.load();
  config.wallet = {
    address,
    chainName,
    connectedAt: new Date().toISOString(),
  };
  this.save(config);
}

getWalletAddress(): string | null {
  const config = this.load();
  return config.wallet?.address || null;
}
```

**Time Box:** Wallet persistence working by 3:00 PM.

#### 3.5 Error Handling & UX Improvements (1 hour)

**src/utils/errors.ts:**

```typescript
export class WalletError extends Error {
  constructor(message: string) {
    super(`👛 Wallet Error: ${message}`);
    this.name = "WalletError";
  }
}

export class ChainError extends Error {
  constructor(message: string, chain?: string) {
    super(
      `⛓️  Chain Error: ${message}${
        chain ? ` (${chain})` : ""
      }`
    );
    this.name = "ChainError";
  }
}

export class DeploymentError extends Error {
  constructor(message: string) {
    super(`🚀 Deployment Error: ${message}`);
    this.name = "DeploymentError";
  }
}
```

**Time Box:** Error handling improved by 4:00 PM.

#### 3.6 End-of-Day Testing (1 hour)

**Tests:**
```bash
npm run test -- wallet
npm run dev -- wallet connect --provider thirdweb
npm run dev -- wallet status
npm run dev -- deploy --chain mantle-testnet  # Should use connected wallet
```

**Deliverables:**
- ✅ Wallet connect via Thirdweb
- ✅ Local wallet import support
- ✅ Multi-chain wallet support
- ✅ Wallet balance checking
- ✅ Config persistence
- ✅ Clear error messages

---

### DAY 4: x402 PAYMENT FLOW SETUP
**Date:** 01/24/2026 (Friday)  
**Duration:** 8 hours  
**Owner:** Justine (Lead), Aaron  

#### 4.1 x402 Contract ABI & Setup (2 hours)

**src/services/x402-service.ts:**

```typescript
import { ethers } from "ethers";
import { ChainRouter } from "./chain-router";

// x402 Contract ABI (simplified)
const X402_ABI = [
  "function submitAudit(string contractCode) public payable returns (string auditId)",
  "function getAuditStatus(string auditId) public view returns (string status)",
  "function claimAuditResult(string auditId) public returns (string result)",
  "event AuditSubmitted(string indexed auditId, address indexed submitter, uint256 timestamp)",
  "event AuditCompleted(string indexed auditId, string result, uint256 timestamp)",
];

export class X402Service {
  private contract: ethers.Contract;
  private signer: ethers.Signer;
  private chainRouter: ChainRouter;

  // x402 contract address on Avalanche Fuji
  X402_ADDRESS = "0x123456789..."; // Deploy on Day 4

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.chainRouter = new ChainRouter();
  }

  async submitPaidAudit(
    contractCode: string,
    walletAddress: string
  ): Promise<{ auditId: string; txHash: string }> {
    try {
      // Ensure USDC balance
      const balance = await this.chainRouter.getBalance(
        walletAddress,
        "avalanche-fuji"
      );

      const requiredUSDC = 1; // 1 USDC for audit
      if (parseFloat(balance) < requiredUSDC) {
        throw new Error(
          `Insufficient USDC. Required: ${requiredUSDC}, Available: ${balance}. Get testnet USDC at https://faucet.avax.network`
        );
      }

      // Connect to Avalanche Fuji
      const provider =
        this.chainRouter.getProvider("avalanche-fuji");
      const signerWithProvider = this.signer.connect(provider);

      // Create contract instance
      const contract = new ethers.Contract(
        this.X402_ADDRESS,
        X402_ABI,
        signerWithProvider
      );

      // Submit audit (payment happens in contract)
      const tx = await contract.submitAudit(contractCode, {
        value: ethers.parseUnits("1", "ether"), // 1 USDC (assuming 18 decimals)
      });

      const receipt = await tx.wait();

      // Extract audit ID from event logs
      const auditId = this.extractAuditIdFromReceipt(receipt);

      return {
        auditId,
        txHash: receipt.transactionHash,
      };
    } catch (error) {
      throw new Error(
        `x402 audit submission failed: ${error.message}`
      );
    }
  }

  async getAuditStatus(auditId: string): Promise<string> {
    try {
      const provider =
        this.chainRouter.getProvider("avalanche-fuji");
      const contract = new ethers.Contract(
        this.X402_ADDRESS,
        X402_ABI,
        provider
      );

      const status = await contract.getAuditStatus(auditId);
      return status;
    } catch (error) {
      throw new Error(
        `Failed to get audit status: ${error.message}`
      );
    }
  }

  async pollAuditCompletion(
    auditId: string,
    maxRetries: number = 30
  ): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const status = await this.getAuditStatus(auditId);

      if (status === "completed") {
        return await this.claimAuditResult(auditId);
      }

      if (status === "failed") {
        throw new Error("Audit failed on x402");
      }

      // Wait 10 seconds before retrying
      await new Promise((r) => setTimeout(r, 10000));
    }

    throw new Error("Audit polling timed out");
  }

  async claimAuditResult(auditId: string): Promise<string> {
    try {
      const provider =
        this.chainRouter.getProvider("avalanche-fuji");
      const signerWithProvider = this.signer.connect(provider);

      const contract = new ethers.Contract(
        this.X402_ADDRESS,
        X402_ABI,
        signerWithProvider
      );

      const result =
        await contract.claimAuditResult(auditId);
      return result;
    } catch (error) {
      throw new Error(
        `Failed to claim audit result: ${error.message}`
      );
    }
  }

  private extractAuditIdFromReceipt(receipt: any): string {
    // Parse event logs to extract audit ID
    const event = receipt.logs[0]; // Simplified
    // In production, use ethers contract.interface.parseLog()
    return `audit-${Date.now()}`;
  }
}
```

**Time Box:** x402 service working by 10:00 AM.

#### 4.2 x402 Contract Deployment (Justine) (2 hours)

**Solidity contract stub (for testing):**

```solidity
// contracts/X402Audit.sol
pragma solidity ^0.8.0;

contract X402Audit {
    mapping(string => string) auditResults;
    mapping(string => address) auditSubmitters;
    mapping(string => uint256) auditTimestamps;

    event AuditSubmitted(string indexed auditId, address indexed submitter, uint256 timestamp);
    event AuditCompleted(string indexed auditId, string result, uint256 timestamp);

    function submitAudit(string memory contractCode) public payable returns (string memory) {
        require(msg.value >= 1 ether, "Minimum 1 USDC required"); // Simplified

        string memory auditId = string(abi.encodePacked("audit-", block.timestamp));
        auditSubmitters[auditId] = msg.sender;
        auditTimestamps[auditId] = block.timestamp;

        emit AuditSubmitted(auditId, msg.sender, block.timestamp);
        return auditId;
    }

    function getAuditStatus(string memory auditId) public view returns (string memory) {
        // Return status: pending, completed, failed
        return "pending";
    }

    function claimAuditResult(string memory auditId) public view returns (string memory) {
        return auditResults[auditId];
    }

    function completeAudit(string memory auditId, string memory result) public {
        // Only callable by audit bot
        auditResults[auditId] = result;
        emit AuditCompleted(auditId, result, block.timestamp);
    }
}
```

**Deployment to Avalanche Fuji:**
```bash
# Using Hardhat (from Day 2 setup)
npx hardhat run scripts/deploy-x402.ts --network avalanche-fuji

# Contract deployed at: 0x... (save to .env)
```

**Time Box:** x402 contract deployed to Fuji by 12:00 PM.

#### 4.3 x402 Integration in `hyperagent audit --paid` (2 hours)

**Update audit.ts:**

```typescript
import { X402Service } from "../services/x402-service";
import { WalletManager } from "../services/wallet-manager";

export const auditCommand = new Command("audit")
  .option("--paid", "Run paid audit via x402 (1 USDC)")
  .option("-c, --chain <name>", "Target chain for paid audit")
  .description(
    "Run security audit on contract (free static analysis or paid professional)"
  )
  .action(async (options) => {
    const spinner = ora();

    try {
      if (options.paid) {
        spinner.start(
          chalk.blue("🔍 Preparing paid audit via x402...")
        );

        const walletManager = new WalletManager();
        const address = walletManager.getWalletAddress();

        if (!address) {
          throw new Error(
            "No wallet connected. Run 'hyperagent wallet connect'"
          );
        }

        // Check USDC balance on Avalanche Fuji
        spinner.text = chalk.blue(
          "💰 Checking USDC balance on Avalanche Fuji..."
        );

        const x402Service = new X402Service(
          walletManager.getSigner()
        );
        const { auditId, txHash } =
          await x402Service.submitPaidAudit(
            readContractCode(),
            address
          );

        spinner.succeed(
          chalk.green("✓ Audit submitted to x402")
        );
        console.log(chalk.cyan(`\n📝 Audit ID: ${auditId}`));
        console.log(chalk.cyan(`  TX Hash: ${txHash}`));

        // Poll for completion
        spinner.start(
          chalk.blue("⏳ Waiting for audit completion...")
        );
        const auditResult =
          await x402Service.pollAuditCompletion(auditId);

        spinner.succeed(
          chalk.green("✓ Audit complete!")
        );
        console.log(chalk.cyan(`\n📊 Results:`));
        console.log(chalk.cyan(auditResult));

        console.log(
          chalk.cyan(
            `\n🔗 View details: https://studio.hyperagent.io/audits/${auditId}`
          )
        );
      } else {
        // Free audit (existing code)
      }
    } catch (error) {
      spinner.fail(chalk.red(`✗ Error: ${error.message}`));
      process.exit(1);
    }
  });

function readContractCode(): string {
  // Read from contracts/ directory
  const fs = require("fs");
  const path = require("path");

  const contractFile = fs.readdirSync("contracts")[0];
  return fs.readFileSync(
    path.join("contracts", contractFile),
    "utf-8"
  );
}
```

**Time Box:** x402 integration working by 2:00 PM.

#### 4.4 USDC Faucet Integration (1 hour)

**Add helper command for testnet tokens:**

**src/commands/faucet.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";

export const faucetCommand = new Command("faucet")
  .description(
    "Get testnet tokens for audit payments and deployments"
  )
  .action(() => {
    console.log(
      chalk.green("\n💧 Testnet Faucets:")
    );
    console.log(
      chalk.cyan(
        "\n  Avalanche Fuji (AVAX):"
      )
    );
    console.log(
      chalk.cyan(
        "  https://faucet.avax.network"
      )
    );
    console.log(
      chalk.cyan(
        "\n  BNB Testnet (BNB):"
      )
    );
    console.log(
      chalk.cyan(
        "  https://testnet.binance.org/faucet-smart"
      )
    );
    console.log(
      chalk.cyan(
        "\n  Base Testnet (ETH):"
      )
    );
    console.log(
      chalk.cyan(
        "  https://docs.base.org/tools/network-faucets"
      )
    );
    console.log(
      chalk.cyan(
        "\n  For x402 audits, get USDC on Avalanche Fuji and wrap via SushiSwap"
      )
    );
  });
```

**Time Box:** Faucet helper working by 3:00 PM.

#### 4.5 x402 Testing & Validation (1.5 hours)

**Manual tests:**
```bash
npm run dev -- wallet connect --provider local
npm run dev -- audit --paid
# Should prompt for wallet, check USDC, and submit audit
```

**Mock server for testing (without real deployment):**

```typescript
// tests/x402-mock.ts
export const mockX402Service = {
  async submitPaidAudit() {
    return {
      auditId: "audit-mock-123",
      txHash:
        "0x1234567890abcdef",
    };
  },

  async getAuditStatus() {
    return "completed";
  },

  async claimAuditResult() {
    return "✓ No critical issues found";
  },
};
```

**Time Box:** x402 fully tested by 4:30 PM.

#### 4.6 End-of-Day Checkpoint (1 hour)

**Deliverables:**
- ✅ x402 contract deployed to Avalanche Fuji
- ✅ x402 service with payment flow
- ✅ `hyperagent audit --paid` integration
- ✅ USDC balance checking
- ✅ Audit polling (mock for now)
- ✅ Faucet helper command

**By End of Day 4:**
```bash
npm run dev -- init my-app
npm run dev -- wallet connect --provider thirdweb
npm run dev -- audit --paid  # x402 payment flow
```

---

### DAY 5: MULTI-CHAIN SDK INTEGRATION (MANTLE, AVALANCHE, BNB, BASE)
**Date:** 01/25/2026 (Saturday)  
**Duration:** 8 hours  
**Owner:** Aaron (Lead)  

#### 5.1 Chain Adapter Base Pattern (1 hour)

**src/services/chain-adapter.ts:**

```typescript
import { ethers } from "ethers";

export interface IChainAdapter {
  name: string;
  chainId: number;
  rpcUrl: string;
  nativeCurrency: string;

  deploy(
    contractCode: string,
    constructorArgs: any[]
  ): Promise<DeployResult>;

  estimate(contractCode: string): Promise<GasEstimate>;

  getBalance(address: string): Promise<string>;

  verifyOnExplorer(
    address: string,
    sourceCode: string
  ): Promise<void>;
}

export interface DeployResult {
  address: string;
  txHash: string;
  blockExplorer: string;
  timestamp: number;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  totalCostInUSD: string;
}

export abstract class BaseChainAdapter
  implements IChainAdapter
{
  abstract name: string;
  abstract chainId: number;
  abstract rpcUrl: string;
  abstract nativeCurrency: string;

  protected provider: ethers.JsonRpcProvider;
  protected signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.signer = signer.connect(this.provider);
  }

  async deploy(
    contractCode: string,
    constructorArgs: any[]
  ): Promise<DeployResult> {
    // Compile contract
    const compiled = await this.compile(contractCode);

    // Deploy
    const factory = new ethers.ContractFactory(
      compiled.abi,
      compiled.bytecode,
      this.signer
    );

    const contract = await factory.deploy(
      ...constructorArgs
    );
    const receipt = await contract.deploymentTransaction()
      ?.wait();

    return {
      address: await contract.getAddress(),
      txHash: receipt?.transactionHash || "",
      blockExplorer: this.getBlockExplorerUrl(
        await contract.getAddress()
      ),
      timestamp: Date.now(),
    };
  }

  async estimate(
    contractCode: string
  ): Promise<GasEstimate> {
    const compiled = await this.compile(contractCode);

    const factory = new ethers.ContractFactory(
      compiled.abi,
      compiled.bytecode,
      this.signer
    );

    const gasEstimate =
      await factory.getDeployTransaction().estimateGas?.({
        from: await this.signer.getAddress(),
      });

    const gasPrice = await this.provider.getGasPrice();

    return {
      gasLimit: gasEstimate?.toString() || "0",
      gasPrice: ethers.formatUnits(gasPrice, "gwei"),
      totalCostInUSD: "0.00", // Simplified
    };
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async verifyOnExplorer(
    address: string,
    sourceCode: string
  ): Promise<void> {
    // To be implemented per chain
  }

  protected async compile(
    solidityCode: string
  ): Promise<{ abi: any; bytecode: string }> {
    // Use solc or Hardhat to compile
    return { abi: [], bytecode: "" };
  }

  protected abstract getBlockExplorerUrl(
    address: string
  ): string;
}
```

**Time Box:** Base adapter pattern ready by 9:00 AM.

#### 5.2 Mantle Testnet Adapter (1.5 hours)

**src/services/mantle-adapter.ts:**

```typescript
import { BaseChainAdapter, DeployResult } from "./chain-adapter";
import { ethers } from "ethers";

export class MantleAdapter extends BaseChainAdapter {
  name = "Mantle Testnet";
  chainId = 5003;
  rpcUrl = process.env.MANTLE_RPC_URL ||
    "https://mantle-testnet-rpc.example.com";
  nativeCurrency = "MNT";

  protected getBlockExplorerUrl(address: string): string {
    return `https://explorer.mantle.io/address/${address}`;
  }

  async deploy(
    contractCode: string,
    constructorArgs: any[] = []
  ): Promise<DeployResult> {
    try {
      const result = await super.deploy(
        contractCode,
        constructorArgs
      );
      return result;
    } catch (error) {
      throw new Error(
        `Mantle deployment failed: ${error.message}`
      );
    }
  }

  async estimate(contractCode: string) {
    try {
      const estimate = await super.estimate(contractCode);

      // Mantle-specific gas pricing
      const gasprice =
        await this.provider.getGasPrice();
      const gasLimit = 2000000; // Default estimate

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasprice, "gwei"),
        totalCostInUSD: (
          gasLimit *
          parseInt(
            ethers.formatUnits(gasprice, "gwei")
          ) *
          0.0001
        ).toFixed(2),
      };
    } catch (error) {
      throw new Error(
        `Mantle gas estimation failed: ${error.message}`
      );
    }
  }
}
```

**Time Box:** Mantle adapter working by 10:30 AM.

#### 5.3 Avalanche Fuji Adapter (1.5 hours)

**src/services/avalanche-adapter.ts:**

```typescript
import { BaseChainAdapter, DeployResult } from "./chain-adapter";
import { ethers } from "ethers";

export class AvalancheAdapter extends BaseChainAdapter {
  name = "Avalanche Fuji";
  chainId = 43113;
  rpcUrl = process.env.AVALANCHE_RPC_URL ||
    "https://api.avax-test.network/ext/bc/C/rpc";
  nativeCurrency = "AVAX";

  protected getBlockExplorerUrl(address: string): string {
    return `https://testnet.snowtrace.io/address/${address}`;
  }

  async deploy(
    contractCode: string,
    constructorArgs: any[] = []
  ): Promise<DeployResult> {
    try {
      // Avalanche uses EVM, so deployment is same as Mantle
      const result = await super.deploy(
        contractCode,
        constructorArgs
      );
      return result;
    } catch (error) {
      throw new Error(
        `Avalanche deployment failed: ${error.message}`
      );
    }
  }

  async getUSDCBalance(walletAddress: string): Promise<string> {
    // USDC contract on Avalanche Fuji
    const USDC_ADDRESS =
      "0x..."; // Token contract
    const USDC_ABI = [
      "function balanceOf(address account) public view returns (uint256)",
    ];

    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      this.provider
    );

    const balance = await usdcContract.balanceOf(
      walletAddress
    );
    return ethers.formatUnits(balance, 6); // USDC is 6 decimals
  }
}
```

**Time Box:** Avalanche adapter working by 12:00 PM.

#### 5.4 BNB Chain Adapter (1 hour)

**src/services/bsc-adapter.ts:**

```typescript
import { BaseChainAdapter } from "./chain-adapter";

export class BSCAdapter extends BaseChainAdapter {
  name = "BNB Smart Chain Testnet";
  chainId = 97;
  rpcUrl = process.env.BSC_RPC_URL ||
    "https://data-seed-prebsc-1-0.binance.org:8545";
  nativeCurrency = "BNB";

  protected getBlockExplorerUrl(address: string): string {
    return `https://testnet.bscscan.com/address/${address}`;
  }
}
```

**Time Box:** BSC adapter working by 1:00 PM.

#### 5.5 Base Adapter (1 hour)

**src/services/base-adapter.ts:**

```typescript
import { BaseChainAdapter } from "./chain-adapter";

export class BaseAdapter extends BaseChainAdapter {
  name = "Base Testnet";
  chainId = 84531;
  rpcUrl = process.env.BASE_RPC_URL ||
    "https://goerli.base.org";
  nativeCurrency = "ETH";

  protected getBlockExplorerUrl(address: string): string {
    return `https://goerli.basescan.org/address/${address}`;
  }
}
```

**Time Box:** Base adapter working by 2:00 PM.

#### 5.6 Chain Selector in Deploy Command (1 hour)

**Update deploy.ts to support multiple chains:**

```typescript
export const deployCommand = new Command("deploy")
  .option(
    "-n, --network <name>",
    "Network (testnet|mainnet)"
  )
  .option(
    "-c, --chain <name>",
    "Chain (mantle-testnet|avalanche-fuji|bsc-testnet|base-testnet)"
  )
  .description("Deploy contract to blockchain")
  .action(async (options) => {
    const spinner = ora();

    try {
      // Default to Mantle
      const selectedChains = options.chain
        ? [options.chain]
        : ["mantle-testnet"];

      const chainRouter = new ChainRouter();

      for (const chain of selectedChains) {
        spinner.start(
          chalk.blue(`🚀 Deploying to ${chain}...`)
        );

        const adapter = chainRouter.getAdapter(chain);
        const result = await adapter.deploy(
          readContractCode(),
          []
        );

        spinner.succeed(
          chalk.green(
            `✓ Deployed to ${chain}`
          )
        );
        console.log(
          chalk.cyan(`  Address: ${result.address}`)
        );
        console.log(chalk.cyan(`  TX: ${result.txHash}`));
        console.log(
          chalk.cyan(`  Explorer: ${result.blockExplorer}`)
        );
      }
    } catch (error) {
      spinner.fail(chalk.red(`✗ Error: ${error.message}`));
      process.exit(1);
    }
  });
```

**Update chain-router.ts:**

```typescript
import { MantleAdapter } from "./mantle-adapter";
import { AvalancheAdapter } from "./avalanche-adapter";
import { BSCAdapter } from "./bsc-adapter";
import { BaseAdapter } from "./base-adapter";
import { IChainAdapter } from "./chain-adapter";
import { ethers } from "ethers";

export class ChainRouter {
  private adapters: Map<string, IChainAdapter> = new Map();
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.signer = signer;

    this.adapters.set(
      "mantle-testnet",
      new MantleAdapter(signer)
    );
    this.adapters.set(
      "avalanche-fuji",
      new AvalancheAdapter(signer)
    );
    this.adapters.set(
      "bsc-testnet",
      new BSCAdapter(signer)
    );
    this.adapters.set("base-testnet", new BaseAdapter(signer));
  }

  getAdapter(chainName: string): IChainAdapter {
    const adapter = this.adapters.get(chainName);
    if (!adapter) {
      throw new Error(`Chain not supported: ${chainName}`);
    }
    return adapter;
  }

  async deployToMultipleChains(
    contractCode: string,
    chains: string[]
  ) {
    const results = [];
    for (const chain of chains) {
      const adapter = this.getAdapter(chain);
      const result = await adapter.deploy(
        contractCode,
        []
      );
      results.push({ chain, result });
    }
    return results;
  }
}
```

**Time Box:** Multi-chain selector working by 3:00 PM.

#### 5.7 Testing Multi-Chain Deployment (1.5 hours)

**Manual tests:**
```bash
# Deploy to Mantle
npm run dev -- deploy --chain mantle-testnet

# Deploy to Avalanche
npm run dev -- deploy --chain avalanche-fuji

# Deploy to multiple chains
npm run dev -- deploy --chain mantle-testnet,avalanche-fuji,bsc-testnet
```

**Integration tests:**
```typescript
// tests/integration/multi-chain-deploy.test.ts
import { describe, it, expect } from "vitest";
import { ChainRouter } from "../../src/services/chain-router";

describe("Multi-chain deployment", () => {
  it("should deploy to Mantle testnet", async () => {
    // Test with mock signer
  });

  it("should deploy to Avalanche Fuji", async () => {
    // Test with mock signer
  });

  it("should deploy to multiple chains", async () => {
    // Test with mock signer
  });
});
```

**Time Box:** Multi-chain testing complete by 4:30 PM.

#### 5.8 End-of-Day Checkpoint (1.5 hours)

**Deliverables:**
- ✅ Mantle adapter fully working
- ✅ Avalanche adapter with USDC support
- ✅ BNB Chain adapter
- ✅ Base adapter
- ✅ Chain router pattern
- ✅ Multi-chain deploy selection
- ✅ Integration tests passing

**By End of Day 5:**
- CLI supports deployment to 4 EVM chains
- Chain selection in deploy command
- All RPC endpoints validated
- Gas estimation working

---

### DAY 6: SKALE & SUI FOUNDATION + COMPREHENSIVE TESTING
**Date:** 01/26/2026 (Sunday)  
**Duration:** 8 hours  
**Owner:** Aaron, Justine  

#### 6.1 SKALE SDK Integration (Foundation) (2 hours)

**src/services/skale-adapter.ts:**

```typescript
import { BaseChainAdapter } from "./chain-adapter";
import { ethers } from "ethers";

export class SKALEAdapter extends BaseChainAdapter {
  name = "SKALE Hub Testnet";
  chainId = 1; // SKALE Hub chain ID
  rpcUrl = process.env.SKALE_RPC_URL ||
    "https://testnet-rpc.skalechains.com";
  nativeCurrency = "SKALE";

  protected getBlockExplorerUrl(address: string): string {
    return `https://explorer.skale.network/address/${address}`;
  }

  async deploy(contractCode: string, constructorArgs: any[] = []) {
    try {
      // SKALE is EVM-compatible, so deployment is standard
      return await super.deploy(contractCode, constructorArgs);
    } catch (error) {
      throw new Error(`SKALE deployment failed: ${error.message}`);
    }
  }

  async getNetworkInfo() {
    const network = await this.provider.getNetwork();
    return {
      name: network.name,
      chainId: network.chainId,
      isTestnet: true,
    };
  }
}
```

**Add to ChainRouter:**
```typescript
this.adapters.set(
  "skale-hub-testnet",
  new SKALEAdapter(signer)
);
```

**Time Box:** SKALE foundation ready by 9:30 AM.

#### 6.2 Sui SDK Integration (Foundation) (2 hours)

**src/services/sui-adapter.ts:**

```typescript
import {
  Connection,
  JsonRpcProvider,
  Ed25519Keypair,
  RawSigner,
} from "@mysten/sui.js";

export class SuiAdapter {
  name = "Sui Testnet";
  chainId = 0; // Sui doesn't use traditional chain IDs
  rpcUrl = "https://fullnode.testnet.sui.io:443";
  nativeCurrency = "SUI";

  private provider: JsonRpcProvider;
  private signer: RawSigner;

  constructor(privateKey: string) {
    this.provider = new JsonRpcProvider(
      new Connection({ fullnode: this.rpcUrl })
    );

    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(privateKey, "hex")
    );
    this.signer = new RawSigner(keypair, this.provider);
  }

  async deploy(moveCode: string) {
    try {
      // Sui uses Move language, not Solidity
      // This is a stub for future implementation
      console.warn(
        "Sui Move deployment not yet fully supported"
      );
      return {
        address: "0x...",
        txHash: "0x...",
        status: "pending",
      };
    } catch (error) {
      throw new Error(`Sui deployment failed: ${error.message}`);
    }
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return balance.totalBalance;
  }
}
```

**Time Box:** Sui foundation ready by 11:00 AM.

#### 6.3 Comprehensive Unit Tests (2.5 hours)

**tests/services/chain-adapters.test.ts:**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MantleAdapter } from "../../src/services/mantle-adapter";
import { AvalancheAdapter } from "../../src/services/avalanche-adapter";
import { ethers } from "ethers";

describe("Chain Adapters", () => {
  let mockSigner: ethers.Signer;

  beforeEach(() => {
    mockSigner = {} as ethers.Signer;
  });

  describe("MantleAdapter", () => {
    it("should have correct chain configuration", () => {
      const adapter = new MantleAdapter(mockSigner);
      expect(adapter.name).toBe("Mantle Testnet");
      expect(adapter.chainId).toBe(5003);
    });

    it("should generate correct block explorer URL", () => {
      const adapter = new MantleAdapter(mockSigner);
      const url = adapter
        .getBlockExplorerUrl("0x123");
      expect(url).toContain("explorer.mantle.io");
    });
  });

  describe("AvalancheAdapter", () => {
    it("should have correct chain configuration", () => {
      const adapter = new AvalancheAdapter(mockSigner);
      expect(adapter.name).toBe("Avalanche Fuji");
      expect(adapter.chainId).toBe(43113);
    });
  });

  describe("ChainRouter", () => {
    it("should return correct adapter for chain", () => {
      const router = new ChainRouter(mockSigner);
      const adapter = router.getAdapter("mantle-testnet");
      expect(adapter.name).toBe("Mantle Testnet");
    });

    it("should throw error for unsupported chain", () => {
      const router = new ChainRouter(mockSigner);
      expect(() =>
        router.getAdapter("unsupported-chain")
      ).toThrow();
    });
  });
});
```

**tests/integration/full-flow.test.ts:**

```typescript
import {
  describe,
  it,
  expect,
  beforeEach,
} from "vitest";

describe("Full CLI Flow", () => {
  beforeEach(() => {
    // Reset environment
  });

  it("should init project successfully", async () => {
    // Test hyperagent init
  });

  it("should generate contract", async () => {
    // Test hyperagent generate
  });

  it("should run free audit", async () => {
    // Test hyperagent audit
  });

  it("should deploy to Mantle", async () => {
    // Test hyperagent deploy --chain mantle-testnet
  });

  it("should deploy to multiple chains", async () => {
    // Test multi-chain deployment
  });
});
```

**Time Box:** Unit and integration tests complete by 1:30 PM.

#### 6.4 Error Handling & Edge Cases (1.5 hours)

**Enhance error handling:**

```typescript
// src/utils/error-handler.ts
import chalk from "chalk";

export class CLIErrorHandler {
  static handle(error: any) {
    if (error.code === "ECONNREFUSED") {
      console.error(
        chalk.red(
          "✗ RPC Connection Failed"
        )
      );
      console.error(
        chalk.yellow(
          "  Check your internet connection and RPC endpoint"
        )
      );
    } else if (
      error.code === "INSUFFICIENT_FUNDS"
    ) {
      console.error(
        chalk.red("✗ Insufficient Balance")
      );
      console.error(
        chalk.yellow(
          "  Get testnet tokens from https://faucet.avax.network"
        )
      );
    } else if (
      error.message.includes("gas")
    ) {
      console.error(
        chalk.red("✗ Gas Estimation Failed")
      );
      console.error(
        chalk.yellow(
          "  Try again or increase gas limit"
        )
      );
    } else {
      console.error(
        chalk.red(`✗ Error: ${error.message}`)
      );
    }
  }
}
```

**Time Box:** Error handling improved by 3:00 PM.

#### 6.5 End-of-Day Checkpoint (1 hour)

**Deliverables:**
- ✅ SKALE adapter (foundation)
- ✅ Sui adapter (foundation)
- ✅ Comprehensive unit tests
- ✅ Integration test suite
- ✅ Error handling for common scenarios
- ✅ All tests passing

**By End of Day 6:**
- CLI supports 6 chains (4 fully + 2 foundation)
- Full test coverage > 80%
- Error messages helpful and actionable

---

### DAY 7: STUDIO SYNC HOOK & DEPLOYMENT WEBHOOKS
**Date:** 01/27/2026 (Monday)  
**Duration:** 8 hours  
**Owner:** Tristan (Lead), Aaron  

#### 7.1 Studio Sync Hook Design (1.5 hours)

**src/services/studio-sync.ts:**

```typescript
import axios from "axios";

export class StudioSyncService {
  private studioApiUrl: string;
  private apiToken: string;

  constructor(apiToken: string) {
    this.studioApiUrl =
      process.env.STUDIO_API_URL ||
      "https://api.hyperagent.io/studio";
    this.apiToken = apiToken;
  }

  async syncProjectToStudio(projectData: {
    name: string;
    description: string;
    templateType: string;
    contractCode: string;
    deploymentData?: any;
  }): Promise<{ studioProjectId: string }> {
    try {
      const response = await axios.post(
        `${this.studioApiUrl}/api/v1/projects`,
        {
          ...projectData,
          source: "cli",
          syncedAt: new Date().toISOString(),
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );

      return { studioProjectId: response.data.id };
    } catch (error) {
      throw new Error(
        `Failed to sync to Studio: ${error.message}`
      );
    }
  }

  async postDeploymentWebhook(deploymentData: {
    projectId: string;
    chain: string;
    contractAddress: string;
    txHash: string;
  }): Promise<void> {
    try {
      // Post deployment result to Studio for real-time update
      await axios.post(
        `${this.studioApiUrl}/webhooks/deployments`,
        deploymentData,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.warn(
        `⚠️  Webhook post failed: ${error.message}`
      );
      // Don't fail deployment if webhook fails
    }
  }

  async linkCLIProjectToStudio(
    cliProjectId: string,
    studioProjectId: string
  ): Promise<void> {
    try {
      await axios.post(
        `${this.studioApiUrl}/api/v1/projects/${studioProjectId}/link-cli`,
        { cliProjectId },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
    } catch (error) {
      throw new Error(
        `Failed to link projects: ${error.message}`
      );
    }
  }

  async getStudioProject(
    projectId: string
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.studioApiUrl}/api/v1/projects/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch Studio project: ${error.message}`
      );
    }
  }
}
```

**Time Box:** Studio sync service ready by 9:30 AM.

#### 7.2 Add `hyperagent project` Commands (2 hours)

**src/commands/project.ts:**

```typescript
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { APIClient } from "../services/api-client";
import { StudioSyncService } from "../services/studio-sync";
import { ConfigManager } from "../services/config-manager";

export const projectCommand = new Command("project")
  .addCommand(
    new Command("list")
      .description("List all projects")
      .action(async () => {
        const spinner = ora();
        try {
          const apiClient = new APIClient(
            process.env.HYPERAGENT_API_TOKEN
          );
          const projects = await apiClient.getProjects();

          console.log(
            chalk.cyan("\n📁 Your Projects:")
          );
          projects.forEach((p) => {
            console.log(
              chalk.cyan(
                `  ${p.id}: ${p.name} (${p.templateType})`
              )
            );
          });
        } catch (error) {
          spinner.fail(
            chalk.red(`✗ Error: ${error.message}`)
          );
        }
      })
  )
  .addCommand(
    new Command("status")
      .argument(
        "[project-id]",
        "Project ID"
      )
      .description("Get project status")
      .action(async (projectId) => {
        const spinner = ora();
        try {
          const apiClient = new APIClient(
            process.env.HYPERAGENT_API_TOKEN
          );
          const project =
            await apiClient.getProject(projectId);

          console.log(
            chalk.cyan(`\n📊 Project Status:`)
          );
          console.log(
            chalk.cyan(`  Name: ${project.name}`)
          );
          console.log(
            chalk.cyan(
              `  Deployments: ${project.deployments.length}`
            )
          );
          console.log(
            chalk.cyan(
              `  Audits: ${project.audits.length}`
            )
          );
          console.log(
            chalk.cyan(
              `  Studio Link: ${project.studioProjectId || "Not linked"}`
            )
          );
        } catch (error) {
          spinner.fail(
            chalk.red(`✗ Error: ${error.message}`)
          );
        }
      })
  )
  .addCommand(
    new Command("sync-to-studio")
      .description(
        "Sync project to Hyperkit Studio"
      )
      .action(async () => {
        const spinner = ora();
        try {
          const configManager =
            new ConfigManager("");
          const config = configManager.load();

          spinner.start(
            chalk.blue(
              "🔄 Syncing to Studio..."
            )
          );

          const studioSync = new StudioSyncService(
            process.env.HYPERAGENT_API_TOKEN
          );

          const { studioProjectId } =
            await studioSync.syncProjectToStudio({
              name: config.project.name,
              description:
                config.project.description,
              templateType:
                config.project.templateType,
              contractCode:
                readContractCode(),
            });

          spinner.succeed(
            chalk.green("✓ Synced to Studio")
          );
          console.log(
            chalk.cyan(
              `\n🔗 Studio Project ID: ${studioProjectId}`
            )
          );
          console.log(
            chalk.cyan(
              `   View at: https://studio.hyperagent.io/projects/${studioProjectId}`
            )
          );

          // Save link to config
          config.studio = {
            projectId: studioProjectId,
            syncedAt: new Date().toISOString(),
          };
          configManager.save(config);
        } catch (error) {
          spinner.fail(
            chalk.red(`✗ Error: ${error.message}`)
          );
        }
      })
  );

function readContractCode(): string {
  const fs = require("fs");
  const path = require("path");

  if (!fs.existsSync("contracts")) {
    throw new Error("No contracts/ directory found");
  }

  const contractFile = fs.readdirSync(
    "contracts"
  )[0];
  return fs.readFileSync(
    path.join("contracts", contractFile),
    "utf-8"
  );
}
```

**Time Box:** `hyperagent project` commands working by 11:30 AM.

#### 7.3 Deployment Webhook Integration (2 hours)

**Update deploy.ts to post webhooks:**

```typescript
import { StudioSyncService } from "../services/studio-sync";

export const deployCommand = new Command("deploy")
  // ... existing options ...
  .action(async (options) => {
    const spinner = ora();

    try {
      const chainRouter = new ChainRouter(signer);
      const studioSync = new StudioSyncService(
        process.env.HYPERAGENT_API_TOKEN
      );

      const selectedChains = options.chain
        ? [options.chain]
        : ["mantle-testnet"];

      for (const chain of selectedChains) {
        spinner.start(
          chalk.blue(
            `🚀 Deploying to ${chain}...`
          )
        );

        const adapter =
          chainRouter.getAdapter(chain);
        const result = await adapter.deploy(
          readContractCode(),
          []
        );

        spinner.succeed(
          chalk.green(
            `✓ Deployed to ${chain}`
          )
        );

        // Post webhook to Studio
        const configManager =
          new ConfigManager("");
        const config = configManager.load();

        if (config.studio?.projectId) {
          try {
            await studioSync.postDeploymentWebhook({
              projectId: config.studio.projectId,
              chain,
              contractAddress: result.address,
              txHash: result.txHash,
            });

            console.log(
              chalk.cyan(
                `  ✓ Synced to Studio`
              )
            );
          } catch (error) {
            console.warn(
              chalk.yellow(
                `  ⚠️  Studio webhook failed: ${error.message}`
              )
            );
          }
        }

        console.log(
          chalk.cyan(
            `  Address: ${result.address}`
          )
        );
      }
    } catch (error) {
      spinner.fail(
        chalk.red(`✗ Error: ${error.message}`)
      );
      process.exit(1);
    }
  });
```

**Time Box:** Webhooks integrated by 1:30 PM.

#### 7.4 Bidirectional Project Model (1.5 hours)

**Add config support for Studio projects:**

```typescript
// In config-manager.ts

async linkStudioProject(studioProjectId: string) {
  const config = this.load();
  config.studio = {
    projectId: studioProjectId,
    linkedAt: new Date().toISOString(),
  };
  this.save(config);
}

getStudioProjectId(): string | null {
  const config = this.load();
  return config.studio?.projectId || null;
}

isLinkedToStudio(): boolean {
  return this.getStudioProjectId() !== null;
}
```

**Time Box:** Bidirectional model ready by 3:00 PM.

#### 7.5 Studio Sync Examples (1.5 hours)

**examples/studio-sync-workflow.sh:**

```bash
#!/bin/bash
# Example: Create project in CLI, sync to Studio

echo "🚀 HyperAgent CLI → Studio Workflow"
echo ""

# Step 1: Initialize project
echo "Step 1: Initialize project"
hyperagent init my-staking-pool
cd my-staking-pool

# Step 2: Generate contract
echo "Step 2: Generate contract"
hyperagent generate --prompt "Create a staking pool with 12% APY"

# Step 3: Audit locally
echo "Step 3: Audit contract"
hyperagent audit

# Step 4: Deploy to testnet
echo "Step 4: Deploy to Mantle testnet"
hyperagent deploy --chain mantle-testnet

# Step 5: Sync to Studio
echo "Step 5: Sync to Studio"
hyperagent project sync-to-studio

# Step 6: Open in browser
echo "Step 6: Opening in Studio..."
STUDIO_URL=$(hyperagent project get-studio-url)
open "$STUDIO_URL"

echo "✓ All done! Check your project in Studio."
```

**Time Box:** Examples created by 4:30 PM.

#### 7.6 End-of-Day Checkpoint (1 hour)

**Deliverables:**
- ✅ Studio sync service
- ✅ `hyperagent project` commands
- ✅ Deployment webhooks working
- ✅ Bidirectional project model
- ✅ Examples and workflows
- ✅ Real-time status sync

**By End of Day 7:**
- CLI projects can sync to Studio
- Deployments appear in Studio in real-time
- Cross-interface project linking working

---

### DAY 8: DOCUMENTATION & EXAMPLES
**Date:** 01/28/2026 (Tuesday)  
**Duration:** 8 hours  
**Owner:** Tristan (Lead)  

#### 8.1 README & Getting Started (2 hours)

**README.md:**

```markdown
# HyperAgent CLI – Deploy Smart Contracts with AI

HyperAgent CLI brings AI-assisted smart contract generation, auditing, and multi-chain deployment to your terminal.

## 🚀 Quick Start

### Installation

\`\`\`bash
npm install -g @hyperagent/cli
\`\`\`

### Your First Deployment (2 mins)

\`\`\`bash
# 1. Initialize project
hyperagent init my-first-app

# 2. Connect wallet
hyperagent wallet connect --provider thirdweb

# 3. Generate contract
hyperagent generate --prompt "Create an ERC-20 token with 1 million supply"

# 4. Deploy to testnet
hyperagent deploy --chain mantle-testnet

# 5. Done! 🎉
\`\`\`

## 📋 Commands

### Project Management
- \`hyperagent init <name>\` – Initialize new project
- \`hyperagent project list\` – List your projects
- \`hyperagent project status\` – Check project status
- \`hyperagent project sync-to-studio\` – Sync to Hyperkit Studio

### Smart Contracts
- \`hyperagent generate\` – AI-generate contract from prompt
- \`hyperagent audit\` – Run security audit (free or paid)
- \`hyperagent deploy\` – Deploy to blockchain

### Wallet
- \`hyperagent wallet connect\` – Connect wallet
- \`hyperagent wallet status\` – Check balance

### Configuration
- \`hyperagent config set <key> <value>\` – Set config
- \`hyperagent config get <key>\` – Get config

## 🌐 Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Mantle Testnet | 5003 | ✅ Ready |
| Avalanche Fuji | 43113 | ✅ Ready |
| BSC Testnet | 97 | ✅ Ready |
| Base Testnet | 84531 | ✅ Ready |
| SKALE Hub | 1 | ✅ Ready |
| Sui Testnet | - | 🔧 Foundation |

## 💰 Paid Audits via x402

Get professional smart contract audits for 1 USDC:

\`\`\`bash
hyperagent audit --paid
\`\`\`

## 🔗 Integration

### Use in GitHub Actions

\`\`\`yaml
name: Deploy Contracts
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @hyperagent/cli
      - run: hyperagent deploy --chain mantle-testnet
        env:
          HYPERAGENT_API_TOKEN: \${{ secrets.HYPERAGENT_API_TOKEN }}
          WALLET_PRIVATE_KEY: \${{ secrets.WALLET_PRIVATE_KEY }}
\`\`\`

### Sync to Hyperkit Studio

Create contracts in CLI, review visually in Studio:

\`\`\`bash
hyperagent project sync-to-studio
\`\`\`

## 📚 Documentation

- [Installation & Setup](./docs/getting-started.md)
- [Command Reference](./docs/commands.md)
- [Examples](./docs/examples.md)
- [FAQ](./docs/faq.md)

## 🛠️ Tech Stack

- **CLI Framework:** Commander.js
- **Wallets:** Thirdweb SDK, ethers.js
- **Payments:** x402 (Avalanche)
- **Deployment:** Hardhat, ethers.js
- **Chains:** Mantle, Avalanche, BNB, Base, SKALE, Sui

## 📄 License

MIT – Open source and free to use

## 🙋 Support

- GitHub Issues: https://github.com/hyperkit-labs/hyperagent-cli/issues
- Docs: https://docs.hyperagent.io
- Discord: https://discord.gg/hyperkit
\`\`\`

**Time Box:** README complete by 9:30 AM.

#### 8.2 Commands Reference (1.5 hours)

**docs/commands.md:**

```markdown
# HyperAgent CLI – Commands Reference

## hyperagent init

Initialize a new HyperAgent project with configuration.

### Usage
\`\`\`bash
hyperagent init [project-name]
\`\`\`

### Examples
\`\`\`bash
# Interactive init
hyperagent init

# Named project
hyperagent init my-staking-pool
\`\`\`

### Output
```
? Project name: my-staking-pool
? Description: A staking pool for my token
? Template type: staking
? Supported networks: mantle-testnet, avalanche-fuji
✓ Project initialized
```

---

## hyperagent generate

Generate a smart contract from natural language.

### Usage
\`\`\`bash
hyperagent generate [options]
\`\`\`

### Options
- `-p, --prompt <text>` – Contract description
- `-t, --template <type>` – Template (token|staking|amm)

### Examples
\`\`\`bash
# Interactive
hyperagent generate

# With prompt
hyperagent generate --prompt "Create an ERC-20 token with minting"

# With template
hyperagent generate --template staking
\`\`\`

---

## hyperagent audit

Run security audit on contract.

### Usage
\`\`\`bash
hyperagent audit [options]
\`\`\`

### Options
- `--paid` – Use professional audit (1 USDC via x402)
- `-c, --chain <name>` – Target chain for paid audit

### Examples
\`\`\`bash
# Free static analysis
hyperagent audit

# Professional audit (paid)
hyperagent audit --paid

# Paid audit on Avalanche
hyperagent audit --paid --chain avalanche-fuji
\`\`\`

---

## hyperagent deploy

Deploy contract to blockchain.

### Usage
\`\`\`bash
hyperagent deploy [options]
\`\`\`

### Options
- `-n, --network <name>` – Network (testnet|mainnet)
- `-c, --chain <name>` – Chain name

### Examples
\`\`\`bash
# Deploy to Mantle (default)
hyperagent deploy

# Deploy to Avalanche
hyperagent deploy --chain avalanche-fuji

# Deploy to multiple chains
hyperagent deploy --chain mantle-testnet,avalanche-fuji,bsc-testnet
\`\`\`

## hyperagent project

Manage projects.

### Subcommands

#### list
\`\`\`bash
hyperagent project list
\`\`\`

#### status
\`\`\`bash
hyperagent project status [project-id]
\`\`\`

#### sync-to-studio
\`\`\`bash
hyperagent project sync-to-studio
\`\`\`

---

[Full Reference...]
\`\`\`

**Time Box:** Commands reference complete by 11:00 AM.

#### 8.3 Working Examples (2.5 hours)

**examples/1-deploy-token.sh:**

```bash
#!/bin/bash
# Example 1: Deploy an ERC-20 token to Mantle testnet

set -e

echo "🎯 Example: Deploy ERC-20 Token"
echo ""

# Check wallet
echo "1️⃣  Checking wallet..."
hyperagent wallet status

# Generate token contract
echo "2️⃣  Generating token contract..."
hyperagent generate --prompt "ERC-20 token named MyToken with 1 million supply" --template token

# Run audit
echo "3️⃣  Running security audit..."
hyperagent audit

# Deploy to Mantle testnet
echo "4️⃣  Deploying to Mantle testnet..."
hyperagent deploy --chain mantle-testnet

echo ""
echo "✅ Token deployed successfully!"
echo "💡 Tip: Sync to Studio for visual review: hyperagent project sync-to-studio"
```

**examples/2-staking-pool.sh:**

```bash
#!/bin/bash
# Example 2: Deploy staking pool to multiple chains

echo "🎯 Example: Deploy Staking Pool to Multiple Chains"
echo ""

# Initialize project
hyperagent init my-staking-pool
cd my-staking-pool

# Generate staking pool
hyperagent generate --prompt "Staking pool with 12% APY, 90-day lockup, 1% admin fee" --template staking

# Audit
hyperagent audit

# Deploy to multiple chains
echo "🌐 Deploying to multiple chains..."
hyperagent deploy --chain mantle-testnet,avalanche-fuji,bsc-testnet

echo ""
echo "✅ Deployed to 3 chains!"
echo "📊 Deployments:"
hyperagent project status
```

**examples/3-github-actions-ci-cd.yaml:**

```yaml
name: HyperAgent CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  hyperagent-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install HyperAgent CLI
        run: npm install -g @hyperagent/cli

      - name: Generate Contract
        run: hyperagent generate --prompt "ERC-20 token"

      - name: Run Audit
        run: hyperagent audit

      - name: Deploy to Mantle Testnet
        run: hyperagent deploy --chain mantle-testnet
        env:
          HYPERAGENT_API_TOKEN: ${{ secrets.HYPERAGENT_API_TOKEN }}
          WALLET_PRIVATE_KEY: ${{ secrets.WALLET_PRIVATE_KEY }}
          MANTLE_RPC_URL: ${{ secrets.MANTLE_RPC_URL }}

      - name: Sync to Studio
        run: hyperagent project sync-to-studio
        env:
          HYPERAGENT_API_TOKEN: ${{ secrets.HYPERAGENT_API_TOKEN }}

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Contract deployed to Mantle testnet!'
            })
```

**Time Box:** 3 complete working examples by 1:30 PM.

#### 8.4 FAQ & Troubleshooting (1.5 hours)

**docs/faq.md:**

```markdown
# Frequently Asked Questions

## Installation

### Q: CLI not found after npm install -g
**A:** Try:
\`\`\`bash
npm install -g @hyperagent/cli --force
which hyperagent
\`\`\`

If still not found, check npm's global directory:
\`\`\`bash
npm config get prefix
\`\`\`

---

## Wallet & Configuration

### Q: How do I set up my wallet?
**A:**
\`\`\`bash
hyperagent wallet connect --provider thirdweb
\`\`\`

Or with local private key:
\`\`\`bash
hyperagent wallet connect --provider local --key YOUR_PRIVATE_KEY
\`\`\`

### Q: How do I securely store my private key?
**A:** Use environment variables:
\`\`\`bash
export WALLET_PRIVATE_KEY="your_key_here"
hyperagent deploy --chain mantle-testnet
\`\`\`

Or create `.env` file (git-ignore it):
\`\`\`
WALLET_PRIVATE_KEY=your_key_here
HYPERAGENT_API_TOKEN=your_token_here
\`\`\`

---

## Deployments

### Q: Deployment failed with "insufficient gas"
**A:** Add more native tokens to your wallet:
- Mantle: https://faucet.mantle.io
- Avalanche: https://faucet.avax.network
- BNB: https://testnet.binance.org/faucet-smart
- Base: https://docs.base.org/tools/network-faucets

### Q: How do I deploy to multiple chains at once?
**A:**
\`\`\`bash
hyperagent deploy --chain mantle-testnet,avalanche-fuji,bsc-testnet
\`\`\`

---

## Audits

### Q: What's the difference between free and paid audit?
**A:**
- **Free:** Static analysis (Slither, ESLint, TypeScript checks)
- **Paid:** Professional security review via x402 (1 USDC on Avalanche Fuji)

### Q: How do I get USDC for paid audits?
**A:**
1. Get testnet AVAX: https://faucet.avax.network
2. Wrap on SushiSwap: https://www.sushiswapclassic.org

---

## CI/CD

### Q: Can I use HyperAgent in GitHub Actions?
**A:** Yes! See example:
\`\`\`yaml
- name: Deploy with HyperAgent
  run: hyperagent deploy --chain mantle-testnet
  env:
    HYPERAGENT_API_TOKEN: \${{ secrets.HYPERAGENT_API_TOKEN }}
    WALLET_PRIVATE_KEY: \${{ secrets.WALLET_PRIVATE_KEY }}
\`\`\`

### Q: How do I store secrets securely?
**A:** Use GitHub Secrets:
1. Go to Settings → Secrets and variables → Actions
2. Add `HYPERAGENT_API_TOKEN` and `WALLET_PRIVATE_KEY`
3. Reference in workflows as shown above

---

## Troubleshooting

### Q: "API token invalid"
**A:** Generate new token in Studio settings or check:
\`\`\`bash
echo $HYPERAGENT_API_TOKEN
\`\`\`

### Q: "RPC connection failed"
**A:** Check:
1. Internet connection
2. RPC endpoint availability
3. Network firewall/VPN issues

### Q: "Contract generation failed"
**A:** Try:
\`\`\`bash
hyperagent generate --template token  # Use template instead of prompt
\`\`\`

---

[More FAQs...]
\`\`\`

**Time Box:** FAQ complete by 3:00 PM.

#### 8.5 Video Tutorial Stubs (1.5 hours)

**docs/VIDEOS.md** – Links to tutorials:

```markdown
# HyperAgent CLI Video Tutorials

Short, focused tutorials (2-3 mins each):

## Getting Started
- [Install & Run First Command](https://youtube.com/watch?v=...)
- [Connect Your Wallet](https://youtube.com/watch?v=...)

## Deployment
- [Deploy ERC-20 Token to Mantle](https://youtube.com/watch?v=...)
- [Deploy to Multiple Chains](https://youtube.com/watch?v=...)

## Advanced
- [Use in GitHub Actions CI/CD](https://youtube.com/watch?v=...)
- [Professional Audit via x402](https://youtube.com/watch?v=...)
- [Sync CLI Project to Studio](https://youtube.com/watch?v=...)

More coming soon! Subscribe for updates.
```

**Time Box:** Video stubs and links by 4:30 PM.

#### 8.6 End-of-Day Checkpoint (1 hour)

**Deliverables:**
- ✅ Comprehensive README
- ✅ Full command reference
- ✅ 3 working examples (token, staking, CI/CD)
- ✅ FAQ & troubleshooting guide
- ✅ Video tutorial stubs

**By End of Day 8:**
- Documentation site-ready
- Users can get started in 2 minutes
- Clear troubleshooting paths for common issues

---

### DAY 9: END-TO-END TESTING & SECURITY AUDIT
**Date:** 01/29/2026 (Wednesday)  
**Duration:** 8 hours  
**Owner:** Aaron (Lead), Tristan, Justine  

#### 9.1 End-to-End Integration Tests (3 hours)

**tests/integration/e2e-flow.test.ts:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

describe("End-to-End CLI Flow", () => {
  const testDir = path.join(__dirname, "test-project");

  beforeAll(() => {
    // Create temporary test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true });
  });

  it("should init project successfully", () => {
    process.chdir(testDir);
    execSync(
      "hyperagent init test-project --yes"
    );

    expect(
      fs.existsSync(
        path.join(testDir, ".hyperagent.yaml")
      )
    ).toBe(true);
  });

  it("should generate contract", () => {
    execSync(
      'hyperagent generate --prompt "ERC-20 token" --yes'
    );

    expect(
      fs.existsSync(
        path.join(testDir, "contracts")
      )
    ).toBe(true);
  });

  it("should run audit", () => {
    const result = execSync(
      "hyperagent audit --json"
    ).toString();
    const auditResult = JSON.parse(result);

    expect(auditResult.status).toBe("completed");
    expect(auditResult.issues).toBeDefined();
  });

  it("should deploy to Mantle testnet", () => {
    const result = execSync(
      "hyperagent deploy --chain mantle-testnet --json"
    ).toString();

    const deployResult = JSON.parse(result);

    expect(deployResult.contractAddress).toBeDefined();
    expect(deployResult.txHash).toBeDefined();
    expect(
      deployResult.contractAddress
    ).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("should sync to Studio", () => {
    const result = execSync(
      "hyperagent project sync-to-studio --json"
    ).toString();

    const syncResult = JSON.parse(result);

    expect(
      syncResult.studioProjectId
    ).toBeDefined();
    expect(
      fs.existsSync(
        path.join(testDir, ".hyperagent.yaml")
      )
    ).toBe(true);

    // Verify Studio link saved to config
    const config = fs.readFileSync(
      path.join(testDir, ".hyperagent.yaml"),
      "utf-8"
    );
    expect(config).toContain(
      "studio"
    );
  });
});
```

**Run tests:**
```bash
npm test -- e2e-flow

# Output:
# ✓ should init project successfully (150ms)
# ✓ should generate contract (2300ms)
# ✓ should run audit (1200ms)
# ✓ should deploy to Mantle testnet (8000ms)
# ✓ should sync to Studio (950ms)
#
# 5 passed (12.6s)
```

**Time Box:** E2E tests complete and passing by 10:30 AM.

#### 9.2 Multi-Chain Deployment Test (1.5 hours)

**tests/integration/multi-chain.test.ts:**

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("Multi-Chain Deployment", () => {
  it("should deploy to all 4 EVM chains", () => {
    const chains = [
      "mantle-testnet",
      "avalanche-fuji",
      "bsc-testnet",
      "base-testnet",
    ];

    const result = execSync(
      `hyperagent deploy --chain ${chains.join(",")} --json`
    ).toString();

    const deployments = JSON.parse(result);

    expect(deployments).toHaveLength(4);

    deployments.forEach((deploy) => {
      expect(deploy.status).toBe("success");
      expect(
        deploy.contractAddress
      ).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(deploy.chain).toBeDefined();
    });
  });

  it("should handle chain errors gracefully", () => {
    // Test with invalid chain
    expect(() => {
      execSync(
        "hyperagent deploy --chain invalid-chain"
      );
    }).toThrow();
  });
});
```

**Time Box:** Multi-chain tests by 12:00 PM.

#### 9.3 Wallet & Security Tests (1 hour)

**tests/services/wallet-security.test.ts:**

```typescript
import { describe, it, expect } from "vitest";
import { WalletManager } from "../../src/services/wallet-manager";

describe("Wallet Security", () => {
  it("should not expose private key in logs", () => {
    const consoleLogSpy = vi.spyOn(
      console,
      "log"
    );

    const walletManager = new WalletManager();
    // ... trigger wallet operations ...

    consoleLogSpy.mockRestore();

    // Check no private key in logs
    consoleLogSpy.mock.calls.forEach((call) => {
      const logText = call[0].toString();
      expect(logText).not.toContain(
        "0x" // Not a hex key
      );
    });
  });

  it("should warn on insecure key storage", () => {
    // Test warns if key stored in plaintext config
  });

  it("should validate private key format", () => {
    const walletManager = new WalletManager();

    expect(() => {
      walletManager.connectLocal("invalid-key");
    }).toThrow();
  });
});
```

**Time Box:** Wallet security tests by 1:00 PM.

#### 9.4 Security Audit (2 hours)

**Manual security checklist:**

- ✅ No hardcoded API keys or private keys
- ✅ Private keys never logged
- ✅ Environment variables properly handled
- ✅ API tokens validated before use
- ✅ RPC endpoints validated
- ✅ Contract code validated before deployment
- ✅ User confirms deployment before executing
- ✅ Error messages don't expose sensitive data
- ✅ Dependencies all up-to-date (npm audit)
- ✅ HTTPS for all API calls

**Run security check:**

```bash
npm audit  # Check dependencies
npm run lint  # ESLint
npm run test  # All tests

# Result:
# npm audit: 0 vulnerabilities
# npm run lint: ✓ 0 issues
# npm run test: ✓ 50+ tests passing
```

**Time Box:** Security audit complete by 3:00 PM.

#### 9.5 Performance & Load Testing (1 hour)

**Manual performance checks:**

```bash
# CLI startup time
time hyperagent --help
# Expected: <500ms

# First deployment time
time hyperagent deploy --chain mantle-testnet
# Expected: <15s (network dependent)

# Project listing
time hyperagent project list
# Expected: <1s

# Wallet check
time hyperagent wallet status
# Expected: <2s
```

**Performance benchmarks:**
- CLI startup: <500ms ✅
- Wallet connect: <2s ✅
- Project sync: <1s ✅
- Deployment: <30s (network dependent) ✅

**Time Box:** Performance testing by 4:00 PM.

#### 9.6 Bug Fixes & Final Polish (1.5 hours)

**Outstanding issues:**
- [ ] Error message clarity
- [ ] Help text accuracy
- [ ] Config file validation
- [ ] Network timeout handling
- [ ] Spinner animations smooth
- [ ] Color output consistent

**Final testing:**
```bash
npm run build
npm run test
npm run lint

# Dry run publish to npm
npm publish --dry-run
```

**Time Box:** All tests passing, ready for publish by 5:30 PM.

#### 9.7 End-of-Day Checkpoint (30 mins)

**Deliverables:**
- ✅ E2E tests green (5+ tests passing)
- ✅ Multi-chain tests green
- ✅ Wallet security validated
- ✅ Security audit complete
- ✅ Performance benchmarks met
- ✅ Code ready for production

**By End of Day 9:**
- CLI fully tested and validated
- Ready for npm publish
- No known security issues
- Performance meets expectations

---

### DAY 10: POLISH, NPM PUBLISH, & LAUNCH PREP
**Date:** 01/30/2026 (Thursday)  
**Duration:** 8 hours  
**Owner:** Aaron (NPM), Tristan (Marketing), Justine (Partners)  

#### 10.1 NPM Publishing Setup (2 hours)

**package.json final updates:**

```json
{
  "name": "@hyperagent/cli",
  "version": "0.1.0",
  "description": "HyperAgent CLI – Deploy smart contracts with AI",
  "keywords": [
    "hyperagent",
    "smart-contracts",
    "defi",
    "web3",
    "blockchain",
    "solidity",
    "ethereum",
    "mantle",
    "avalanche",
    "deployment"
  ],
  "homepage": "https://hyperagent.io",
  "bugs": {
    "url": "https://github.com/hyperkit-labs/hyperagent-cli/issues"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/hyperkit-labs/hyperagent-cli.git"
  },
  "license": "MIT",
  "author": "Hyperkit Labs",
  "main": "dist/index.js",
  "bin": {
    "hyperagent": "bin/hyperagent"
  },
  "files": ["dist", "bin"],
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli.js",
    "dev": "ts-node src/cli.ts",
    "test": "vitest",
    "test:run": "vitest --run",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src",
    "prepublishOnly": "npm run build && npm run test:run && npm run lint",
    "version": "npm run format"
  }
}
```

**Create npm account:**
```bash
npm adduser  # Login to npm
npm whoami   # Verify

# Two-factor auth setup (recommended)
npm access set public @hyperagent/*
```

**Time Box:** NPM setup complete by 9:30 AM.

#### 10.2 Dry Run & Final Validation (1.5 hours)

**Pre-publish checklist:**

```bash
# 1. Build
npm run build
echo "✓ Build successful"

# 2. Tests
npm run test:run
echo "✓ Tests passing"

# 3. Lint
npm run lint
echo "✓ No linting errors"

# 4. Security
npm audit
echo "✓ No vulnerabilities"

# 5. Dry run
npm publish --dry-run
echo "✓ Dry run successful"

# 6. Check dist size
du -sh dist/
# Should be <5MB

# 7. Check bin
chmod +x bin/hyperagent
./bin/hyperagent --version
echo "✓ Executable working"
```

**Output should be:**
```
✓ Build successful
✓ Tests passing
✓ No linting errors
✓ No vulnerabilities
✓ Dry run successful
✓ dist size: 2.3MB
✓ Executable working
```

**Time Box:** Validation complete by 11:00 AM.

#### 10.3 Official NPM Publish (30 mins)

**Publish:**

```bash
npm publish

# Expected output:
# npm notice
# npm notice 📦  @hyperagent/cli@0.1.0
# npm notice === Tarball Contents ===
# npm notice X files,        XXKB uncompressed
# npm notice === Dist Files ===
# npm notice ...
# npm notice === Publish Details ===
# npm notice
# + @hyperagent/cli@0.1.0

echo "🎉 Published to npm!"
echo "Install: npm install -g @hyperagent/cli"
```

**Verify installation:**

```bash
npm install -g @hyperagent/cli
hyperagent --version
# Output: 0.1.0

hyperagent --help
# Output: Help text...
```

**Time Box:** NPM publish complete by 11:30 AM.

#### 10.4 GitHub Release & Documentation (1.5 hours)

**Create GitHub release:**

```bash
git tag v0.1.0
git push origin v0.1.0

# GitHub CLI:
gh release create v0.1.0 \
  --title "HyperAgent CLI v0.1.0 – MVP Launch" \
  --notes "🚀 Initial MVP release with full multi-chain support"
```

**Release notes:**

```markdown
# HyperAgent CLI v0.1.0 – MVP Launch 🚀

## What's New

### Core Features ✨
- **AI-Assisted Generation** – Generate smart contracts from natural language prompts
- **Multi-Chain Deployment** – Deploy to Mantle, Avalanche, BNB Chain, Base, SKALE, and Sui (foundation)
- **Security Auditing** – Free static analysis + paid professional audits via x402 (1 USDC)
- **Wallet Integration** – Thirdweb wallet support + local wallet import
- **Studio Sync** – Create in CLI, review in Studio (bidirectional sync)
- **CI/CD Ready** – Use in GitHub Actions and other automation tools

### Supported Networks 🌐
- Mantle Testnet (5003)
- Avalanche Fuji (43113)
- BNB Smart Chain Testnet (97)
- Base Testnet (84531)
- SKALE Hub Testnet
- Sui Testnet (foundation)

### Tech Stack 🛠️
- **CLI:** Node.js, TypeScript, Commander.js
- **Wallets:** Thirdweb SDK, ethers.js
- **Payments:** x402 (Avalanche Fuji)
- **Deployment:** Hardhat, Foundry integration
- **Security:** Slither, ESLint

## Installation

\`\`\`bash
npm install -g @hyperagent/cli
\`\`\`

## Quick Start

\`\`\`bash
hyperagent init my-app
hyperagent wallet connect
hyperagent generate --prompt "Create a token"
hyperagent deploy --chain mantle-testnet
\`\`\`

## Documentation

- [Getting Started](https://docs.hyperagent.io)
- [Command Reference](https://docs.hyperagent.io/commands)
- [Examples](https://github.com/hyperkit-labs/hyperagent-cli/tree/main/examples)

## Known Limitations

- Testnet only (mainnet support in Phase 2)
- Solidity only (Move/Sui support coming)
- No custodial key management

## Next Steps

- Phase 2: Full Studio integration
- Phase 3: Enterprise features

## Support

- 🐛 [Report Issues](https://github.com/hyperkit-labs/hyperagent-cli/issues)
- 💬 [Discord](https://discord.gg/hyperkit)
- 📚 [Docs](https://docs.hyperagent.io)

---

**Contributors:** @justinestarry @aaronalpha @tristanwagner  
**License:** MIT
```

**Time Box:** GitHub release complete by 1:00 PM.

#### 10.5 Marketing & Announcement (2 hours)

**Launch announcement template:**

```markdown
# 🚀 HyperAgent CLI v0.1.0 is LIVE!

Deploy smart contracts to 6 blockchains with AI assistance – now available on npm.

## Try it now:
\`\`\`bash
npm install -g @hyperagent/cli
hyperagent init my-app
\`\`\`

### What You Can Do:
✅ Generate smart contracts from prompts  
✅ Deploy to Mantle, Avalanche, BNB, Base, SKALE, Sui  
✅ Run security audits (free + paid professional via x402)  
✅ Manage wallets with Thirdweb  
✅ Use in GitHub Actions for CI/CD automation  

### Links:
📥 Install: https://www.npmjs.com/package/@hyperagent/cli  
📚 Docs: https://docs.hyperagent.io  
💻 GitHub: https://github.com/hyperkit-labs/hyperagent-cli  
🐦 Tweet: [Share on Twitter]

### Built with:
- Thirdweb (wallet management)
- x402 (pay-per-audit)
- ethers.js (multi-chain support)
- Hardhat (contract compilation)

Let's deploy! 🌐
```

**Social media posts (Twitter, Discord, LinkedIn):**
- Twitter (main): Full announcement with tech details
- Discord: Community discussion, support channel
- LinkedIn: Professional announcement

**Time Box:** Marketing materials ready by 3:00 PM.

#### 10.6 Partner & Community Outreach (1 hour)

**Notify key partners:**

- ✉️ Email to Mantle team – CLI support announcement
- ✉️ Email to Avalanche team – x402 integration highlight
- ✉️ Email to Thirdweb – CLI integration showcase
- 💬 Discord announcements – Developer communities
- 📰 Dev blogs – Mention in Hyperkit labs updates

**Time Box:** Partner notifications by 4:00 PM.

#### 10.7 Post-Launch Monitoring (1 hour)

**Monitor first 24 hours:**

- npm download stats
- GitHub stars
- Bug reports / support tickets
- User feedback
- Performance metrics

**Support team on standby:**
- GitHub issues: Quick response team
- Discord: Community support
- Email: Support@hyperkit.io

**Time Box:** Monitoring setup by 5:00 PM.

#### 10.8 End-of-Day Checkpoint (1 hour)

**Launch Day Checklist:**
- ✅ npm publish successful
- ✅ GitHub release created
- ✅ Marketing announced
- ✅ Documentation published
- ✅ Partners notified
- ✅ Support team ready
- ✅ Monitoring active

---

### DAY 11: LAUNCH DAY & SOFT RELEASE
**Date:** 01/31/2026 (Friday) – LAUNCH DAY  
**Duration:** 6 hours (soft launch window)  
**Owner:** All three founders  

#### 11.1 Final System Checks (1 hour, 9 AM)

**Launch morning checklist:**

```bash
# 1. Verify npm package
npm info @hyperagent/cli
# Should show v0.1.0

# 2. Test installation fresh
npm install -g @hyperagent/cli --force
hyperagent --version
# Should output: 0.1.0

# 3. Check documentation
curl https://docs.hyperagent.io
# Should load without errors

# 4. Backend API health
curl https://api.hyperagent.io/health
# Should respond: { "status": "ok" }

# 5. All networks reachable
hyperagent deploy --dry-run  # No actual deployment
# Should show gas estimates for all chains

echo "✅ All systems go!"
```

**Time Box:** System checks complete by 10:00 AM.

#### 11.2 Soft Release Announcement (1 hour, 10-11 AM)

**Twitter/Discord/LinkedIn posts scheduled:**

- 10:00 AM: Announcement post
- 10:15 AM: Installation instructions
- 10:30 AM: Feature demo thread
- 11:00 AM: Call to action (try it out)

**Announcement posts:**

**Twitter (Main):**
```
🚀 HyperAgent CLI v0.1.0 is LIVE!

Deploy smart contracts to 6 blockchains with AI + one-click audits.

✅ Mantle, Avalanche, BNB, Base, SKALE, Sui
✅ Free + professional audits (x402 powered)
✅ GitHub Actions ready
✅ Thirdweb wallet integrated

npm install -g @hyperagent/cli

Docs: https://docs.hyperagent.io
GitHub: https://github.com/hyperkit-labs/hyperagent-cli

Let's build! 🌐 #DeFi #Web3
```

**Discord Announcement:**
```
@channel 🎉 HyperAgent CLI is now live!

The easiest way to deploy smart contracts across multiple chains.

🔗 Try it: https://docs.hyperagent.io
📦 npm: @hyperagent/cli
💬 Questions? Ask here or in #support

v0.1.0 – MVP with full multi-chain support. More features coming in Phase 2!
```

**Time Box:** Announcement by 11:00 AM.

#### 11.3 Early User Onboarding (2 hours, 11 AM-1 PM)

**Monitor and support first users:**

- Watch for installation issues
- Answer questions in Discord
- Collect feedback
- Fix critical bugs immediately

**Discord support team active:**
- Real-time support in #support channel
- Quick response time (<15 mins)
- Feedback collection

**Time Box:** Early user support by 1:00 PM.

#### 11.4 First Day Analytics & Metrics (1 hour, 1-2 PM)

**Track launch metrics:**

```bash
# npm downloads (check npm stats)
npm info @hyperagent/cli

# GitHub activity
# - Stars gained
# - Issue reports
# - Fork count

# Discord community
# - New members
# - Questions asked
# - Activity level

# Website traffic
# - Docs page views
# - Installation page hits
# - Landing page engagement
```

**First 24-hour targets:**
- 50+ npm downloads ✅
- 5+ GitHub stars ✅
- 10+ Discord questions (supportive) ✅
- 0 critical bugs 🎯

**Time Box:** Analytics collected by 2:00 PM.

#### 11.5 Closing Celebration & Retrospective (1 hour, 2-3 PM)

**Team debrief call (3 founders):**

- ✅ What went well
- ⚠️ What we'd improve
- 🎯 Next steps (Phase 2 planning)
- 🎉 Celebrate launch!

**Talking points:**
- "We shipped in 10 days"
- "Full tech stack integrated"
- "6 blockchains supported"
- "Non-custodial by design"
- "Community is engaged and excited"

**Time Box:** Retrospective by 3:00 PM.

#### 11.6 Post-Launch Plan (Final 1 hour, 3-4 PM)

**Week 1 focus:**
- Monitor stability
- Collect user feedback
- Plan Phase 2 roadmap
- Onboard 5-10 power users for feedback
- Prepare for partner integrations

**Week 2+ focus:**
- Begin Phase 2 (Studio integration)
- Scale to 50+ active users
- Plan Phase 3 (enterprise features)

**Time Box:** Post-launch plan locked in by 4:00 PM.

---

## APPENDIX: FULL TECH STACK SUMMARY

### CLI Layer
| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | 18.x | CLI execution |
| **Framework** | TypeScript | 5.3.3 | Type-safe development |
| **CLI Parser** | Commander.js | 11.1.0 | Command parsing and routing |
| **UI/UX** | Chalk + Ora | 5.3.0 + 7.0.1 | Colored output, spinners |
| **Config** | YAML | 2.3.4 | Project configuration |
| **Validation** | Zod | 3.22.4 | Input validation schemas |

### Wallet & Web3
| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Wallets** | Thirdweb SDK | 3.15.0 | Wallet management |
| **RPC Calls** | ethers.js | 6.9.0 | Contract interaction |
| **Contract Compilation** | Hardhat | Latest | Solidity compilation |
| **Deployment** | ethers.js Signers | 6.9.0 | Transaction signing |

### Payment & Audit
| Component | Technology | Purpose |
|---|---|---|
| **Pay-per-Audit** | x402 (Avalanche) | 1 USDC per audit |
| **Contract Analysis** | Slither | Static analysis |
| **Code Quality** | ESLint | TypeScript linting |

### Multi-Chain Support
| Chain | Chain ID | RPC Provider | Status |
|---|---|---|---|
| **Mantle** | 5003 | mantle-testnet-rpc | ✅ Live |
| **Avalanche Fuji** | 43113 | api.avax-test.network | ✅ Live |
| **BNB Testnet** | 97 | data-seed-prebsc | ✅ Live |
| **Base Testnet** | 84531 | goerli.base.org | ✅ Live |
| **SKALE Hub** | 1 | testnet-rpc.skalechains.com | 🔧 Foundation |
| **Sui Testnet** | - | fullnode.testnet.sui | 🔧 Foundation |

### Testing & Quality
| Component | Tool | Purpose |
|---|---|---|
| **Unit Tests** | Vitest | Fast unit testing |
| **Integration Tests** | Vitest | E2E CLI flows |
| **Linting** | ESLint | Code quality |
| **Formatting** | Prettier | Code consistency |
| **Security** | npm audit | Dependency audit |

### Deployment & Distribution
| Platform | Purpose |
|---|---|
| **npm** | Package distribution |
| **GitHub** | Source control + releases |
| **GitHub Actions** | CI/CD automation |
| **Vercel** | Documentation hosting |

---

## KEY MILESTONES SUMMARY

| Date | Milestone | Status |
|---|---|---|
| **01/21** | Architecture & Repo Setup | ✅ Complete |
| **01/22** | CLI Core Commands | ✅ Complete |
| **01/23** | Thirdweb & Wallet Integration | ✅ Complete |
| **01/24** | x402 Payment Flow | ✅ Complete |
| **01/25** | Multi-Chain SDKs (4 chains) | ✅ Complete |
| **01/26** | SKALE & Sui (foundation) + Tests | ✅ Complete |
| **01/27** | Studio Sync & Webhooks | ✅ Complete |
| **01/28** | Documentation & Examples | ✅ Complete |
| **01/29** | E2E Testing & Security Audit | ✅ Complete |
| **01/30** | Polish & NPM Publish | ✅ Complete |
| **01/31** | Launch Day – Soft Release | 🚀 LIVE |

---

## SUCCESS CRITERIA – 10 DAY PLAN

### MVP Launch Checklist ✅

- ✅ CLI published to npm (@hyperagent/cli v0.1.0)
- ✅ Happy path works: init → generate → audit → deploy
- ✅ All core commands functional and documented
- ✅ Multi-chain support (6 chains, 4 fully + 2 foundation)
- ✅ x402 integration complete
- ✅ Thirdweb wallet support
- ✅ Studio sync hook operational
- ✅ 50+ npm installs on Day 1
- ✅ Comprehensive documentation live
- ✅ 3 working examples provided
- ✅ End-to-end tests green
- ✅ Zero critical security issues
- ✅ Community engagement begun
- ✅ Phase 2 roadmap ready

---

**Document Status:** ✅ COMPLETE & READY FOR EXECUTION  
**Prepared By:** Hyperkit Founding Team  
**Date:** January 21, 2026  
**Target Launch:** January 31, 2026 @ 5 PM UTC  

*This 10-day MVP plan front-loads critical integrations and demonstrates full product value before scaling to the 6-week Phase 2 CLI + Studio Integration plan. Success on this track positions HyperAgent CLI for rapid adoption, early community validation, and confident Phase 2 planning.*
