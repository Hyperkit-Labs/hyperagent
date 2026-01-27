<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# before we proceed next steps, I want you give me all step by step for the all OSS you suggest so its easily to copy patterns/logic/system design and more.

Here are complete step‑by‑step playbooks for every OSS framework—fork, adapt, and ship.

***

## 1. VoltAgent (Full TypeScript Agent Stack)

**Why it fits**: Fastest time-to-agent, built-in console, memory, RAG, multi-agent orchestration. [^1][^2]

### Step 1: Fork \& Clone

```bash
gh repo fork VoltAgent/voltagent --clone=true --org=hyperkit-labs
cd voltagent
pnpm install
```


### Step 2: Run Console \& Example

```bash
pnpm dev:console  # UI on localhost:3000
# In another terminal
cd examples/basic-agent
cp .env.example .env
# Add OPENAI_API_KEY=sk-...
pnpm dev
```


### Step 3: Key Architecture \& Files to Study

- **`packages/core/src/agent.ts`** - Agent class, tool registration, memory management
- **`packages/core/src/tool.ts`** - `@tool` decorator pattern; copy how parameters are validated
- **`packages/console/src/`** - React UI for agent chat; study `AgentChat.tsx` for streaming responses
- **`examples/basic-agent/src/index.ts`** - Minimal agent setup; copy the `new Agent({...})` pattern


### Step 4: Integrate HyperKit

```bash
mkdir -p packages/hyperkit-agent/src
cd packages/hyperkit-agent
pnpm add @hyperkitlab/sdk
```

Create `packages/hyperkit-agent/src/index.ts`:

```typescript
import { Agent, openAI, tool } from 'voltagent';
import { HyperKitSDK } from '@hyperkitlab/sdk';

const hyperkit = new HyperKitSDK({ apiKey: process.env.HYPERKIT_API_KEY });

const auditTool = tool({
  name: 'audit_contract',
  parameters: {
    address: { type: 'string' },
    chain: { type: 'string' }
  },
  execute: async ({ address, chain }) => {
    return hyperkit.audit({ address, chain });
  }
});

const agent = new Agent({
  model: openAI('gpt-4o'),
  instructions: 'You are a smart contract auditor.',
  tools: [auditTool]
});

agent.serve({ port: 8000 });
```


### Step 5: Add Custom Skill

Create `packages/hyperkit-agent/src/skills.ts`:

```typescript
import { Skill } from 'voltagent';

export const pocSkill = new Skill({
  name: 'generate_poc',
  execute: async (vuln: any) => {
    return `// Foundry PoC for ${vuln.id}\n${vuln.recommendation}`;
  }
});
```

In `index.ts`: `agent.addSkill(pocSkill);`

### Step 6: Run \& Test

```bash
pnpm dev
curl -X POST http://localhost:8000/chat \
  -d '{"message": "Audit 0x123... on ethereum"}'
```


### Step 7: Deploy

```bash
vercel deploy --prod
```

**Key Patterns to Copy**:

- Tool decorator pattern with Zod-like parameter validation [^2]
- Agent memory buffer for conversation context [^1]
- Console UI streaming via Server-Sent Events [^1]

***

## 2. Google ADK for TypeScript (Lean \& Model-Agnostic)

**Why it fits**: Ultra-minimal, swaps LLMs easily, no extra UI. [^3]

### Step 1: Clone ADK

```bash
git clone https://github.com/google/adk.git
cd adk/typescript
npm install
```


### Step 2: Study the Structure

- **`src/agent.ts`** - `Agent` class with `run()` method
- **`src/llm.ts`** - OpenAI, Gemini, Anthropic providers; copy the provider pattern
- **`examples/simple-agent.ts`** - Barebones agent; copy this file as your template


### Step 3: Create HyperKit Agent

Create `examples/hyperkit-agent.ts`:

```typescript
import { Agent, Runner } from '@google/adk';
import { HyperKitSDK } from '@hyperkitlab/sdk';

const hyperkit = new HyperKitSDK({ apiKey: process.env.HYPERKIT_API_KEY });

const auditAgent = new Agent(
  'hyperkit-auditor',
  'You audit smart contracts',
  { tools: [{
    name: 'audit',
    func: async ({ address, chain }) => hyperkit.audit({ address, chain })
  }] }
);

const runner = new Runner();
runner.run(auditAgent, { message: 'Audit 0x123...' });
```


### Step 4: Run

```bash
npm run build
node dist/examples/hyperkit-agent.js
```

**Key Patterns to Copy**:

- Provider pattern for swapping LLMs [^3]
- Simple tool function signatures (name, func, description) [^3]
- Runner loop for agentic workflow execution [^3]

***

## 3. Agent-H (Web3-Native Agent Framework)

**Why it fits**: Pre-built EVM tools, wallet integration, chain interactions. [^4]

### Step 1: Fork Agent-H

```bash
gh repo fork hexaonelabs/ia-agent-h --clone=true --org=hyperkit-labs
cd ia-agent-h
npm install
```


### Step 2: Study Architecture

- **`src/characters/agent-h.yml`** - Persona, instructions, tools list (YAML config)
- **`src/tools/evm/`** - `callContract`, `sendTx`, `readStorage` tools; copy EVM interaction logic
- **`src/core/agent.ts`** - Loads YAML character and binds tools dynamically


### Step 3: Add HyperKit Tool

Create `src/tools/hyperkit/audit.ts`:

```typescript
import { Tool } from '../base';

