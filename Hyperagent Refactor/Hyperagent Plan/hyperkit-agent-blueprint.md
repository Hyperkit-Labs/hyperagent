# HyperAgent Implementation Blueprint
## Complete Gen + Validation Pipeline

**Last updated:** January 19, 2026  
**Target MVP launch:** February 7, 2026  
**Status:** Specification for development

---

## Table of Contents

1. [Plan JSON Schema](#plan-json-schema)
2. [Agent Contracts & Responsibilities](#agent-contracts--responsibilities)
3. [ContractAgent Pipeline](#contractagent-pipeline)
4. [BackendAgent Pipeline](#backendagent-pipeline)
5. [FrontendAgent Pipeline](#frontendagent-pipeline)
6. [QAAgent & Validation Gates](#qagent--validation-gates)
7. [Sub-Agent Orchestration](#sub-agent-orchestration)
8. [End-to-End Flow](#end-to-end-flow)

---

## Plan JSON Schema

The **PlannerAgent** outputs a `plan.json` that all downstream agents consume. This is the single source of truth for the generated project.

### Schema Definition

```typescript
// types/plan.ts
export interface Plan {
  // Metadata
  projectId: string;                    // CUID, immutable
  projectName: string;                  // "My DEX"
  projectSlug: string;                  // "my-dex"
  description: string;
  createdAt: string;                    // ISO 8601
  updatedAt: string;

  // Chains & Networks
  chains: ChainConfig[];
  defaultChain: string;                 // 'skale' or 'mantle'
  
  // Authentication
  auth: AuthConfig;
  
  // Payments & Metering
  payments: PaymentConfig;
  
  // Database
  database: DatabaseConfig;
  
  // Smart Contracts
  contracts: ContractConfig[];
  
  // API & Backend
  backend: BackendConfig;
  
  // Frontend
  frontend: FrontendConfig;
  
  // Testing & Deployment
  ci: CIConfig;
  deployment: DeploymentConfig;
}

export interface ChainConfig {
  id: string;                           // 'mantle', 'skale', 'base', etc.
  chainId: number;                      // EIP-155 chain ID
  name: string;
  nativeToken: string;
  kind: 'evm-l1' | 'evm-l2' | 'evm-skale' | 'solana' | 'sui';
  
  gasModel: 'native' | 'gasless' | 'aa-sponsored';
  rpcUrlEnv: string;                    // ENV var name
  explorerUrl: string;
  
  // ERC-4337 & AA
  aa?: {
    entryPointAddress: string;
    entryPointVersion: '0.6' | '0.7';
    paymasterAddress?: string;          // Optional if gasless
    factoryAddress: string;
  };
  
  // x402 settlement
  x402?: {
    settlementChain: string;            // Which chain settles bills
    stablecoin: string;                 // 'USDC', 'USDT'
  };
  
  // DEX specifics (if DEX project)
  dex?: {
    routerAddress: string;
    factoryAddress: string;
    swapFeePercentage: number;
  };
}

export interface AuthConfig {
  type: 'email' | 'social' | 'eoa' | 'none';
  provider?: 'custom-aa' | 'thirdweb' | 'alchemy';
  
  // Email + AA
  emailConfig?: {
    sendgridApiKeyEnv: string;
    fromEmail: string;
  };
  
  // Session management
  sessionStore: 'memory' | 'redis' | 'postgres';
}

export interface PaymentConfig {
  type: 'x402' | 'subscription' | 'none';
  
  x402Config?: {
    settlementChain: string;
    stablecoin: string;
    pricePerApiCall: string;            // In USD cents (e.g., "1" = $0.01)
    billingInterval: 'per-call' | 'hourly' | 'daily';
  };
}

export interface DatabaseConfig {
  provider: 'postgresql' | 'mysql' | 'sqlite';
  host?: string;                        // For managed: Supabase/RDS endpoint
  type: 'managed' | 'self-hosted';
  
  // Tables to auto-generate
  tables: {
    users: boolean;
    transactions: boolean;
    x402Payments: boolean;
    liquidityPositions?: boolean;      // DEX-specific
    liquidityPools?: boolean;
  };
}

export interface ContractConfig {
  name: string;                         // 'DEX', 'Token', 'LiquidityPool'
  template: string;                     // Pinned version: 'dex@1.2.0'
  templateSource: 'openzeppelin' | 'thirdweb' | 'hyperkit' | 'custom';
  
  // Which regions are user-editable
  editableHooks: string[];              // e.g., ['_beforeSwap', '_afterSwap']
  
  // Constructor params
  params: Record<string, string | number>;
  
  // Per-chain deployment overrides
  chainOverrides: {
    [chainId: string]: {
      constructorArgs?: Record<string, string>;
      gasLimit?: number;
    };
  };
  
  // Tests to auto-generate
  testCoverage: string[];               // e.g., ['swap', 'addLiquidity', 'removeLiquidity']
}

export interface BackendConfig {
  framework: 'next-api-routes' | 'nestjs' | 'express';
  orm: 'prisma' | 'drizzle' | 'typeorm';
  
  // API routes to generate
  routes: {
    path: string;                       // '/api/quote', '/api/swap'
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    requiresAuth: boolean;
    requiresX402: boolean;
    description: string;
  }[];
  
  // Middleware stack
  middleware: ('auth' | 'x402' | 'cors' | 'rateLimit' | 'logging')[];
  
  // Environment variables needed
  envVars: {
    name: string;
    required: boolean;
    description: string;
    example?: string;
  }[];
}

export interface FrontendConfig {
  framework: 'next-app-router' | 'react-vite';
  ui: 'shadcn' | 'headless-ui';
  styling: 'tailwind' | 'panda-css';
  
  // Pages to generate
  pages: {
    path: string;                       // '/swap', '/liquidity', '/dashboard'
    title: string;
    description: string;
    components: string[];               // Which components used
  }[];
  
  // Web3 libraries
  web3: {
    wallet: 'rainbowkit' | 'connectkit';
    contract: 'wagmi' | 'ethers' | 'viem';
    aa?: 'alchemy' | 'thirdweb';
  };
  
  // Hooks to generate
  hooks: string[];                      // 'useSwap', 'useQuote', 'useChain'
}

export interface CIConfig {
  provider: 'github-actions' | 'gitlab-ci' | 'circleci';
  
  checks: {
    typescript: boolean;
    eslint: boolean;
    contractSlither: boolean;
    contractFoundry: boolean;
    e2ePlaywright: boolean;
  };
  
  onFailure: 'block-merge' | 'warn-only';
}

export interface DeploymentConfig {
  frontend: {
    provider: 'vercel' | 'netlify' | 'docker';
    autoDeployBranch: 'main';
  };
  
  contracts: {
    scripts: string[];                  // 'DeployMantle.s.sol', 'DeploySkale.s.sol'
    network: 'testnet' | 'mainnet';
  };
  
  backend?: {
    provider: 'vercel-api' | 'render' | 'railway' | 'docker';
  };
}
```

### Example Plan: DEX on Mantle + SKALE

```json
{
  "projectId": "clz8x9q1p0001234567890abcd",
  "projectName": "HyperDEX",
  "projectSlug": "hyperdex",
  "description": "Gasless DEX with x402 metering",
  "createdAt": "2026-01-19T15:30:00Z",
  "updatedAt": "2026-01-19T15:30:00Z",
  
  "chains": [
    {
      "id": "skale",
      "chainId": 1301,
      "name": "SKALE Calypso",
      "nativeToken": "sFUEL",
      "kind": "evm-skale",
      "gasModel": "gasless",
      "rpcUrlEnv": "NEXT_PUBLIC_SKALE_RPC",
      "explorerUrl": "https://explorer.calypso.skale.network",
      "aa": {
        "entryPointAddress": "0x5FF137D4B0FDCD49DcA30c7CF57E578a026d2789",
        "entryPointVersion": "0.6",
        "factoryAddress": "0x9406Cc6185a346906296840746125a0E44976454"
      },
      "x402": {
        "settlementChain": "skale",
        "stablecoin": "USDC"
      },
      "dex": {
        "routerAddress": "0x...",
        "factoryAddress": "0x...",
        "swapFeePercentage": 0.3
      }
    },
    {
      "id": "mantle",
      "chainId": 5000,
      "name": "Mantle",
      "nativeToken": "MNT",
      "kind": "evm-l2",
      "gasModel": "aa-sponsored",
      "rpcUrlEnv": "NEXT_PUBLIC_MANTLE_RPC",
      "explorerUrl": "https://explorer.mantle.xyz",
      "aa": {
        "entryPointAddress": "0x5FF137D4B0FDCD49DcA30c7CF57E578a026d2789",
        "entryPointVersion": "0.6",
        "paymasterAddress": "0x...",
        "factoryAddress": "0x9406Cc6185a346906296840746125a0E44976454"
      },
      "x402": {
        "settlementChain": "mantle",
        "stablecoin": "USDC"
      },
      "dex": {
        "routerAddress": "0x...",
        "factoryAddress": "0x...",
        "swapFeePercentage": 0.3
      }
    }
  ],
  "defaultChain": "skale",
  
  "auth": {
    "type": "email",
    "provider": "custom-aa",
    "emailConfig": {
      "sendgridApiKeyEnv": "SENDGRID_API_KEY",
      "fromEmail": "noreply@hyperdex.io"
    },
    "sessionStore": "postgres"
  },
  
  "payments": {
    "type": "x402",
    "x402Config": {
      "settlementChain": "mantle",
      "stablecoin": "USDC",
      "pricePerApiCall": "1",
      "billingInterval": "per-call"
    }
  },
  
  "database": {
    "provider": "postgresql",
    "type": "managed",
    "tables": {
      "users": true,
      "transactions": true,
      "x402Payments": true,
      "liquidityPositions": true,
      "liquidityPools": true
    }
  },
  
  "contracts": [
    {
      "name": "DEX",
      "template": "dex@1.2.0",
      "templateSource": "hyperkit",
      "editableHooks": ["_beforeSwap", "_afterSwap", "_beforeAddLiquidity"],
      "params": {
        "feePercentage": "30",
        "owner": "0x..."
      },
      "chainOverrides": {
        "1301": { "gasLimit": 3000000 },
        "5000": { "gasLimit": 5000000 }
      },
      "testCoverage": ["swap", "addLiquidity", "removeLiquidity", "getAmountsOut"]
    },
    {
      "name": "Token",
      "template": "erc20@0.9.3",
      "templateSource": "openzeppelin",
      "editableHooks": [],
      "params": {
        "name": "HyperToken",
        "symbol": "HYPER",
        "initialSupply": "1000000000000000000000000"
      },
      "chainOverrides": {},
      "testCoverage": ["transfer", "approve", "burn"]
    }
  ],
  
  "backend": {
    "framework": "next-api-routes",
    "orm": "prisma",
    "routes": [
      {
        "path": "/api/auth/nonce",
        "method": "POST",
        "requiresAuth": false,
        "requiresX402": false,
        "description": "Request auth nonce for email login"
      },
      {
        "path": "/api/auth/verify",
        "method": "POST",
        "requiresAuth": false,
        "requiresX402": false,
        "description": "Verify signed message, create AA wallet"
      },
      {
        "path": "/api/quote",
        "method": "POST",
        "requiresAuth": true,
        "requiresX402": true,
        "description": "Get swap quote (x402-gated)"
      },
      {
        "path": "/api/liquidity",
        "method": "POST",
        "requiresAuth": true,
        "requiresX402": false,
        "description": "Add/remove liquidity"
      }
    ],
    "middleware": ["auth", "x402", "cors", "rateLimit", "logging"],
    "envVars": [
      {
        "name": "DATABASE_URL",
        "required": true,
        "description": "PostgreSQL connection string",
        "example": "postgresql://user:pass@localhost/hyperdex"
      },
      {
        "name": "NEXT_PUBLIC_MANTLE_RPC",
        "required": true,
        "description": "Mantle RPC endpoint"
      },
      {
        "name": "NEXT_PUBLIC_SKALE_RPC",
        "required": true,
        "description": "SKALE RPC endpoint"
      },
      {
        "name": "SENDGRID_API_KEY",
        "required": true,
        "description": "SendGrid API key for email"
      }
    ]
  },
  
  "frontend": {
    "framework": "next-app-router",
    "ui": "shadcn",
    "styling": "tailwind",
    "pages": [
      {
        "path": "/",
        "title": "Home",
        "description": "Landing page",
        "components": ["Header", "HeroSection", "FeatureCard"]
      },
      {
        "path": "/swap",
        "title": "Swap",
        "description": "DEX swap interface",
        "components": ["ChainSelector", "SwapForm", "PriceChart", "TransactionHistory"]
      },
      {
        "path": "/liquidity",
        "title": "Liquidity",
        "description": "Provide liquidity",
        "components": ["AddLiquidityForm", "RemoveLiquidityForm", "PoolStats"]
      },
      {
        "path": "/dashboard",
        "title": "Dashboard",
        "description": "User portfolio",
        "components": ["PortfolioCard", "PositionsTable", "TransactionHistory"]
      }
    ],
    "web3": {
      "wallet": "rainbowkit",
      "contract": "wagmi",
      "aa": "alchemy"
    },
    "hooks": ["useSwap", "useQuote", "useChain", "useWallet", "useLiquidity", "useUserBalance", "useTransactionHistory"]
  },
  
  "ci": {
    "provider": "github-actions",
    "checks": {
      "typescript": true,
      "eslint": true,
      "contractSlither": true,
      "contractFoundry": true,
      "e2ePlaywright": true
    },
    "onFailure": "block-merge"
  },
  
  "deployment": {
    "frontend": {
      "provider": "vercel",
      "autoDeployBranch": "main"
    },
    "contracts": {
      "scripts": ["DeploySkale.s.sol", "DeployMantle.s.sol"],
      "network": "testnet"
    },
    "backend": {
      "provider": "vercel-api"
    }
  }
}
```

---

## Agent Contracts & Responsibilities

Each agent is a **specialized code generator** with strict input/output contracts.

### Agent Interface

```typescript
// types/agent.ts
export interface Agent {
  name: string;
  version: string;
  
  // Main execution
  generate(params: GenerateParams): Promise<GenerateOutput>;
  
  // Validation
  validate(output: GenerateOutput): Promise<ValidationResult>;
  
  // Rollback (if generation failed midway)
  rollback(projectId: string): Promise<void>;
}

export interface GenerateParams {
  plan: Plan;
  projectPath: string;
  existingRepo?: boolean;              // True if updating existing
  dryRun?: boolean;                     // Don't write files, just return plan
}

export interface GenerateOutput {
  files: FileOutput[];
  errors: string[];
  warnings: string[];
  logs: string[];
  
  // Artifact hashes for integrity checking
  artifacts: {
    [filePath: string]: string;        // SHA-256 hash
  };
}

export interface FileOutput {
  path: string;                        // Relative path in repo
  content: string;                     // File content
  mode?: 'create' | 'update' | 'delete';
  protected?: boolean;                 // If true, user shouldn't edit
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: {
    linesOfCode: number;
    testCoverage: number;
    typeCheckErrors: number;
  };
}

export interface ValidationError {
  code: string;                        // e.g., 'TYPE_ERROR', 'SLITHER_CRITICAL'
  message: string;
  filePath: string;
  line?: number;
  fixable?: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  filePath: string;
  severity: 'low' | 'medium' | 'high';
}
```

### Contract-Per-Agent

---

## ContractAgent Pipeline

Generates `/contracts/` (Solidity + tests + deploy scripts).

### Inputs

```typescript
interface ContractAgentInput {
  plan: Plan;
  projectPath: string;
}
```

### Outputs

```
/contracts/
├── foundry.toml
├── src/
│   ├── DEX.sol                 (pinned template + user hooks)
│   ├── Token.sol               (pinned template)
│   ├── LiquidityPool.sol
│   └── interfaces/
│       ├── IDEX.sol
│       ├── IToken.sol
│       └── ILiquidityPool.sol
├── test/
│   ├── DEX.t.sol               (auto-generated tests)
│   ├── Token.t.sol
│   ├── LiquidityPool.t.sol
│   └── helpers/
│       ├── MockTokens.sol
│       └── Constants.sol
├── script/
│   ├── Deploy.s.sol            (multi-chain deployment)
│   ├── DeploySkale.s.sol
│   └── DeployMantle.s.sol
├── slither.config.json
└── .slitherignore
```

### Generation Algorithm

```typescript
// agents/ContractAgent.ts
export class ContractAgent implements Agent {
  name = 'ContractAgent';
  version = '0.1.0';

  async generate(params: GenerateParams): Promise<GenerateOutput> {
    const { plan, projectPath } = params;
    const output: GenerateOutput = {
      files: [],
      errors: [],
      warnings: [],
      logs: [],
      artifacts: {},
    };

    try {
      // 1. Create foundry.toml
      output.files.push(this.generateFoundryConfig(plan));

      // 2. For each contract in plan
      for (const contractCfg of plan.contracts) {
        // 2a. Fetch pinned template from registry
        const template = await this.fetchTemplate(
          contractCfg.template,
          contractCfg.templateSource
        );

        // 2b. Inject chain-specific params
        let contract = this.injectParams(template.code, contractCfg.params);

        // 2c. Create extension hook markers
        contract = this.addExtensionHooks(
          contract,
          contractCfg.editableHooks
        );

        // 2d. Add to output
        output.files.push({
          path: `contracts/src/${contractCfg.name}.sol`,
          content: contract,
          protected: true,           // Core logic immutable
        });

        // 2e. Generate test file
        const testFile = this.generateTest(contractCfg, template);
        output.files.push({
          path: `contracts/test/${contractCfg.name}.t.sol`,
          content: testFile,
          protected: false,          // User can extend tests
        });
      }

      // 3. Generate deploy scripts (one per chain)
      for (const chain of plan.chains) {
        const deployScript = this.generateDeployScript(plan, chain);
        output.files.push({
          path: `contracts/script/Deploy${chain.name}.s.sol`,
          content: deployScript,
          protected: false,
        });
      }

      // 4. Generate slither config
      output.files.push(this.generateSlitherConfig());

      // 5. Hash artifacts for integrity
      for (const file of output.files) {
        output.artifacts[file.path] = this.sha256(file.content);
      }

      output.logs.push(
        `✓ ContractAgent generated ${output.files.length} files`
      );

    } catch (error) {
      output.errors.push(`ContractAgent failed: ${error.message}`);
    }

    return output;
  }

  async validate(output: GenerateOutput): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      metrics: { linesOfCode: 0, testCoverage: 0, typeCheckErrors: 0 },
    };

    try {
      // 1. Foundry build
      const buildOutput = await this.runFoundryBuild();
      if (buildOutput.errors.length > 0) {
        result.passed = false;
        result.errors.push(...buildOutput.errors);
      }

      // 2. Foundry tests
      const testOutput = await this.runFoundryTests();
      if (testOutput.failed > 0) {
        result.passed = false;
        result.errors.push({
          code: 'FOUNDRY_TEST_FAILURE',
          message: `${testOutput.failed} tests failed`,
          filePath: 'contracts/test/',
        });
      }
      result.metrics.testCoverage = testOutput.coverage;

      // 3. Slither analysis
      const slitherOutput = await this.runSlither();
      for (const issue of slitherOutput.issues) {
        if (issue.severity === 'high') {
          result.passed = false;
          result.errors.push({
            code: 'SLITHER_HIGH',
            message: issue.description,
            filePath: `contracts/src/${issue.contract}.sol`,
            line: issue.line,
          });
        } else if (issue.severity === 'medium') {
          result.warnings.push({
            code: 'SLITHER_MEDIUM',
            message: issue.description,
            filePath: `contracts/src/${issue.contract}.sol`,
            severity: 'medium',
          });
        }
      }

      // 4. Count lines of code
      result.metrics.linesOfCode = output.files
        .filter(f => f.path.startsWith('contracts/src/'))
        .reduce((sum, f) => sum + f.content.split('\n').length, 0);

    } catch (error) {
      result.errors.push({
        code: 'VALIDATION_ERROR',
        message: error.message,
        filePath: 'contracts/',
      });
      result.passed = false;
    }

    return result;
  }

  // Helpers

  private async fetchTemplate(
    templateId: string,
    source: string
  ): Promise<{ code: string; abi?: any[] }> {
    // Fetch from pinned registry
    // Examples:
    //   - 'dex@1.2.0' → HYPERKIT_TEMPLATES['dex']['1.2.0']
    //   - 'erc20@0.9.3' → OpenZeppelin catalog
    const [name, version] = templateId.split('@');
    
    if (source === 'hyperkit') {
      return HYPERKIT_TEMPLATES[name][version];
    } else if (source === 'openzeppelin') {
      return await this.fetchFromOpenZeppelin(name, version);
    } else if (source === 'thirdweb') {
      return await this.fetchFromThirdweb(name, version);
    }
    throw new Error(`Unknown template source: ${source}`);
  }

  private injectParams(
    code: string,
    params: Record<string, any>
  ): string {
    let result = code;
    for (const [key, value] of Object.entries(params)) {
      // Replace placeholders: {{ PARAM_NAME }}
      result = result.replace(
        new RegExp(`{{\\s*${key}\\s*}}`, 'g'),
        String(value)
      );
    }
    return result;
  }

  private addExtensionHooks(
    code: string,
    hooks: string[]
  ): string {
    // Add markers so HyperAgent knows these regions are editable
    let result = code;
    for (const hook of hooks) {
      result = result.replace(
        `function ${hook}`,
        `
    // === EXTENSION HOOK: SAFE TO EDIT ===
    function ${hook}`
      );
    }
    result = result.replace(
      /(=== EXTENSION HOOK: SAFE TO EDIT ===[\s\S]*?^\}/m,
      '$1\n    // === /EXTENSION HOOK ===\n'
    );
    return result;
  }

  private generateTest(
    contractCfg: ContractConfig,
    template: any
  ): string {
    // Use template + test coverage list to generate Foundry tests
    const testName = `${contractCfg.name}Test`;
    let code = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${contractCfg.name}.sol";
import "./helpers/MockTokens.sol";

contract ${testName} is Test {
    ${contractCfg.name} public contract;
    address user = address(0x123);

`;

    // Generate test functions for each coverage item
    for (const coverage of contractCfg.testCoverage) {
      code += this.generateTestFunction(coverage, contractCfg);
    }

    code += '\n}';
    return code;
  }

  private generateTestFunction(coverage: string, cfg: ContractConfig): string {
    // Generate boilerplate test based on coverage type
    // Examples: 'swap', 'addLiquidity', 'transfer', 'approve'
    switch (coverage) {
      case 'swap':
        return `
    function test_Swap() public {
        // TODO: Implement swap test
    }
`;
      case 'transfer':
        return `
    function test_Transfer() public {
        // TODO: Implement transfer test
    }
`;
      // ... more cases
      default:
        return `
    function test_${coverage}() public {
        // TODO: Implement ${coverage} test
    }
`;
    }
  }

  private generateDeployScript(plan: Plan, chain: ChainConfig): string {
    return `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DEX.sol";
import "../src/Token.sol";

contract Deploy${chain.name} is Script {
    address constant ENTRY_POINT = ${chain.aa?.entryPointAddress || 'address(0)'};
    
    ${
      chain.aa?.paymasterAddress
        ? `address constant PAYMASTER = ${chain.aa.paymasterAddress};`
        : '// No paymaster (gasless chain)'
    }

    function run() public {
        vm.startBroadcast();

        // 1. Deploy Token
        Token token = new Token(
            "HyperToken",
            "HYPER",
            1000000e18
        );

        // 2. Deploy DEX
        DEX dex = new DEX(
            address(token),
            ${chain.dex?.swapFeePercentage || '30'}
        );

        vm.stopBroadcast();

        console.log("Token deployed at:", address(token));
        console.log("DEX deployed at:", address(dex));
    }
}
`;
  }

  private generateSlitherConfig(): FileOutput {
    return {
      path: 'contracts/slither.config.json',
      content: JSON.stringify({
        exclude_paths: ['test', 'node_modules'],
        exclude_dependencies: true,
        filter_paths: ['contracts/src/'],
      }, null, 2),
      protected: true,
    };
  }

  private async runFoundryBuild() {
    // Execute: cd contracts && forge build
    // Return: { errors: [...], warnings: [...] }
    // This is pseudo-code; real impl would spawn child process
    return { errors: [], warnings: [] };
  }

  private async runFoundryTests() {
    // Execute: cd contracts && forge test --coverage
    // Return: { failed: 0, passed: 10, coverage: 85 }
    return { failed: 0, passed: 0, coverage: 0 };
  }

  private async runSlither() {
    // Execute: slither . --json
    // Parse and return issues
    return { issues: [] };
  }

  private sha256(data: string): string {
    // Return SHA-256 hash
    return '';
  }
}
```

---

## BackendAgent Pipeline

Generates `/src/app/api/`, `/prisma/`, `/src/services/`.

### Outputs

```
/src/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── nonce/
│       │   │   └── route.ts
│       │   └── verify/
│       │       └── route.ts
│       ├── x402/
│       │   ├── verify/
│       │   │   └── route.ts
│       │   └── meter/
│       │       └── route.ts
│       ├── quote/
│       │   └── route.ts
│       └── liquidity/
│           └── route.ts
├── services/
│   ├── dexService.ts
│   ├── swapService.ts
│   ├── walletService.ts
│   ├── x402Service.ts
│   └── chainService.ts
├── middleware/
│   ├── auth.ts
│   └── x402.ts
└── lib/
    ├── prisma.ts
    └── contracts.ts

/prisma/
├── schema.prisma
└── migrations/
```

### Generation Algorithm

```typescript
// agents/BackendAgent.ts
export class BackendAgent implements Agent {
  name = 'BackendAgent';
  version = '0.1.0';

  async generate(params: GenerateParams): Promise<GenerateOutput> {
    const { plan, projectPath } = params;
    const output: GenerateOutput = {
      files: [],
      errors: [],
      warnings: [],
      logs: [],
      artifacts: {},
    };

    try {
      // 1. Generate Prisma schema
      output.files.push(this.generatePrismaSchema(plan));

      // 2. Generate middleware
      output.files.push(this.generateAuthMiddleware(plan));
      output.files.push(this.generateX402Middleware(plan));

      // 3. Generate API routes
      for (const route of plan.backend.routes) {
        const routeFile = this.generateRoute(route, plan);
        output.files.push(routeFile);
      }

      // 4. Generate services
      output.files.push(this.generateDexService(plan));
      output.files.push(this.generateSwapService(plan));
      output.files.push(this.generateWalletService(plan));
      output.files.push(this.generateX402Service(plan));
      output.files.push(this.generateChainService(plan));

      // 5. Generate lib utilities
      output.files.push(this.generatePrismaClient());
      output.files.push(this.generateContractsLib(plan));

      // 6. Generate .env.example
      output.files.push(this.generateEnvExample(plan));

      // Hash artifacts
      for (const file of output.files) {
        output.artifacts[file.path] = this.sha256(file.content);
      }

      output.logs.push(
        `✓ BackendAgent generated ${output.files.length} files`
      );

    } catch (error) {
      output.errors.push(`BackendAgent failed: ${error.message}`);
    }

    return output;
  }

  async validate(output: GenerateOutput): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      metrics: { linesOfCode: 0, testCoverage: 0, typeCheckErrors: 0 },
    };

    try {
      // 1. TypeScript compile
      const tsErrors = await this.runTypeScript();
      if (tsErrors.length > 0) {
        result.passed = false;
        result.errors.push(...tsErrors.map(e => ({
          code: 'TS_ERROR',
          message: e.message,
          filePath: e.file,
          line: e.line,
        })));
      }

      // 2. Run linting
      const lintErrors = await this.runEslint();
      // Convert lint errors to warnings (non-blocking)
      result.warnings.push(...lintErrors.map(e => ({
        code: 'LINT_WARNING',
        message: e.message,
        filePath: e.file,
        severity: 'low' as const,
      })));

      // 3. Count lines of code
      result.metrics.linesOfCode = output.files
        .filter(f => f.path.includes('/api/') || f.path.includes('/services/'))
        .reduce((sum, f) => sum + f.content.split('\n').length, 0);

    } catch (error) {
      result.errors.push({
        code: 'VALIDATION_ERROR',
        message: error.message,
        filePath: 'src/',
      });
      result.passed = false;
    }

    return result;
  }

  // Helpers

  private generatePrismaSchema(plan: Plan): FileOutput {
    const tables = plan.database.tables;

    let schema = `
datasource db {
  provider = "${plan.database.provider}"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`;

    if (tables.users) {
      schema += `
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  walletAddress     String?   @unique
  smartAccountAddr  String?   @unique
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  transactions        Transaction[]
  x402Payments        X402Payment[]
  liquidityPositions  LiquidityPosition[]
}
`;
    }

    if (tables.transactions) {
      schema += `
model Transaction {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  
  txHash    String    @unique
  chainId   Int
  type      String    // 'swap', 'addLiquidity', etc.
  amountIn  String
  amountOut String
  status    String
  timestamp DateTime  @default(now())
  
  @@index([userId])
  @@index([chainId])
}
`;
    }

    if (tables.x402Payments) {
      schema += `
model X402Payment {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  
  apiEndpoint String
  amountUSDC  String
  status      String
  createdAt   DateTime  @default(now())
  
  @@index([userId])
}
`;
    }

    if (tables.liquidityPositions) {
      schema += `
model LiquidityPosition {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  
  poolId      String
  chainId     Int
  sharesAmount String
  createdAt   DateTime  @default(now())
  
  @@unique([userId, poolId, chainId])
}
`;
    }

    return {
      path: 'prisma/schema.prisma',
      content: schema,
      protected: false,
    };
  }

  private generateAuthMiddleware(plan: Plan): FileOutput {
    return {
      path: 'src/middleware/auth.ts',
      content: `
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function authMiddleware(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return null; // Pass through
}
`,
      protected: false,
    };
  }

  private generateX402Middleware(plan: Plan): FileOutput {
    if (plan.payments.type !== 'x402') {
      return {
        path: 'src/middleware/x402.ts',
        content: '// x402 not enabled',
        protected: true,
      };
    }

    return {
      path: 'src/middleware/x402.ts',
      content: `
import { NextRequest, NextResponse } from 'next/server';
import { x402Service } from '@/services/x402Service';
import { prisma } from '@/lib/prisma';

export async function x402Middleware(req: NextRequest) {
  const proof = req.headers.get('x402-proof');
  const userId = req.headers.get('x-user-id');

  if (!proof || !userId) {
    return NextResponse.json(
      { error: 'Payment required' },
      { status: 402 }
    );
  }

  // Verify x402 proof
  const isValid = await x402Service.verifyProof(proof);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid payment proof' },
      { status: 402 }
    );
  }

  // Record payment
  await prisma.x402Payment.create({
    data: {
      userId,
      apiEndpoint: req.nextUrl.pathname,
      amountUSDC: '${plan.payments.x402Config?.pricePerApiCall || '1'}',
      status: 'settled',
    },
  });

  return null; // Pass through
}
`,
      protected: false,
    };
  }

  private generateRoute(route: any, plan: Plan): FileOutput {
    // Generate route handler based on route definition
    const routeParts = route.path.split('/');
    const handlerName = routeParts[routeParts.length - 1];

    let handler = `
import { NextRequest, NextResponse } from 'next/server';
`;

    if (route.requiresAuth) {
      handler += `import { authMiddleware } from '@/middleware/auth';\n`;
    }
    if (route.requiresX402) {
      handler += `import { x402Middleware } from '@/middleware/x402';\n`;
    }

    handler += `
export async function ${route.method}(req: NextRequest) {
  try {
`;

    if (route.requiresAuth) {
      handler += `
    const authError = await authMiddleware(req);
    if (authError) return authError;
`;
    }

    if (route.requiresX402) {
      handler += `
    const x402Error = await x402Middleware(req);
    if (x402Error) return x402Error;
`;
    }

    handler += `
    // TODO: Implement ${handlerName} logic
    return NextResponse.json({ message: '${handlerName} endpoint' });

  } catch (error) {
    console.error('${handlerName} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;

    return {
      path: `src/app/api${route.path}/route.ts`,
      content: handler,
      protected: false,
    };
  }

  private generateDexService(plan: Plan): FileOutput {
    return {
      path: 'src/services/dexService.ts',
      content: `
// DEX business logic
export const dexService = {
  async getQuote(params: {
    tokenIn: string;
    tokenOut: string;
    amount: string;
    chainId: number;
  }) {
    // TODO: Implement quote logic
    return {
      amountOut: '0',
      priceImpact: '0',
    };
  },
};
`,
      protected: false,
    };
  }

  private generateSwapService(plan: Plan): FileOutput {
    return {
      path: 'src/services/swapService.ts',
      content: `
// Swap orchestration
export const swapService = {
  async executeSwap(params: any) {
    // TODO: Implement swap logic
  },
};
`,
      protected: false,
    };
  }

  private generateWalletService(plan: Plan): FileOutput {
    return {
      path: 'src/services/walletService.ts',
      content: `
// AA wallet management
export const walletService = {
  async executeAATransaction(params: any) {
    // TODO: Implement AA transaction execution
  },
};
`,
      protected: false,
    };
  }

  private generateX402Service(plan: Plan): FileOutput {
    return {
      path: 'src/services/x402Service.ts',
      content: `
// x402 payment handling
export const x402Service = {
  async verifyProof(proof: string) {
    // TODO: Verify x402 proof
    return true;
  },
};
`,
      protected: false,
    };
  }

  private generateChainService(plan: Plan): FileOutput {
    return {
      path: 'src/services/chainService.ts',
      content: `
// Multi-chain utilities
export const chainService = {
  getDEXRouter(chainId: number) {
    // TODO: Return DEX router address for chain
    return '0x';
  },
};
`,
      protected: false,
    };
  }

  private generatePrismaClient(): FileOutput {
    return {
      path: 'src/lib/prisma.ts',
      content: `
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma in serverless
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`,
      protected: true,
    };
  }

  private generateContractsLib(plan: Plan): FileOutput {
    const abis: Record<string, any> = {};
    for (const contract of plan.contracts) {
      // Fetch ABI from template
      abis[contract.name] = [];
    }

    return {
      path: 'src/lib/contracts.ts',
      content: `
export const CONTRACT_ABIS = ${JSON.stringify(abis, null, 2)};

export const CONTRACT_ADDRESSES = {
  ${plan.chains.map(c => `
  ${c.id}: {
    // TODO: Add contract addresses for ${c.name}
  },
  `).join('')}
};
`,
      protected: false,
    };
  }

  private generateEnvExample(plan: Plan): FileOutput {
    const envVars = plan.backend.envVars;
    let content = '# Database\n';
    content += 'DATABASE_URL=postgresql://user:pass@localhost/hyperdex\n\n';

    content += '# Chains\n';
    for (const chain of plan.chains) {
      content += `${chain.rpcUrlEnv}=https://rpc.${chain.id}.example.com\n`;
    }

    content += '\n# Auth\n';
    if (plan.auth.emailConfig) {
      content += `${plan.auth.emailConfig.sendgridApiKeyEnv}=your-sendgrid-key\n`;
    }

    content += '\n# Secrets (never commit)\n';
    content += 'NEXTAUTH_SECRET=your-secret-here\n';

    return {
      path: '.env.local.example',
      content,
      protected: false,
    };
  }

  private async runTypeScript() {
    // Execute: tsc --noEmit
    return [];
  }

  private async runEslint() {
    // Execute: eslint src/
    return [];
  }

  private sha256(data: string): string {
    return '';
  }
}
```

---

## FrontendAgent Pipeline

Generates `/src/app/` pages, `/src/components/`, `/src/hooks/`.

### Generation Pattern

```typescript
// agents/FrontendAgent.ts
export class FrontendAgent implements Agent {
  name = 'FrontendAgent';
  version = '0.1.0';

  async generate(params: GenerateParams): Promise<GenerateOutput> {
    const { plan, projectPath } = params;
    const output: GenerateOutput = {
      files: [],
      errors: [],
      warnings: [],
      logs: [],
      artifacts: {},
    };

    try {
      // 1. Generate root layout + globals
      output.files.push(this.generateRootLayout(plan));
      output.files.push(this.generateGlobalsCss());

      // 2. Generate providers
      output.files.push(this.generateWagmiProvider(plan));
      output.files.push(this.generateAAProvider(plan));
      output.files.push(this.generateThemeProvider());

      // 3. Generate layout components
      output.files.push(this.generateHeader(plan));
      output.files.push(this.generateSidebar(plan));
      output.files.push(this.generateFooter(plan));

      // 4. Generate pages
      for (const page of plan.frontend.pages) {
        output.files.push(this.generatePage(page, plan));
        output.files.push(this.generatePageLayout(page));

        // Generate components for this page
        for (const componentName of page.components) {
          output.files.push(this.generateComponent(componentName, page, plan));
        }
      }

      // 5. Generate hooks
      for (const hookName of plan.frontend.hooks) {
        output.files.push(this.generateHook(hookName, plan));
      }

      // 6. Generate UI library (shadcn)
      for (const uiComponent of SHADCN_COMPONENTS) {
        output.files.push(this.generateShadcnComponent(uiComponent));
      }

      // 7. Generate config files
      output.files.push(this.generateNextConfig(plan));
      output.files.push(this.generateTailwindConfig(plan));
      output.files.push(this.generateTsConfig(plan));
      output.files.push(this.generatePackageJson(plan));

      // Hash artifacts
      for (const file of output.files) {
        output.artifacts[file.path] = this.sha256(file.content);
      }

      output.logs.push(
        `✓ FrontendAgent generated ${output.files.length} files`
      );

    } catch (error) {
      output.errors.push(`FrontendAgent failed: ${error.message}`);
    }

    return output;
  }

  async validate(output: GenerateOutput): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      metrics: { linesOfCode: 0, testCoverage: 0, typeCheckErrors: 0 },
    };

    try {
      // 1. TypeScript compile
      const tsErrors = await this.runTypeScript();
      if (tsErrors.length > 0) {
        result.passed = false;
        result.errors.push(...tsErrors.map(e => ({
          code: 'TS_ERROR',
          message: e.message,
          filePath: e.file,
          line: e.line,
        })));
      }

      // 2. Next.js build
      const buildErrors = await this.runNextBuild();
      if (buildErrors.length > 0) {
        result.passed = false;
        result.errors.push(...buildErrors);
      }

      // 3. ESLint
      const lintErrors = await this.runEslint();
      result.warnings.push(...lintErrors.map(e => ({
        code: 'LINT_WARNING',
        message: e.message,
        filePath: e.file,
        severity: 'low',
      })));

    } catch (error) {
      result.errors.push({
        code: 'VALIDATION_ERROR',
        message: error.message,
        filePath: 'src/',
      });
      result.passed = false;
    }

    return result;
  }

  // Helpers

  private generateRootLayout(plan: Plan): FileOutput {
    return {
      path: 'src/app/layout.tsx',
      content: `
import type { Metadata } from 'next';
import { WagmiProvider } from '@/components/providers/WagmiProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: '${plan.projectName}',
  description: '${plan.description}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <WagmiProvider>
          <ThemeProvider>
            <Header />
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
          </ThemeProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
`,
      protected: false,
    };
  }

  private generatePage(page: any, plan: Plan): FileOutput {
    const componentList = page.components
      .map(c => `<${c} />`)
      .join('\n    ');

    return {
      path: `src/app${page.path}/page.tsx`,
      content: `
'use client';

import { ${page.components.join(', ')} } from './components';

export default function ${page.title.replace(/\s+/g, '')}Page() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">${page.title}</h1>
      <p className="text-gray-600 mb-8">${page.description}</p>
      
      <div className="space-y-6">
        ${componentList}
      </div>
    </div>
  );
}
`,
      protected: false,
    };
  }

  private generateComponent(name: string, page: any, plan: Plan): FileOutput {
    return {
      path: `src/app${page.path}/components/${name}.tsx`,
      content: `
'use client';

export function ${name}() {
  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-semibold">${name}</h2>
      {/* TODO: Implement ${name} */}
    </div>
  );
}
`,
      protected: false,
    };
  }

  private generateHook(hookName: string, plan: Plan): FileOutput {
    return {
      path: `src/hooks/${hookName}.ts`,
      content: `
import { useCallback } from 'react';

export function ${hookName}() {
  // TODO: Implement ${hookName}
  const callback = useCallback(() => {
    // Hook logic
  }, []);

  return { callback };
}
`,
      protected: false,
    };
  }

  private generateGlobalsCss(): FileOutput {
    return {
      path: 'src/app/globals.css',
      content: `
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
`,
      protected: false,
    };
  }

  private generateWagmiProvider(plan: Plan): FileOutput {
    const chainConfigs = plan.chains
      .map(c => `
  {
    id: ${c.chainId},
    name: '${c.name}',
    nativeToken: '${c.nativeToken}',
    rpcUrls: {
      default: { http: [process.env.NEXT_PUBLIC_${c.rpcUrlEnv}!] },
    },
  }`)
      .join(',');

    return {
      path: 'src/components/providers/WagmiProvider.tsx',
      content: `
'use client';

import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const chains = [${chainConfigs}];

const { publicClient, webSocketPublicClient } = configureChains(
  chains,
  [publicProvider()]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
});

export function WagmiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiConfig config={config}>
      <RainbowKitProvider chains={chains}>
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
`,
      protected: false,
    };
  }

  private generateAAProvider(plan: Plan): FileOutput {
    if (!plan.frontend.web3.aa) {
      return {
        path: 'src/components/providers/AAProvider.tsx',
        content: '// AA not enabled',
        protected: true,
      };
    }

    return {
      path: 'src/components/providers/AAProvider.tsx',
      content: `
'use client';

import { AlchemyProvider } from '@alchemy/aa-core';

export function AAProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Configure Alchemy AA provider
  return <>{children}</>;
}
`,
      protected: false,
    };
  }

  private generateThemeProvider(): FileOutput {
    return {
      path: 'src/components/providers/ThemeProvider.tsx',
      content: `
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark">
      {children}
    </NextThemesProvider>
  );
}
`,
      protected: false,
    };
  }

  private generateHeader(plan: Plan): FileOutput {
    return {
      path: 'src/components/layout/Header.tsx',
      content: `
'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          ${plan.projectName}
        </Link>
        <nav className="flex gap-4">
          <Link href="/swap">Swap</Link>
          <Link href="/liquidity">Liquidity</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
`,
      protected: false,
    };
  }

  private generateSidebar(plan: Plan): FileOutput {
    return {
      path: 'src/components/layout/Sidebar.tsx',
      content: `
'use client';

export function Sidebar() {
  return (
    <aside className="w-64 border-r">
      {/* Sidebar content */}
    </aside>
  );
}
`,
      protected: false,
    };
  }

  private generateFooter(plan: Plan): FileOutput {
    return {
      path: 'src/components/layout/Footer.tsx',
      content: `
export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="container mx-auto text-center text-gray-600">
        <p>&copy; 2026 ${plan.projectName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
`,
      protected: false,
    };
  }

  private generatePageLayout(page: any): FileOutput {
    return {
      path: `src/app${page.path}/layout.tsx`,
      content: `
export default function ${page.title.replace(/\s+/g, '')}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
`,
      protected: false,
    };
  }

  private generateShadcnComponent(name: string): FileOutput {
    // Return skeleton shadcn component
    return {
      path: `src/components/ui/${name}.tsx`,
      content: `
// shadcn/ui component: ${name}
// TODO: Generate from shadcn template
`,
      protected: false,
    };
  }

  private generateNextConfig(plan: Plan): FileOutput {
    return {
      path: 'next.config.js',
      content: `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
`,
      protected: false,
    };
  }

  private generateTailwindConfig(plan: Plan): FileOutput {
    return {
      path: 'tailwind.config.js',
      content: `
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
      protected: false,
    };
  }

  private generateTsConfig(plan: Plan): FileOutput {
    return {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }],
      }, null, 2),
      protected: false,
    };
  }

  private generatePackageJson(plan: Plan): FileOutput {
    const deps: Record<string, string> = {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'typescript': '^5.0.0',
      'tailwindcss': '^3.3.0',
      'wagmi': '^1.0.0',
      '@rainbow-me/rainbowkit': '^0.12.0',
      'prisma': '^5.0.0',
      '@prisma/client': '^5.0.0',
    };

    if (plan.frontend.web3.aa === 'alchemy') {
      deps['@alchemy/aa-core'] = '^0.2.0';
    }

    return {
      path: 'package.json',
      content: JSON.stringify({
        name: plan.projectSlug,
        version: '0.1.0',
        private: true,
        scripts: {
          'dev': 'next dev',
          'build': 'next build',
          'start': 'next start',
          'lint': 'next lint',
        },
        dependencies: deps,
        devDependencies: {
          'eslint': '^8.0.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.0.0',
          'postcss': '^8.0.0',
        },
      }, null, 2),
      protected: false,
    };
  }

  private async runTypeScript() {
    return [];
  }

  private async runNextBuild() {
    return [];
  }

  private async runEslint() {
    return [];
  }

  private sha256(data: string): string {
    return '';
  }
}

const SHADCN_COMPONENTS = [
  'button',
  'input',
  'card',
  'dialog',
  'dropdown-menu',
  'spinner',
  'toast',
];
```

---

## QAAgent & Validation Gates

The **QAAgent** integrates all outputs and applies **production readiness checks**.

### Validation Flow

```typescript
// agents/QAAgent.ts
export class QAAgent implements Agent {
  name = 'QAAgent';
  version = '0.1.0';

  async generate(params: GenerateParams): Promise<GenerateOutput> {
    // QAAgent doesn't generate new files; it validates + fixes existing ones
    return { files: [], errors: [], warnings: [], logs: [], artifacts: {} };
  }

  async validate(allOutputs: {
    contracts: GenerateOutput;
    backend: GenerateOutput;
    frontend: GenerateOutput;
  }): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      metrics: {
        linesOfCode: 0,
        testCoverage: 0,
        typeCheckErrors: 0,
      },
    };

    try {
      // 1. Merge all files
      const allFiles = [
        ...allOutputs.contracts.files,
        ...allOutputs.backend.files,
        ...allOutputs.frontend.files,
      ];

      // 2. Check for conflicts
      const paths = new Set();
      for (const file of allFiles) {
        if (paths.has(file.path)) {
          result.errors.push({
            code: 'DUPLICATE_FILE',
            message: `Duplicate file: ${file.path}`,
            filePath: file.path,
          });
          result.passed = false;
        }
        paths.add(file.path);
      }

      // 3. Validate cross-layer consistency
      const validation = await this.validateConsistency(allFiles);
      if (!validation.passed) {
        result.passed = false;
        result.errors.push(...validation.errors);
      }

      // 4. Run security checks
      const securityIssues = await this.runSecurityChecks(allFiles);
      for (const issue of securityIssues) {
        if (issue.severity === 'high') {
          result.passed = false;
        }
        result.errors.push({
          code: 'SECURITY_ISSUE',
          message: issue.message,
          filePath: issue.filePath,
        });
      }

      // 5. Check environment variables
      const envIssues = await this.checkEnvironmentVariables(allFiles);
      result.warnings.push(...envIssues);

      // 6. Count metrics
      result.metrics.linesOfCode = allFiles.reduce(
        (sum, f) => sum + f.content.split('\n').length,
        0
      );

    } catch (error) {
      result.errors.push({
        code: 'QA_ERROR',
        message: error.message,
        filePath: '',
      });
      result.passed = false;
    }

    return result;
  }

  private async validateConsistency(
    files: FileOutput[]
  ): Promise<{ passed: boolean; errors: any[] }> {
    const errors: any[] = [];

    // 1. Check imports exist
    for (const file of files) {
      const importMatches = file.content.match(/import .+ from ['"]@\/[^'"]+['"]/g) || [];
      for (const match of importMatches) {
        const [, importPath] = match.match(/from ['"](.+)['"]/);
        const expected = `src/${importPath.replace('@/', '')}`;

        // Verify file exists
        if (!files.some(f => f.path.includes(expected))) {
          errors.push({
            code: 'MISSING_IMPORT',
            message: `Import not found: ${importPath}`,
            filePath: file.path,
          });
        }
      }
    }

    // 2. Check contract ABIs match
    const contractFiles = files.filter(f => f.path.includes('/src/') && f.path.endsWith('.sol'));
    const abiFiles = files.filter(f => f.path.includes('lib/contracts.ts'));

    // Verify all contracts have ABIs
    // ... validation logic

    return {
      passed: errors.length === 0,
      errors,
    };
  }

  private async runSecurityChecks(files: FileOutput[]): Promise<any[]> {
    const issues: any[] = [];

    for (const file of files) {
      // Check for secrets in code
      if (file.content.match(/(PRIVATE_KEY|SECRET|PASSWORD)=/)) {
        issues.push({
          severity: 'high',
          message: 'Hardcoded secret detected',
          filePath: file.path,
        });
      }

      // Check for unsafe operations
      if (file.content.includes('eval(') || file.content.includes('dangerouslySetInnerHTML')) {
        issues.push({
          severity: 'high',
          message: 'Unsafe operation detected',
          filePath: file.path,
        });
      }
    }

    return issues;
  }

  private async checkEnvironmentVariables(files: FileOutput[]): Promise<any[]> {
    const warnings: any[] = [];

    // Collect all env var references
    const envVarPattern = /process\.env\.([A-Z_]+)/g;
    const envVars = new Set<string>();

    for (const file of files) {
      let match;
      while ((match = envVarPattern.exec(file.content)) !== null) {
        envVars.add(match[1]);
      }
    }

    // Check against .env.example
    const envExample = files.find(f => f.path === '.env.local.example');
    if (envExample) {
      for (const envVar of envVars) {
        if (!envExample.content.includes(envVar)) {
          warnings.push({
            code: 'MISSING_ENV_VAR',
            message: `Environment variable ${envVar} not in .env.example`,
            filePath: '.env.local.example',
            severity: 'medium',
          });
        }
      }
    }

    return warnings;
  }
}
```

---

## Sub-Agent Orchestration

The **HyperAgentOrchestrator** coordinates all sub-agents:

```typescript
// orchestration/HyperAgentOrchestrator.ts
export class HyperAgentOrchestrator {
  private plannerAgent = new PlannerAgent();
  private contractAgent = new ContractAgent();
  private backendAgent = new BackendAgent();
  private frontendAgent = new FrontendAgent();
  private qaAgent = new QAAgent();

  async generate(userPrompt: string): Promise<{
    plan: Plan;
    outputs: {
      contracts: GenerateOutput;
      backend: GenerateOutput;
      frontend: GenerateOutput;
    };
    validation: ValidationResult;
    projectPath: string;
  }> {
    console.log(`🚀 Generating project from prompt: "${userPrompt}"`);

    // 1. PlannerAgent: Generate plan
    console.log('📋 PlannerAgent: Creating project plan...');
    const plan = await this.plannerAgent.createPlan(userPrompt);
    console.log(`✓ Plan created: ${plan.projectId}`);

    const projectPath = `/tmp/${plan.projectSlug}`;

    // 2. Parallel: ContractAgent, BackendAgent, FrontendAgent
    console.log('⚙️  Sub-agents running...');
    const [contractsOutput, backendOutput, frontendOutput] = await Promise.all([
      (async () => {
        console.log('🔧 ContractAgent: Generating contracts...');
        const output = await this.contractAgent.generate({ plan, projectPath });
        console.log(`✓ Contracts generated: ${output.files.length} files`);
        return output;
      })(),

      (async () => {
        console.log('🔧 BackendAgent: Generating backend...');
        const output = await this.backendAgent.generate({ plan, projectPath });
        console.log(`✓ Backend generated: ${output.files.length} files`);
        return output;
      })(),

      (async () => {
        console.log('🔧 FrontendAgent: Generating frontend...');
        const output = await this.frontendAgent.generate({ plan, projectPath });
        console.log(`✓ Frontend generated: ${output.files.length} files`);
        return output;
      })(),
    ]);

    // 3. Write all files to disk
    console.log('💾 Writing files to disk...');
    await this.writeFilesToDisk(projectPath, [
      ...contractsOutput.files,
      ...backendOutput.files,
      ...frontendOutput.files,
    ]);

    // 4. QAAgent: Validate everything
    console.log('✅ QAAgent: Running validation...');
    const validation = await this.qaAgent.validate({
      contracts: contractsOutput,
      backend: backendOutput,
      frontend: frontendOutput,
    });

    if (!validation.passed) {
      console.error('❌ Validation failed:');
      for (const error of validation.errors) {
        console.error(`  - ${error.code}: ${error.message}`);
      }
      throw new Error('Project generation failed validation');
    }

    console.log('✅ Project generated successfully!');
    console.log(`📁 Location: ${projectPath}`);
    console.log(`📊 Metrics: ${validation.metrics.linesOfCode} LOC`);

    return {
      plan,
      outputs: {
        contracts: contractsOutput,
        backend: backendOutput,
        frontend: frontendOutput,
      },
      validation,
      projectPath,
    };
  }

  private async writeFilesToDisk(basePath: string, files: FileOutput[]) {
    for (const file of files) {
      const fullPath = path.join(basePath, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf-8');
    }
  }
}
```

---

## End-to-End Flow

**CLI entry point:**

```bash
$ npx hyperkit create dex --chain mantle,skale --auth email --payments x402
```

**Flow:**

```
User input
    ↓
PlannerAgent.createPlan(prompt)
    ↓ (Plan JSON created)
    ├─→ ContractAgent.generate(plan)
    ├─→ BackendAgent.generate(plan)
    └─→ FrontendAgent.generate(plan)
    ↓ (Files generated in parallel)
Write to disk: /tmp/dex-1234/
    ↓
QAAgent.validate(all outputs)
    ├─→ Type-check
    ├─→ Build
    ├─→ Test
    ├─→ Security scan
    └─→ Env validation
    ↓
✅ Success:
  - Clone repo & set .env
  - npm run deploy:mantle && npm run deploy:skale
  - npm run dev
```

---

## MVP Checklist (Feb 7, 2026)

- [ ] **PlannerAgent** spec complete + basic tests
- [ ] **ContractAgent** generates Foundry projects + ABIs
- [ ] **BackendAgent** generates Next.js API routes + Prisma
- [ ] **FrontendAgent** generates React pages + hooks
- [ ] **QAAgent** runs build + tests + security checks
- [ ] **Orchestrator** wires all agents together
- [ ] CLI: `npx hyperkit create` works end-to-end
- [ ] Generated project runs locally (testnet)
- [ ] Deployment scripts work (DeploySkale.s.sol, DeployMantle.s.sol)
- [ ] Documentation: ARCHITECTURE.md, DEPLOYMENT.md, x402-FLOW.md
- [ ] E2E test: Generate DEX → Deploy to testnet → Swap works

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Lines of generated code (per project) | 5,000–10,000 |
| Generation time | < 30 seconds |
| Validation pass rate | 95%+ |
| User can deploy generated code immediately | 100% |
| Zero hardcoded secrets in output | 100% |
| TypeScript strict mode passing | 100% |
| Test coverage for contracts | 80%+ |
| Production-ready defaults | 100% |

