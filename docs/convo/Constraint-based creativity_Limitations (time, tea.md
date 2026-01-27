<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Constraint-based creativity

Limitations (time, team size, expertise) force focus.

you know our team too is tiny couldn't build agent from scratch, so what OSS should can ee forked or clone to be stepping stone that giving our team momentum and fast deliver.

For a tiny team, the winning move is **not** to build an agent framework from scratch but to **fork a TypeScript-native, open-source agent framework** and immediately focus on the unique value: your smart contract skills and Web3-specific tooling. [^1][^2][^3]

Here are the best stepping stones, ranked by how fast they’ll give you momentum:

***

## Top Recommendation: **VoltAgent**

**Why it fits your team:**

- Pure TypeScript, open-source (MIT), designed for fast iteration [^1][^3]
- Built-in **LLM observability, memory, RAG, and multi-agent orchestration** out of the box—so you skip months of infra work [^1]
- Comes with a **VoltOps Console** (cloud or self-hosted) that gives you a UI to monitor agents, manage prompts, and debug workflows without building your own dashboard [^1]
- Agent delegation pattern lets you spin up specialized agents (e.g., “Solidity Auditor Agent,” “Deployment Agent”) that collaborate under a supervisor [^3]

**Fastest path:**

1. Fork `VoltAgent/voltagent` [^3]
2. In `agent.ts`, add your first custom tool: a wrapper around `slither` or `foundry` that runs static analysis on a contract.
3. Deploy the console locally; you now have a working agent that can “audit” contracts via chat.
4. Ship the console URL to a few trusted devs; iteration becomes configuration, not code.

***

## Alternative: **Google Agent Development Kit (ADK) for TypeScript**

**Why it fits:**

- Google’s official, open-source, code-first framework [^2]
- Model-agnostic (Gemini, OpenAI, Anthropic) with built-in tool-use patterns [^2]
- Extremely lean: define an agent in ~10 lines; perfect for a tiny team that wants to stay agile [^2]

**Fastest path:**

1. Clone the ADK repo and run the quickstart. [^2]
2. Replace the example tool with a `callHyperKitSDK` function that your agent can invoke.
3. Use ADK’s native **workflow** primitives to chain: fetch contract → run static analysis → generate PoC → simulate.
4. Deploy as a simple Node service; you have an API endpoint that executes agentic audits.

***

## Web3-Specific Fork: **Agent-H (hexaonelabs/ia-agent-h)**

**Why it fits:**

- NodeJS framework **with blockchain integration built-in** (EVM interactions, wallet signing, direct chain reads) [^4]
- Modular architecture: you add tools by writing simple config files, not rebuilding core logic [^4]
- Already has examples for on-chain agents; you can literally fork and replace their “character” YAML with your Solidity auditor persona. [^4]

**Fastest path:**

1. Fork `hexaonelabs/ia-agent-h` [^4]
2. In `characters/agent-h.yml`, set instructions: “You are a smart contract security agent. Use HyperKit SDK tools to analyze and report.”
3. Add your HyperKit SDK as a tool in the `tools/` folder (just a wrapper that calls your existing code).
4. Run `npm start`; you now have a CLI agent that can audit contracts on Ethereum, BSC, Base, etc., out of the box.

***

## Security-Specific: **SmartGuard (advaitbd/fyp-fr)**

**Why it fits:**

- **Multi-agent LLM workflow *explicitly for smart contract auditing*** [^5]
- Uses Slither for static analysis, then coordinates specialized agents (detector, validator, PoC generator) [^5]
- Generates Foundry-based proof-of-concept tests automatically [^5]

**Fastest path:**

1. Fork `advaitbd/fyp-fr` (SmartGuard) [^5]
2. Rip out their LLM calls and wire in your preferred models (OpenAI, Anthropic) via a simple.env config.
3. Replace the “detector agent” logic with your own vulnerability patterns or HyperKit rules.
4. You instantly have a working pipeline: `contract → Slither → multi-agent analysis → PoC → report`.

***

## Orchestration Layer (if you outgrow single agents): **Microsoft Agent Framework**

**Why it fits:**

- Supports both Python and .NET; you can use Python for heavy analysis (Slither, symbolic execution) and TypeScript for the agent orchestration [^6]
- Graph-based workflow orchestration for multi-hop, multi-tool plans [^6]
- Battle-tested by Microsoft; you inherit robust error handling and parallel execution patterns [^6]

**Fastest path:**

1. Fork `microsoft/agent-framework` Python SDK. [^6]
2. Keep the planner/executor pattern; swap in your HyperKit tools as “tools” in the graph.
3. Deploy as a microservice; your front-end (or VoltAgent console) calls it for heavy analysis.

***

## Decision matrix for your team

| Framework | Setup Time | Agent Ready | Web3 Native | Built-in UI | Best For |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **VoltAgent** | 1–2 days | ✅ Yes | ❌ No (add yourself) | ✅ Yes | Fast DX + observability |
| **ADK** | 1 day | ✅ Yes | ❌ No (add yourself) | ❌ No | Lean, model-agnostic |
| **Agent-H** | 2–3 days | ✅ Yes | ✅ Yes (EVM tools) | ❌ No | On-chain agents |
| **SmartGuard** | 3–5 days | ✅ Yes | ✅ Yes (Solidity) | ✅ Yes (Web UI) | Security focus |
| **Microsoft Agent Framework** | 1 week | ⚠️ Complex | ❌ No (orchestration only) | ❌ No | Multi-agent workflows |


***

## Recommended strategy for your tiny team

1. **Start with VoltAgent** (fastest time-to-agent, built-in console saves you from building a dashboard). [^1][^3]
2. **Add Agent-H’s blockchain tools** as custom plugins (copy their EVM interaction code). [^4]
3. **Lift SmartGuard’s Slither + PoC pipeline** and wrap it as a VoltAgent tool. [^5]
4. **Ship a single command** (e.g., `npx hyperkit-agent audit <contract-address>`) that spins up the agent, runs the pipeline, and spits out a report.

You’ll have a working, demoable AI agent in **under a week** without building core orchestration, memory, or UI from scratch. The rest of your time goes into the unique value: HyperKit-specific rules, better PoC generation, and Web3-native UX.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://voltagent.dev

[^2]: https://developers.googleblog.com/introducing-agent-development-kit-for-typescript-build-ai-agents-with-the-power-of-a-code-first-approach/

[^3]: https://github.com/VoltAgent/voltagent

[^4]: https://github.com/hexaonelabs/ia-agent-h

[^5]: https://github.com/advaitbd/fyp-fr

[^6]: https://github.com/microsoft/agent-framework

[^7]: https://github.com/topics/ai-agents?l=typescript

[^8]: https://github.com/microsoft/agent-lightning

[^9]: https://mastra.ai

[^10]: https://github.com/topics/smart-contract-security?l=python\&o=desc\&s=updated

[^11]: https://github.com/topics/blockchain-ai-agent

[^12]: https://github.com/Snowflake-Labs/orchestration-framework

[^13]: https://github.com/bytedance/UI-TARS-desktop

[^14]: https://github.com/l33tdawg/aether

[^15]: https://github.com/autonomys/autonomys-agents