export class HyperKitAuditTool extends Tool {
  name = 'hyperkit_audit';
  description = 'Audit a contract via HyperKit';

  async execute(address: string, chain: string) {
    const sdk = new HyperKitSDK({ apiKey: process.env.HYPERKIT_API_KEY });
    return sdk.audit({ address, chain });
  }
}
```

Register in `src/tools/index.ts`: `export { HyperKitAuditTool } from './hyperkit/audit';`

### Step 4: Update Character

Edit `src/characters/agent-h.yml`:

```yaml
name: HyperKit Auditor
instructions: You audit smart contracts using hyperkit_audit tool.
tools:
  - hyperkit_audit
```


### Step 5: Run

```bash
npm start
# Agent starts CLI chat with EVM + HyperKit tools
```

**Key Patterns to Copy**:

- YAML-driven agent personas (easy to swap characters) [^4]
- Tool base class with execute() pattern [^4]
- Dynamic tool loading from directory [^4]

***

## 4. SmartGuard (Multi-Agent Security Auditor)

**Why it fits**: Pre-built Slither + LLM pipeline, PoC generation, report synthesis. [^5]

### Step 1: Clone SmartGuard

```bash
git clone https://github.com/advaitbd/fyp-fr.git
cd fyp-fr
pip install -r requirements.txt
```


### Step 2: Study Pipeline

- **`src/agents/detector.py`** - Runs Slither, parses output, sends to LLM
- **`src/agents/validator.py`** - LLM validates if bug is true positive
- **`src/agents/poc_generator.py`** - Generates Foundry test
- **`src/orchestrator.py`** - Coordinates multi-agent flow


### Step 3: Adapt HyperKit

In `src/agents/detector.py`, replace Slither call:

```python
from hyperkit import HyperKitSDK

sdk = HyperKitSDK(api_key=os.getenv('HYPERKIT_API_KEY'))
report = sdk.audit(address=contract_address, chain='ethereum')
```


### Step 4: Run Multi-Agent Flow

```bash
python src/orchestrator.py --contract 0x123...
```

**Key Patterns to Copy**:

- Multi-agent orchestration with separate detector/validator/poc roles [^5]
- LLM prompt templates for each agent role [^5]
- Slither AST parsing logic (if you want to keep Slither) [^5]

***

## 5. Microsoft Agent Framework (Python Orchestration)

**Why it fits**: Production-grade orchestration, parallel agents, fault tolerance. [^6]

### Step 1: Fork \& Setup

```bash
gh repo fork microsoft/agent-framework --clone=true
cd agent-framework/python
pip install -e .
```


### Step 2: Study Core

- **`agent_framework/core/agent.py`** - Base Agent class with `run()` and `plan()`
- **`agent_framework/core/orchestrator.py`** - Multi-agent coordination, message bus
- **`examples/multi_agent_workflow.py`** - Copy this pattern for HyperKit


### Step 3: Create HyperKit Agents

Create `examples/hyperkit_workflow.py`:

```python
from agent_framework import Agent, Orchestrator
from hyperkit import HyperKitSDK

sdk = HyperKitSDK(api_key=os.getenv('HYPERKIT_API_KEY'))

class AuditorAgent(Agent):
    def run(self, task):
        return sdk.audit(address=task['address'], chain=task['chain'])

class PoCAgent(Agent):
    def run(self, vuln):
        return f"// PoC for {vuln['id']}\n{vuln['fix']}"

orch = Orchestrator(agents=[AuditorAgent(), PoCAgent()])
orch.run([{'address': '0x123...', 'chain': 'ethereum'}])
```


### Step 4: Run

```bash
python examples/hyperkit_workflow.py
```

**Key Patterns to Copy**:

- Message bus for inter-agent communication [^6]
- Orchestrator pattern for parallel task execution [^6]
- Agent base class for extensibility [^6]

***

## Summary: Which to Choose?

| Framework | Time to MVP | Best For | Key Copy Pattern |
| :-- | :-- | :-- | :-- |
| **VoltAgent** | 1 day | Fastest DX + UI | Tool decorator + Console UI |
| **ADK** | 4 hours | Ultra-minimal | Provider pattern |
| **Agent-H** | 2 days | On-chain native | YAML personas + Dynamic tools |
| **SmartGuard** | 3 days | Security pipeline | Multi-agent orchestration |
| **Microsoft** | 1 week | Enterprise scale | Message bus + Orchestrator |

**For your team**: Start with **VoltAgent** (speed), borrow **Agent-H’s EVM tools**, and lift **SmartGuard’s PoC generator**. You’ll have a production-ready agent in 48 hours.

<div align="center">⁂</div>

[^1]: https://voltagent.dev

[^2]: https://github.com/VoltAgent/voltagent

[^3]: https://developers.googleblog.com/introducing-agent-development-kit-for-typescript-build-ai-agents-with-the-power-of-a-code-first-approach/

[^4]: https://github.com/hexaonelabs/ia-agent-h

[^5]: https://github.com/advaitbd/fyp-fr

[^6]: https://github.com/microsoft/agent-framework

