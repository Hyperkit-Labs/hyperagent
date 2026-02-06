# Hyperagent in 60 seconds

## **Hyperagent in 60 Seconds**

## **What Hyperagent Is**

Hyperagent is an AI-powered smart contract platform that turns natural-language specs into production‑ready, audited contracts and deployments across multiple EVM chains in minutes, not weeks.​

It orchestrates a system of specialized agents spec, design, generation, audit, test, and deploy on top of a microservice architecture with strong observability, security tooling, and multi‑chain adapters.​

* Who it’s for (Protocol teams, auditors, L1/L2 ecosystems).  
* What it does (AI → spec → code → audit → deploy, verifiable, multi‑chain).  
* Why it’s different (ERC‑8004 \+ EigenDA provenance, agent-first, not just Copilot).

---

## **Who It’s For**

* Protocol / dApp founders (e.g., BNB DeFi, Mantle RWA, Avax games)  
  “Describe the system you want, pick a chain, and get a production‑grade, audited contract and deployment pipeline in days instead of weeks without stitching together 10 different tools.”​  
* Smart contract developers & teams  
  “Use Hyperagent as your AI co‑engineer: it handles spec, codegen, audits, and deployments across multiple EVM chains, while you stay in control of reviews and final decisions.”​  
* Security auditors & audit firms  
  “Plug into a standardized pipeline where every run comes with full traces, tool outputs (Slither/Mythril/Echidna, Tenderly), and reproducible environments, so you spend time on real edge cases instead of boilerplate checks.”​  
* L1/L2 & ecosystem teams (Mantle, BNB, Avalanche, SKALE, Protocol Labs, Solana)  
  “Offer builders a ready‑made, safer launchpad: chain‑specific blueprints, multi‑chain deployment, and on‑chain provenance (ERC‑8004 \+ EigenDA) that increase TVL without increasing your incident surface.”​  
* AI agent / infra builders  
  “Treat Hyperagent as infra for your agents: ERC‑8004 identities, registries, and verifiable pipelines so agents can safely propose, deploy, and monitor on‑chain systems with accountability.”​

Offer builders a standard, safer way to design, audit, and deploy contracts on your chain, with on‑chain provenance and metrics.​  
---

## **Why It’s Different**

* End‑to‑end, not just Copilot – from idea → spec → architecture → code → automated audit → Tenderly sims → deployment → monitoring, all orchestrated by agents.​  
* Verifiable by design – contracts, specs, and audit results are versioned, traceable, and designed to be anchored to DA layers like EigenDA and on‑chain registries (ERC‑8004).​  
* Multi‑chain from day one – adapters for Mantle, Avalanche, SKALE, BNB, Arbitrum and more, reusing the same agentic pipeline per chain.​  
* Agent‑native infra – built around A2A (Agent‑to‑Agent) protocol and ERC‑8004 Trustless Agents, so AI agents can identify themselves, build reputation, and operate safely on‑chain.​

---

## **How It Works (High Level)**

1. Spec & Design – User describes desired behavior in natural language; Spec/Design agents refine requirements and propose architectures.​  
2. Generate & Test – CodeGen agents use RAG (Solidity best practices, templates, prior audits) plus composite models (OpenAI/Anthropic for reasoning, Gemini for quick edits) to generate contracts and tests.​  
3. Audit & Simulate – Security agents run Slither, Mythril, MythX, Echidna, then verify behavior via Tenderly simulations; risky outputs are looped back for fixes or human review.​  
4. Compile & Deploy – Deploy agents use Hardhat/Foundry and Thirdweb (ERC‑4337 AA, EIP‑7702) to ship contracts to target networks, record metadata in registries, and configure monitoring.​  
5. Monitor & Learn – OpenTelemetry, MLflow, Dune, and Tenderly provide runtime metrics; traces and incidents feed back to improve prompts, templates, and autofixers.​

---

## **Architecture at a Glance**

* Backend: Python \+ FastAPI, LangGraph orchestration, Redis queues, Dockerized microservices.​  
* Frontend & SDKs: Next.js/React/TypeScript, Tailwind, TS SDK \+ planned CLI (hyperagent init/run/deploy).​  
* Data & Memory: Supabase (Postgres), VectorDB (e.g., Pinecone), Acontext for long‑term memory, IPFS/Arweave/Filecoin for artefacts.​  
* Security & Observability: Slither/Mythril/MythX/Echidna, Tenderly, OpenTelemetry, MLflow, Dune Analytics.​

---

## **Roadmap Snapshot**

| Phase | When | Focus | Key Outcomes |
| :---- | :---- | :---- | :---- |
| 1 – Foundation | [Q1 2026]() | Core SDK \+ AI assistant \+ hackathon presets (Mantle, BNB, Avax, SKALE, PL) | Multi-chain MVP live |
| 2 – Acceleration | [Q2 2026]() | Blueprints, self‑serve, 500 devs / 50 dApps | Product, not project |
| 3 – Scale & Decentralize | [Q3 2026]() | Enterprise dashboards, $5M TVL, registries \+ EigenDA | Trusted infra |
| 4 – Agent Economy | [Q3-Q4 2026]() | ERC‑8004 agent registry, marketplace, x402 payments | Agents using Hyperagent |
| 5 – Verifiable Mode | [H2 2027]() | Attestations \+ ZK/AVS for high‑value flows | Cryptographic trust |
| 6 – Global Standard | [H1 2027]() | Open protocol, decentralized operators, regulated‑grade | Default standard |

* [Phase 1 – Foundation (Q1 2026): Core SDK \+ AI assistant, multi‑chain MVP and hackathon presets live]().​  
* [Phase 2 – Acceleration (Q2 2026): Blueprint library, self‑serve onboarding, 500+ devs / 50+ dApps targets.​]()  
* [Phase 3 – Scale & Decentralize (Q3–Q4 2026): Enterprise features, monitoring dashboards, ERC‑8004 registries, EigenDA provenance.​]()  
* [Later Phases: Agent marketplace, decentralized operators, deep ZK/AVS verification, Solana/Mobile support, and eventually a fully open Hyperagent protocol.​]()

# Project Details

## **1\) Internal Technical [Spec]() Outline**

## **1\. Overview**

HyperAgent is an AI-powered smart contract development platform that takes natural language specifications and produces production-ready, audited contracts in minutes. It orchestrates a system of specialized agents that handle specification, design, generation, auditing, testing, and deployment across multiple EVM networks.​

The system is built as a microservice and SOA-based architecture where each service and agent is independently deployable and communicates via stable APIs and an Agent2Agent (A2A) protocol. This enables us to evolve individual components (e.g., RAG backends, model providers, deployment adapters) without breaking the rest of the system.​

---

## **2\. Goals and Non‑Goals**

HyperAgent’s primary goal is to make end‑to‑end smart contract development verifiable, repeatable, and safe by combining LLM-based generation with formal and empirical security checks. We want a developer to go from “idea in English” to “deployed and monitored contract on Mantle/Arbitrum/etc.” with as few manual steps as possible, while preserving auditability and human oversight where needed.​

Non‑goals for v1 include building a general-purpose IDE or replacing human auditors entirely. Instead, HyperAgent aims to automate the boring, repeatable parts of the pipeline and provide auditors and protocol teams with richer telemetry, reproducible runs, and higher quality candidate implementations.​

---

## **3\. High-Level Architecture**

HyperAgent follows a microservices and service-oriented architecture: core services expose HTTP/gRPC APIs, and agents communicate over an A2A protocol with an ERC‑8004-based on-chain registry for identity, reputation, and validation metadata. The main components are: frontend (Next.js/React), orchestration and agent runtime (Python/FastAPI), storage and memory (Supabase, VectorDB, Acontext, Redis), and blockchain integration services.​

Data and artifacts flow through the system as versioned “project” objects. Each project aggregates user prompts, internal agent messages, intermediate code artifacts, security reports, and final deployment metadata, with identifiers that can be anchored to on-chain events or data availability layers such as EigenDA.​

---

## **4\. Agent Model and Workflows**

HyperAgent implements a composite, multi-agent model instead of a monolithic “one brain.” Specialized agents handle stages such as Think, Discussion, Planning, System Design, Proposal, Generate, Audit, Test (Interact), Compile, and Deploy. Each agent has a well-defined contract: required inputs, tools it can call (e.g., code sandboxes, security analyzers, blockchain RPCs), and structured outputs.​

Routing between agents is handled via a central orchestration layer built with LangGraph and custom logic. Prompt routing ensures that complex reasoning or design tasks are sent to higher-capability models (e.g., OpenAI, Anthropic), while faster “Quick Edit” tasks use cheaper models such as Gemini, minimizing latency and cost while preserving quality.​

---

## **5\. Tech Stack and Services**

The orchestration and agent runtime is implemented in Python using FastAPI, with virtual environments for isolation and reproducibility of dependencies. Frontend experiences, including project workflows and dashboards, are built with Next.js, React, Tailwind, and TypeScript to ensure type-safe integration with backend APIs and SDKs.​

Core data services include Supabase (PostgreSQL) for relational data, a VectorDB (e.g., Pinecone) for embeddings and RAG retrieval, Redis for high-performance caching and message brokering, and Acontext for long-term agent memory. Docker and Docker Compose are used to containerize services and define multi-container development and deployment environments.​

---

## **6\. Smart Contract and Blockchain Integration**

HyperAgent integrates with standard Ethereum development frameworks (Hardhat, Foundry, Brownie, Truffle, Vyper) to generate, test, and compile smart contracts. It supports multiple networks Mantle, Avalanche, SKALE, BNB, Arbitrum, and other EVM-compatible chains through configurable RPC endpoints and deployment adapters.​

For wallets and account abstraction, HyperAgent uses the Thirdweb SDK to support ERC‑4337 AA wallets and EIP‑7702 EOAs. HyperAgent’s on-chain footprint includes deployed contracts, agent-related registries using ERC‑8004, and (optionally) on-chain or DA-layer commitments to agent traces and audits.​

---

## **7\. Data, Memory, and Retrieval (RAG)**

RAG is a first-class component: HyperAgent maintains specialized code and documentation corpora for Solidity frameworks, security best practices, and protocol-specific interfaces. These are embedded into a vector database, and the system retrieves relevant snippets and examples to ground LLM generations, reducing hallucinations and keeping outputs aligned with real-world patterns.​

Agent memory combines Acontext for long-term context management with Redis for low-latency working sets. IPFS/Pinata, Arweave, and Filecoin are used to persist critical artifacts (e.g., specs, audit reports, code versions) for long-term availability and verifiable reference outside the primary database.​

---

## **8\. Observability and Monitoring**

HyperAgent uses OpenTelemetry to instrument services and agents, generating metrics, logs, and traces for each project and agent run. MLflow is used to track model configurations, experiments, and performance metrics across different LLM providers and routing strategies.​

For on-chain behavior, Dune Analytics dashboards provide visibility into deployments, contract interactions, and usage patterns across supported networks. This observability layer is intended to evolve into a verifiability layer, where agent decisions and outputs can be anchored to on-chain events or DA blobs for later auditing.​

---

## **9\. Security Model and Tooling**

Security is enforced at multiple stages via automated analysis and testing. HyperAgent integrates tools such as Slither, Mythril, MythX, Echidna, and Tenderly to analyze generated contracts before any deployment step is triggered. Findings are surfaced back into the agent pipeline, allowing iterative refinement or requiring human approval for high-risk issues.​

The platform’s threat model covers unsafe code generation, compromised tool responses, and deployment misconfigurations. Over time, we plan to integrate additional mechanisms such as canary deployments, time-locked upgrades, and optional human-in-the-loop gating for high-value or high-risk deployments.​

---

## **10\. API, SDKs, and MCP**

HyperAgent exposes APIs for project creation, spec submission, pipeline execution, artifact retrieval, and deployment control. A TypeScript-based SDK provides ergonomic access to these APIs for Node.js and frontend applications, including integrations with x402 for payments and facilitators.​

The system also supports MCP (Model Context Protocol) to allow external tools and data sources to be plugged into agent contexts in a standardized way. A CLI (npm, TBD) is planned to support local developer workflows such as hyperagent init, hyperagent run, and hyperagent deploy.​

---

## **11\. Roadmap and Milestones**

The initial milestone focuses on single-project, multi-step pipelines targeting one or a few EVM chains with centralized orchestration. Subsequent milestones progressively introduce multi-chain deployment strategies, ERC‑8004 registries, more advanced observability, and optional verifiable execution layers (e.g., EigenDA/EigenCloud integration).​

Later phases will add mobile clients (React Native/Kotlin via Solana Mobile Stack), richer agent marketplaces, and potentially decentralized agent operators that can stake on their performance and reputation.​

---

## **2\) External Whitepaper / Investor Deck Outline**

## **1\. Vision**

HyperAgent is building the AI-native fabric for smart contract creation and governance: a system where autonomous agents can safely design, generate, audit, and deploy contracts across multiple chains, with verifiability baked in from day one.​

In a world where value is increasingly governed by code, HyperAgent’s mission is to turn “contract logic” into an intelligent, continuously improving system rather than static, one-off deployments. This unlocks faster innovation cycles, safer protocols, and radically lower development overhead.

---

## **2\. Problem**

Today, going from idea to production smart contract is slow, expensive, and error-prone. Teams bounce between specs, manual coding, inconsistent audits, and lengthy test cycles, while security issues and misconfigurations still regularly lead to catastrophic exploits.​

Existing AI codegen tools help with snippets, but they don’t understand full project workflows, security constraints, or the realities of multi-chain deployment. They operate as helpful assistants, not as accountable agents that can own and improve the entire lifecycle.

---

## **3\. Solution**

HyperAgent provides an end-to-end, agentic pipeline for smart contracts: from natural language requirements to deployed, monitored contracts, with each step handled by specialized AI agents supported by security tooling and best-practice RAG. The pipeline spans ideation, design, generation, automated audits, interactive testing, compilation, and deployment.​

Instead of a single black-box model, HyperAgent uses a composite architecture that routes tasks between different models and tools based on complexity, risk, and cost. Frontier models (OpenAI, Anthropic) handle complex reasoning, while faster models (Gemini) handle quick iterations, all within a controlled, observable framework.​

---

## **4\. Product**

The core product is a web platform and API where developers and teams can:

* Describe desired contract behavior in natural language  
* Review automatically generated architectures and proposals  
* Inspect and refine generated code and tests  
* Run automated audits and simulations  
* Deploy to their chosen networks and monitor usage.

Under the hood, HyperAgent orchestrates microservices, agents, and toolchains (Solidity frameworks, security analyzers, RAG knowledge bases, and chain adapters) so that users experience a clean, guided workflow instead of juggling dozens of tools.​

---

## **5\. Technology**

HyperAgent combines modern web and AI infrastructure: Python/FastAPI for orchestration, Next.js/React/TypeScript for the interface, Supabase and VectorDB for data and retrieval, Redis and Acontext for memory, and Docker for consistent deployment.​

On the blockchain side, HyperAgent integrates with major EVM networks (Mantle, Avalanche, SKALE, BNB, Arbitrum, Protocol Labs ecosystems) and uses frameworks like Hardhat and Foundry for build and test. It leverages Thirdweb for account abstraction and plans deeper integration with EigenDA and EigenCloud to make agent decisions and contract histories more verifiable over time.​

---

## **6\. Multi-Chain and Verifiability**

Multi-chain is a first-class design constraint: HyperAgent helps teams target the networks they care about while reusing specs, patterns, and pipelines across chains. The same agentic process can be reused to output chain-specific contract variants and deployment configurations.​

Over time, HyperAgent will anchor key artifacts (spec hashes, code versions, audit summaries) to on-chain registries and DA layers like EigenDA to provide cryptographic evidence that a given contract was produced and vetted by a specific HyperAgent pipeline. This opens the door to standardized reputations for agents and verifiable provenance for on-chain code.​

---

## **7\. Ecosystem and Standards**

HyperAgent builds on and contributes to standards such as A2A (Agent2Agent protocol) and ERC‑8004 (Trustless Agents), which define how autonomous agents identify themselves, build reputation, and validate behaviors on-chain.​

By adopting MCP and exposing APIs/SDKs, HyperAgent is designed to be part of a broader ecosystem of tools, agents, and platforms rather than a closed garden. This enables third-party agents, templates, and integrations to emerge around the core pipeline.​

---

## **8\. Business Model**

HyperAgent will offer a pay-as-you-go API and SaaS model, where teams pay for agent execution, compute-intensive steps (e.g., audits, simulations), and premium integrations. Usage-based billing aligns costs with value delivered and scales from solo builders to large protocol teams.​

Longer term, HyperAgent can support a marketplace for templates, agents, and audits, enabling revenue sharing with external contributors who create high-quality components and knowledge bases. This creates a network effect where more use-cases and patterns make the platform more valuable over time.

---

## **9\. Competitive Landscape**

Traditional IDEs, AI coding assistants, and standalone audit tools each solve parts of the pipeline but do not provide an integrated, verifiable, multi-agent workflow tailored for smart contracts. HyperAgent differentiates by owning the full lifecycle from idea to monitored deployment and by being opinionated about security and verifiability.​

As AI agents become more common in Web3, HyperAgent’s focus on on-chain standards, registries, and DA integration positions it as core infra rather than just another devtool. This creates defensibility through integrations, data, and standards adoption.

---

## **10\. Roadmap**

Near term, the focus is on a robust, delightful EVM pipeline: single-project workflows, strong RAG on Solidity/security knowledge, and tight integration with core dev frameworks and networks.​

Following that, we expand deeper into multi-chain orchestration, on-chain registries (ERC‑8004), richer observability, EigenDA/EigenCloud-backed verifiability, and eventually support for additional ecosystems (e.g., Solana, Move, Rust, Cadence) and mobile experiences via Solana Mobile Stack.​

# Spec

## **1\) Internal Technical Spec Outline**

## **1\. Overview**

HyperAgent is an AI-powered smart contract development platform that takes natural language specifications and produces production-ready, audited contracts in minutes. It orchestrates a system of specialized agents that handle specification, design, generation, auditing, testing, and deployment across multiple EVM networks.​

The system is built as a microservice and SOA-based architecture where each service and agent is independently deployable and communicates via stable APIs and an Agent2Agent (A2A) protocol. This enables us to evolve individual components (e.g., RAG backends, model providers, deployment adapters) without breaking the rest of the system.​

**Tech Stack:**  
**Python** \- Handles all Agentic task end to end workflow (FastAPI, Venv)  
**Typescript** \- Handles SDK (x402, API, Facilitator, etc.) and Used across Next.js and Node.js code to catch bugs early by adding strict types to data.)  
**Nextjs** \- Handles Frontend (Connections to backend)  
**Tailwind** \- Handles Styling  
**React** \- Handles UI Library  
**Nodejs** \- Handles Backend   
**Supabase** \- Handles Database (PostgreSQL)  
**VectorDB** \- Handles Retrieve Data  
**Docker & Compose** \- Containerize all into managed multi-container applications (like web app \+ database) using a single YAML file for easy setup and orchestration, simplifying development.  
**Acontext** \- (Memory integration) an open-source data platform designed to simplify the process of building self-learning AI agents by managing the storage and retrieval of their context  
**Redis** \- (Remote Dictionary Server) is an open-source, in-memory data structure store used as a high-performance database, cache, and message broker. By storing data in RAM rather than on disk, it provides sub-millisecond latency for real-time applications. It supports various data structures like strings, hashes, lists, and sets. 

Upcoming:  
**React Native & Kotlin** \- ([For upcoming Mobile Applications](https://docs.solanamobile.com/developers/development-setup))  
[Solana Mobile Stack](https://docs.solanamobile.com/)  
---

**Others:**  
[**Web3icons**](https://www.web3icons.io/) \- (Web3 Icons is the most comprehensive and up-to-date source for tokens, coins, networks and wallet logos as icon format. More than 2,500 icons are ready as optimized SVGs as well as React components.)  
[**Animejs**](https://animejs.com/) \- (Anime.js is a versatile, lightweight JavaScript animation engine that works with CSS properties, SVG, DOM attributes, and JavaScript objects.)  
---

**Monitoring & Observability:**  
**OpenTelemetry** \- ( An open standard and set of tools for instrumenting, generating, collecting, and exporting telemetry data (metrics, logs, traces) from applications and infrastructure. )  
**MLflow** \- (An open-source platform for managing the end-to-end machine learning lifecycle, including experiment tracking, model packaging, and deployment.)  
**Dune Analytics** \- (A Web3 analytics platform for exploring, querying, and visualizing on-chain data from various blockchains (Ethereum, Polygon, etc.)  
---

**LLM Models:**  
**Gemini** (Development for Cheap cost)  
**OpenAI** (For High Reason in Production ready)  
**Anthropic** (For High quality code)  
---

**Technology & Projects (SDK / Services)**  
**Thirdweb SDK** (Wallets ERC4337 **\[Account Abstraction\]**  / EIP7702 **\[EOAs\]**)  
**EigenDA** (can be used in agentic systems to provide a crucial layer of programmable trust and verifiable data availability. This allows AI agents to operate in high-value domains like finance and enterprise operations with accountability and security.) \> **that can reason, plan, and take multi-step actions to achieve goals with minimal human oversight. The primary challenge in deploying such agents, especially for valuable transactions, is ensuring their actions are trustworthy and verifiable.**

- EigenCloud **(Soon for Production)** extends Ethereum's security and verifiability to a wide array of off-chain applications, effectively creating a "verifiable cloud" for developers. Its use cases span artificial intelligence, decentralized finance, and cross-chain infrastructure.

**SKALE LABS** (

**IPFS:**  
**IPFS Pinata** ***(MCP)*** \- Verifiable Memory & Auditing, Persistent Knowledge Bases, Decentralized Asset Management, RAG (Retrieval-Augmented Generation) Systems.

**Arweave & Filecoin** \- For "permanent" storage where you pay once for a lifetime of availability, Arweave or [Filecoin (via Filecoin Pin)](https://www.youtube.com/watch?v=vU8Po444mp8) are used to prevent the agent's identity from ever going offline.

**EigenDA (Data Blob)** \- (can be used in agentic systems to provide a crucial layer of programmable trust and verifiable data availability. This allows AI agents to operate in high-value domains like finance and enterprise operations with accountability and security.)

**Langgraph** ( building applications using LLMs, allowing developers to create stateful, multi-agent systems with complex workflows and cycles, unlike simpler chains.)

**Firecrawl** (AI-powered web scraping and crawling platform that converts websites into clean, structured data (like Markdown or JSON) for use in AI applications.)

**Pinecone** (fully managed, cloud-native vector database designed for the efficient storage, management, and search of high-dimensional vector embeddings)

**Networks Supported:**  
Mantle, Avalanche, SKALE, BNB, Arbitrum, Protocol Labs.

- Soon (other EVM/L2-L1):

---

**HyperAgent: (Spec)**

- SOA **(Service-Oriented Architecture)** software design approach for building systems from discrete, coordinated, yet passive services  
- A2A **(Agent2Agent)** protocol is a new communication standard enabling autonomous, goal-oriented AI agents to proactively collaborate and manage tasks with each other  
- **ERC8004** (Trustless Agents) Ethereum standard designed to facilitate discovery and trust among autonomous agents on blockchain ERC-8004 extends the Agent-to-Agent (A2A) protocol with three lightweight on-chain registries: Identity, Reputation, and Validation.   
- RAG **(Retrieval-Augmented Generation)** AI framework that enhances Large Language Model (LLM) accuracy by incorporating external, authoritative knowledge bases such as internal company documents, databases, or live, updated data before generating responses. It reduces hallucinations and keeps models current without retraining.

---

**Features:**  
Workflow end to end **(Think \> Discussion \> Planning \> System Design \> Proposal \> Generate \> Audit \> Test (Interact) \> Compile \> Deploy)**

Instead of using one brain uses a system of specialized components that "hand off" tasks to each other. Composite Model Architecture: uses a "family" of models. It routes complex tasks to high-capability Frontier Models (like Claude 3.7 or GPT-5) and small updates to a "Quick Edit" model optimized for speed and cost.

* **Prompt Routing (or Model Routing):** This is the "traffic control" technique. A [Router](https://samselvanathan.com/posts/llm-prompt-routing/) analyzes your request and decides which model is best suited to handle it based on complexity and domain.  
* **Agentic Pipeline:** acts as an AI Agent. It doesn't just output text; it [executes the code in a sandbox](https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent), checks for errors, and "self-corrects" before you ever see the result.  
* **LLM Suspense (Streaming Post-Processing)**: This is a custom technique by Vercel. As the AI "talks," a secondary layer watches the stream and instantly swaps out broken imports or outdated icons in real-time.  
* **Dynamic System Prompts:** Rather than a static list of rules, uses a dynamic context injector that pulls the latest library documentation (like Shadcn UI updates) into the prompt at the moment you ask, ensuring the code isn't outdated.  
* **RAG (Retrieval-Augmented Generation):** It uses [RAG](https://medium.com/@vi.ha.engr/the-architects-guide-to-llm-system-design-from-prompt-to-production-8be21ebac8bc) to search through specialized code datasets and documentation, "grounding" the AI's response in factual, working code examples instead of letting it hallucinate. 

---

**Security:**  
Slither, Mythril, MythX, Echidna, Tenderly

**Smart Contract Framework:**  
Hardhat, Foundry, Vype, Brownie, Truffle

- **Soon (Solana/Move/Rust/Cadence)**

---

**Design Architecture:**  
**Microservices** (independent, API-driven services) offer high scalability and technology flexibility, ideal for complex, large-scale applications.

**MCP** (Model Context Protocol) open standard that allows large language models (LLMs) and AI agents to connect with external tools, data, and services (like databases, search engines, or calendars) in a standardized way

**API** (Pay-as-you-go\[**Services**\]) \- Paid API gateway

**CLI SDK** (NPM \- **TBD**)

# Principles

## **Document meta**

**Topic**: Principles – Methodology & Philosophy for Hyperagent  
**Target audience**:

* Internal engineering & product teams (how we design agents and pipelines)  
* External collaborators / ecosystem partners who need to understand our approach at a high level

---

## **1\. Purpose of This Document**

**Example**

Hyperagent’s Principles document describes the methodology and philosophy behind our AI-native smart contract platform. It explains how we design agentic pipelines, choose models, and make trade-offs between speed, safety, and verifiability across multiple chains.

These principles are the “rules of the game” for anyone building or extending Hyperagent agents, SDKs, or integrations so that the system behaves consistently even as we add new models, tools, and blockchains.

---

## **2\. Outcome-First Philosophy**

**2.1 Primary Success Metric**

Inspired by v0’s focus on the percentage of successful generations (working websites rendered without errors), Hyperagent optimizes for:

**“Safe, reproducible smart contract deployments with zero critical vulnerabilities and minimal human friction.”**

Secondary metrics:

* Time from natural-language spec to first deployable contract.  
* Percentage of runs that pass all automated audits without human intervention.

**2.2 Principles**

* We measure the pipeline, not just the base model.  
* Reliability and safety matter more than showing off “clever” AI behavior.

---

## **3\. Composite Agent & Model Architecture**

Vercel’s v0 uses a composite model architecture: a frontier base model for heavy reasoning, a Quick Edit model for small changes, plus an AutoFix model and post-processing pipeline. Hyperagent applies the same idea to smart contracts.

**3.1 Multi-Model, Multi-Agent Design**

* **Base reasoning models** (OpenAI, Anthropic) handle complex design and multi-step reasoning for protocols and system architecture.​  
* **Quick Edit / Fast models** (e.g., Gemini) handle localized updates, refactors, and small fix-ups to reduce cost and latency.  
* **Specialist agents** (SpecAgent, CodeGenAgent, AuditAgent, DeployAgent, MonitorAgent) each own a stage in the pipeline instead of one monolithic “brain.”  
* **3.2 Decoupling Strategy**

As in v0, the composite architecture lets us upgrade base models without rewriting the entire pipeline. Hyperagent keeps routing, RAG, audit logic, and deployment adapters stable while swapping in better base models over time.

---

## **4\. Dynamic Context, Not Static Prompts**

Vercel emphasizes that the system prompt alone is not a moat but is still a powerful steering tool, enhanced by dynamic context injection instead of naive web search. Hyperagent follows the same philosophy.

**4.1 Dynamic System Prompts for Web3**

* System prompts are generated at runtime with:  
  * Current chain context (Mantle vs Arbitrum vs others)  
  * Latest contract templates and libraries (OpenZeppelin versions, protocol-specific ABIs)  
  * Project-specific constraints (risk profile, governance rules, compliance needs)  
  * We treat prompts as *configuration+policy*, not as hard‑coded strings buried in code.

**4.2 RAG over Curated Sources**

Like v0 uses curated docs and code examples instead of raw web search, Hyperagent uses RAG over:

* Security best-practice datasets, audit reports, and known exploit patterns  
* Framework docs (Hardhat, Foundry, Thirdweb, etc.)  
* Protocol-specific specs and past deployments.

The principle: **don’t trust the model’s training cutoff; always ground in curated, versioned knowledge.**

---

## **5\. Streaming Post-Processing and Autofixers for Code & Contracts**

Vercel’s LLM Suspense manipulates output as it streams, fixing imports and references in real time, and then autofixers apply deterministic and ML-based corrections afterwards.

Hyperagent adopts an analogous pattern for smart contracts:

**5.1 “Streaming Guardrails”**

* As agents generate code, a streaming layer inspects the output for:  
  * Dangerous patterns (unbounded loops, unchecked external calls, privilege escalation).  
  * Misused libraries or deprecated patterns.  
* Where possible, we apply deterministic rewrites (e.g., safe math, re-entrancy guards, correct access modifiers) while the output is still streaming.

**5.2 Post-Generation Autofixers**

* After generation, we run:  
  * Linters, formatters, and static analysis tools (Slither, Mythril, etc.).  
  * Deterministic transforms (e.g., auto-adding missing imports, fixing pragma versions).  
  * Optional small, fast “AutoFix” models trained on our own error corpus, similar to `vercel-autofixer-01`.  
  * Principle: **LLMs propose; deterministic and small specialized models dispose.**

---

## **6\. Safety, Verifiability, and Least Privilege**

**6.1 Safety-First Contract Philosophy**

* Smart contracts are high-stakes; failures are irreversible. Hyperagent always biases toward safer defaults:  
  * Least-privilege roles and permissions  
  * Explicit upgrade paths and timelocks for upgradable contracts  
  * Canary deployments or staged rollout where possible.

**6.2 Verifiable Pipelines**

* Every pipeline run aims to be:  
  * **Reproducible** (same input spec \+ versioned templates → same contracts).  
  * **Auditable** (logs, prompts, tool calls, and analysis decisions traceable via OpenTelemetry and stored with DA/long-term storage where appropriate).  
* Longer term, we commit to making Hyperagent pipelines **provably verifiable**, aligning with EigenDA/EigenCloud and, eventually, ZK-backed attestations.

---

## **7\. Human-in-the-Loop by Design**

Even with strong automation, Vercel still uses evals and user feedback loops to drive improvements. Hyperagent similarly treats humans as key actors in the system. Principles:

* High-value or high-risk deployments (RWA, large TVL DeFi, protocol upgrades) **require human review gates** in the pipeline.  
* Designers, auditors, and protocol teams can inspect and edit specs, code, and risk reports at defined checkpoints.  
* Feedback from these reviews (override decisions, discovered bugs) are logged and later used to improve prompts, RAG datasets, and AutoFix models.

---

## **8\. Multi-Chain, Opinionated per Ecosystem**

Hyperagent is chain-agnostic in architecture but opinionated in practice:

* Core philosophy: **“One platform, ecosystem-specific best practices.”**  
* Each chain (Mantle, Arbitrum, Base, etc.) gets:  
  * Its own templates, gas and fee strategies, recommended libraries, and risk profiles.  
  * Observability views (e.g., Dune dashboards) and deployment adapters tuned to that chain.

Principle: **Global infrastructure, local optimization.**

---

## **9\. Continuous Learning and Evaluation**

Borrowing from Vercel’s emphasis on evals and iterative RFT training for their AutoFix model, Hyperagent commits to:Maintaining eval suites for:

* Security patterns and anti-patterns  
  * Gas efficiency  
  * Multi-chain deployment correctness.  
* Tracking:  
  * Error-free deployment rate  
  * “Autofix success” rate  
  * Incidents caught by human reviewers vs agents.

These metrics drive when we introduce new models, change routing, or update templates.

Tenderly fits naturally into the **Principles** doc as part of your methodology for *safety, feedback, and iterative improvement* very similar to how Vercel uses streaming post-processing and evals to harden v0.

Here’s how to extend the Principles outline to explicitly include Tenderly.

---

## **New section under Principles**

You can slot this as a new subsection under **5\. Streaming Post-Processing and Autofixers** or **6\. Safety, Verifiability, and Least Privilege**:

## **6.x Tenderly as a Ground-Truth Execution Oracle**

Hyperagent treats **on-chain execution** as the ultimate source of truth. To bridge the gap between LLM-generated code and real network behavior, we integrate Tenderly’s debugger, transaction simulator, and monitoring stack directly into the agent pipeline.

Principle: **“Never ship code we haven’t simulated and inspected under realistic chain conditions.”**  
 Agents don’t just generate contracts; they must pass a Tenderly-backed simulation and analysis phase before anything is considered deployable.

---

## **6.x.1 Simulation-First Contract Validation**

Tenderly’s Transaction Simulator lets us preview the exact outcome of transactions on any EVM chain, including asset transfers, gas usage, and error conditions. Hyperagent uses this as a mandatory validation step:

* For each candidate deployment, the pipeline:

  * Simulates initialization and critical flows (minting, trading, governance actions) on a forked state.

  * Uses state overrides and bundles to test complex, multi-step scenarios (e.g., liquidation cascades in DeFi).

  * Surfaces human-readable errors and gas profiles back into the agent loop for automatic or human-guided fixes.  
  * This is analogous to Vercel’s “LLM Suspense \+ AutoFix” layer, but applied to **runtime behavior**: the model proposes, Tenderly simulations confirm or reject.

---

## **6.x.2 Debugger-Driven Learning Loops**

Tenderly’s advanced Solidity debugger allows us to step through failed or risky executions line by line, inspect state, and profile gas at each call frame.

Principles:

* Every critical simulation failure becomes a **training example**:

  * The failing trace, decoded errors, and relevant code are logged as part of our internal “error corpus.

  * AutoFix-style agents use this corpus to learn patterns of common mistakes (e.g., missing increments, incorrect access control, unsafe external calls).

* We prefer **debugger-backed understanding** over guessing:

  * Agents are encouraged to reason from concrete traces (stack, storage, events) rather than speculating about what “might” have happened.

---

## **6.x.3 Monitoring, Alerts, and Live Feedback**

Tenderly’s monitoring, alerts, and Web3 Actions give Hyperagent a real-time feedback loop once contracts are in production.

Our principles in production:

* Set default alerts for:

  * Failed transactions spikes

  * Unusual function call patterns (e.g., governance function spam, abnormal minting)

  * Gas anomalies or unexpected balance changes.

* Use Web3 Actions or webhooks to:

  * Trigger Hyperagent MonitorAgents when anomalies occur, kicking off automatic investigations or safe-mode actions.

  * Feed anonymized incident data back into our evals and RAG corpus so future generations avoid similar issues.

This mirrors Vercel’s philosophy of constant evals and iteration: production incidents are not just outages but **training signals** for the system.

---

## **6.x.4 Chain-Agnostic Safety Layer**

Because Tenderly supports 90+ EVM networks via simulations and monitoring, it aligns perfectly with Hyperagent’s multi-chain philosophy.

Principles:

* Hyperagent should offer **the same safety guarantees** simulation, debugging, and monitoring for any supported EVM chain, not just one or two ecosystems.

* Chain-specific adapters (Mantle, Arbitrum, Base, etc.) plug into a **shared Tenderly safety layer**, ensuring that as we scale to more chains, our safety posture scales.

# Architecture

## **Architecture Document**

**Topic**: Hyperagent Complete Architecture (All Angles \+ Visualizations)  
**Target audience**:

* Internal: Engineers, architects, ops (build, debug, extend)  
* External: Partners, auditors, investors (understand system structure, dependencies)  
* Grant programs: Ecosystem evaluators (assess technical maturity, scalability)

---

## **1\. Architecture Overview**

Hyperagent is a **multi-tenant, multi-chain AI platform** for generating, auditing, and deploying smart contracts. The architecture is modular, stateless where possible, and designed to scale horizontally while maintaining strict security isolation.

**Core Layers:**

1. Client Layer (UI, SDKs)  
2. API & Orchestration (multi-tenant gateway, LangGraph)  
3. Agent Workers (specialized, queue-driven)  
4. Verification Pipeline (Tenderly, Slither, MythX)  
5. Deployment Adapters (chain-specific)  
6. Observability & Data (OpenTelemetry, EigenDA, Dune)

---

## **2\. Component Architecture Diagram (Mermaid)**

![][image1]  
Visit this link to see actual view: [Component Architecture Diagram (Mermaid)](https://mermaid.live/edit#pako:eNqNVW1v2jAQ_iuWP-xLKYPCCkVTpRQ6hgajK3SdZqbJkCvxljc5ztqs6n_f2U6EIa06JOzLvd9zd8kj3SQ-0AHdSp4GZHmxign-snxtGSs6DAXEikx5AXJFrVj_bibsFtZ4vV_Lt-ef4UE1f2XkiFwD36gfO73F6BPDf2bUlgvUGE4npRxi3xK1qN7VhLwhc7kJIFOSK5HEbvAxV3DPC6bVStr4_8AzpXlHxMtV4GSx85RINuXxdmwCuWzj4Bp8kZEvOeTwao7DJEpzBXVohgjpGGJW3sTbIoIWgOl0Rq6TXIl4q7Hyxk6OXu4LxczpmixCoQKQqD4rVPDNMRhBGiYFs5drsgyE9O-xO0fkI5d-wN2GfAUp7gpmLrEx0FojrBRkWJCFiPJQI_IqAiOueL38RZ7yNc-AVYRxfyWTX7BRekRuE_k7S_kGsr20NhhydMEqwvbDG5PLaA2-j4i56qZRzJxG0bRMOx9ybKmjeCkQl5HHytuWKjE4WWAYvv2PPgdcxPUyZzxWITB7Ec_nqQLptlOuhZJ5xCriGZ0LDZM-DmQvJzNfZyD_8LXAqSjcdOZLNk8hXkIIEShZ7ArVqMyQJTYugFW7Z0nMKtrYIEMgMnZCvRCkcs1GeQxMH8SLeViondODnG8m5Pj4vNpOy8P3QJ1ZPhiBu49W6nKMSrlUL0jN9rwgs3vi5lgtqJbatbB8u4OHXEvXXJXrp9l2FmrsagBqAt15N5_9lJuoYQb8INmmycsuSYlruWhWtofufPkM0-m9le7Vo5truGbwf5rBpw38QgifDrAOaNAIZMT1I33URiuKb6gIVnSApA93PA-Vns0nNEt5_D1JospSJvk2oIM7Hmb4lKc-5jUSHMd7p2KyGyZ5rOig1zcu6OCRPtDBSbt51mq3Wt3WWfu01zltdxq0oIN2t9k_7fX63VbnpNN71233nxr0r4naap71Oq1up9M_QYt--xQtEFMEb2Y_fOb79_QP8bkv5Q)  
---

## **3\. End-to-End Pipeline Flowchart (Mermaid)**

![][image2]

Visit this link to see actual view: [End-to-End Pipeline Flowchart (Mermaid)](https://mermaid.live/edit#pako:eNpdlF1zmkAUhv_Kmb2NpvhRNUwnHYKfiUajdjJt6cUKK2wDu8yymFj1v_ewWHTqlcA-z77n7IED8WXAiE22sXz3I6o0rPueAPw5Pz3yLWMKVinzYSLSXH_ZqE_3rmJUM1i-OqDlGxOwlQpmVOiYeeQX1Ov38IDoQsnfzNdQLg8M-irVW5ZSn8ENuBHlAlwptjxErtzzweAu4nPlRyzTimq0rxUPQ6YyI5lSEY4UTSModEXuCncN3kfcxapGmM0JmShjr1mSxpgkw72Xzqhi-oYZnBlAiKkq8GDp1psWEu1Os1MhA4MMEVlpqrkPjqDxPuNlvlXMdYRtu4HZXkeKxxU3NNzo4JG1lHEGC5plXz1yKp-OiqfHZ3mEMZqdXMsh_yjCsjqGKlt_XRVMpUwr97gs41r1nWVHmKBrzUTAVLyHFU9y7AGXpW4iuC5OQnEsgsYwxF5mlXFijI-Y9oL9F_mxivyE2_TZJg_Rh7HPHT9vax7g-VXqJ6OeXEtM2Claljx7g5UvFRdhOTSMhxEeCHpFgDcvCadGM8OEY1wCBXnJNrton1E7zhMqsJc7zt5hhAdcWZ7NQidNldyx4AhzU0oay_319ERcBe9sU5yqGXVYLtxKMav6MC9vzE2yhRkqgUOM70GpPM_V-gPGNIvQNtjhFpeSFgZ8uT60mcRjurTDiZnSxRD3UbCRVAUX-sXQy-u3T-LUM83KyUQN9hFfu1We0g3NiiaQGgkVD4itVc5qJGEqocUlORROj-AsJ7jOxr8B29I81h7xxAmxlIofUib_SCXzMCL2lsYZXuVpgE3ucxoqmlR3lSnKlbnQxO41jYPYB_JB7Gbj9s5qWFbbumt0uq1Oo1Uje2I32re9Trfba1utZqv7ud3onWrkj9nWur3rtqx2q9VrItFrdNDHgqJXs_KbZj5tp79ZOYR4)  
---

## **4\. Multi-Tenant Isolation Diagram**

![][image3]  
Visit this link to see actual view: [Multi-Tenant Isolation Diagram](https://mermaid.live/edit#pako:eNqVU02PmzAQ_SvWnJOUrwJBq5VgV6pWTaUtVKpU6MGBSUIbbGTs7qZR_nuNgRUH9lAfrJnn9-Z5GHyFklcIERwFbU9klxaM6NWp_QAU8A0ZZZLE5DsXv7uWlljAQOpXbOfx8xP5jJfu5wx18mfBf2EpySOVdH7i5imVSHZ1U8tJgqwagvfMk2XzZNE8edc8-T_z7EQFVuSJHQSd237SNV7oxXiP8d1efLgfL5tyJWt2nPl-VagwT7GqO5JJgbTpZoJ1VvIWqxm_bxZFl8dH1PXGbG7xwJnEVzmTZKqle9phPgWGnvKX9Q7_4JlkWCpRy8ty07FN1uv7qZkRcww21RvAZIGYLBGHfeSZc_MRBtiEBhx7Kxis9B9YVxBJoXAFDYqG9ilce0kB8oSNnn2kwwoPVJ1lP5GblrWU_eC8mZSCq-MJogM9dzpTbaWv8FhTPdPmDRW6fRQPXDEJUeibGhBd4RUix95sLduyPGtr-4Hr2-4KLhDZ3ib0gyD0LNdxg4-eHd5W8NfYWptt4Fqe64aOVoS2rxV60pKLL8PLMg_s9g_BEAgg)  
---

## **5\. Agent Routing & Model Selection (Decision Tree)**

![][image4]  
Visit this link to see actual view: [Agent Routing & Model Selection (Decision Tree)](https://mermaid.live/edit#pako:eNp1k91vmzAQwP8Vy0-bRlIIaT7Q1AklSzap0bKGvbT0wYULWAWbGZOPpvnfd9gLqrSOh8N39v3uyz7RRKZAA7ot5D7JmdIkmseC4LfRqD38qkGRO_jdQK0fSa93QyJWP0fHCk4zWVYFHLg-fjlbl8tWe-41pt94ln9-Ulc3H0KV5FxDohsFDlkrqWUii_pjTF_JQkmhOaiHmF6WZIVJFbXx_VGBCL-T5TrqDSW5IqHQuZIVT2L6-G7UFaS8KW3cGXIw-x2HvUMiLMGGXPEUo6HsRRjNHF1CyQUnXv-6Te9_7Fu5t-AFP0DtkIVUJdOai8xwfzY8eUay-ZOvKddv2YuC1XlHtrKruO3sLGdczNAAB40Uo5K_ugGtmNAFkF1NQvXEtWrKDofF_MOwOzaZ9_esfGu3IwacLNNQd1l0FjuTe_LJevU2FSR8-3Yal5OGdBcukYESp6AVhx0rDGEDSaPw5pA1tg-UwF7OZVJ3lNaj9Q8zEG0vTBhW8BdIrc1Q2vEuQbS3osFm438OVSGPiKEOzRRPaYBdAoeWgINqVXpqA8RU51BCTANcprBlTaFjGoszulVM3EtZXjyVbLKcBltW1Kg1VYq1zTnLFCs7qwKRgprJRmgaTF3DoMGJHmgw8PpT13PdoTv1RmN_5PkOPdLAG_Yno_F4MnT9gT--HnqTs0NfTFi3Px377tD3JwP0mHijgUPxSmupVvapmhd7_gPaIDO9)  
---

## **6\. Security Architecture (Threat Model Coverage)**

![][image5]  
Visit this link to see actual view: [Security Architecture (Threat Model Coverage)](https://mermaid.live/edit#pako:eNqFVNtu2zAM_RVBr0tSO_ZyMYYCXjIUHZq1WFIUmL0HNWYTYboYkjzMDfLv1SWLjbbD_CCTlI54eEj7gLeyApzhnSL1Hm0-lwLZRzePIVDia1E3Bt2QFlSJw6577jUov1U4C3nzZ7e9JoIa-gyqCPiz_-lRXVx-Xd9-Q-vtHjhBH9AXYTlQsevBrxqiKkUoK84WWlmizMPvlOS1yRWXaqhNy-CEBFEF400R-Q7EO0X4cOFX7W--1pIRAxVaSGEIFaB0j9VGSqYLv_rTN0C0QXeK_qYMdv9ncduYd7Vc2MqKK7DZTrkr6EtpiKHbIrxQLghrNQ0E1oyaPaiLVWv2irIeaNkKwi1qY9mAYi1aU97Y0qTqHfpO9a_CLbYXUnUd-HcFS6iZbN9WEOJFeHErp6eX5-iBMAamL-JK2knw2TpyOQN1PvQq-3nQ0HB42c2R97rhcJ7vYwCFfrug79broFM4XBdEdeZJMW97TXww1OvMjncp8MB-L7TCmVENDDAHxYlz8cFlKrFtCocSZ9as4Ik0zDixjhZWE_FDSv4XqWSz2-PsiTBtvaau7AAsKbFy83NUeZUWshEGZ_PU34GzA_6Ds3E8mkdxFKXRPJ5Mk0mcDHCLszgdzSbT6SyNknEy_ZjGs-MAP_u00Wg-TaI0SWZji5jFk_EAQ-UKW4X_gP8dHF8AWrJKsg)

---

## **7\. Scaling Architecture (Horizontal)**

![][image6]  
Visit this link to see actual view: [Scaling Architecture (Horizontal)](https://mermaid.live/edit#pako:eNqFU11vmzAU_SuWnzqNZGCyQNBUKVmmqlIaZaFqpUEeHLgFNLAjY9amUf77jIHKzbTND-B7zznX98M-4YSngAOcCXrI0WobM6TWitN0QUvKEhBRa6DB-rIXn67nm1t0QyU80-OuE3Tfutl3cWL8yMVPEGjDeYmuwoSWgCRH6w8x7qjt6jhO1HMdHXtzlDln6CNaUZbdtNF2lwoyKMgf0HqA1j0ELP1Lht8baKA289EeJ9pCWtQolAJo1Sd1D4wyiea7CzJ5TyYmefHfDELJBc0AXd01pSxGne5dh8LmQPe0hmjY6AO2_Hm0gl9QohCSRhTyaOT1AIkKu1xEw8bM6Zal8AK1Qf9WZMCW86j_a3KYUwEpuhc0eeNeVGFeEDQaXfe9-xdIOrAjanc_f8NPDH_P70kaGLpgIp1kKNZE1hrpC4sZttQlL1IcSNGAhSsQFW1NfGpFMZY5VBDjQG1TeKJqJO0kzkp2oOwH59WgFLzJchw80bJWVnNI1UtYFlRNtXrzCtUvEF95wyQOZr6OgYMTfsEBccYz27HtiT1zpp47dVwLH3HgTMb-1PP8ie0S1_s8cfyzhV_1sfZ45rn2xHV9ohS-MyUWVtdOFXzXPV79hs-_AcxbK2Q)  
---

## **8\. Multi-Chain Deployment Sequence Diagram**

![][image7]  
Visit this link to see actual view: [Multi-Chain Deployment Sequence Diagram](https://mermaid.live/edit#pako:eNp1k8GO2jAQhl_F8qlVASUkheDDSgiithIslAZVrXIxyZB4N7FTx9ZCEe9eO4YVXdocEjvzze-Z3_YJZyIHTHALvzTwDOaMFpLWKUfmaahULGMN5QptEW3RtgV5H5quv9ig_XyiCl7o8Z5ZbWafLbSSWQmtklSJfyjN4_Vi9cNyc2gqcUTTAri655bTx2QRW25pphWgzXp2TyXx4zzeLDq9BHgOsrpU5t7b_sODKZpcF9t8n6JEPANHSlyEHWggg9oWCPqqQQPKu4zaFIeexM5RNm4w1wNB8QEyrW5Rh7m4Aa_lEbSW0N9XrCgValmtK6qY4I6-Qv0b5W-vDJLQ6kq1b5SdPQbUu5oppA7oXVIymb_A7r1DHXErmhyMWAas-X-ZMac743UtODO7x3jxhrzxsnMmE3VTgfrLxK3tVjxBpi7GQI4-3EiiivHnlOMeLiTLMVFSQw_XIGtqp_hkxVKsSqghxcQMc9hT40GKU342aWbnfwpRXzOl0EWJyZ5WrZnpJjcH9HLGX__K7mzMhOYKE98bdiKYnPABk6E_mHi-54XexB-Ng5Ef9PDRUOEgGo3HUegFw2D8MfSjcw__7tb1BpNx4IVBEA1NRuSPjB7ktr2lu2rdjTv_AW7kGZQ)  
---

## **9\. Verification Pipeline Detail (Flowchart)**

![][image8]  
Visit this link to see actual view: [Verification Pipeline Detail (Flowchart)](https://mermaid.live/edit#pako:eNpdUkmPmzAU_ivWO_REIpYSAodW1WTaOXSqKsylhTm4-AWsGjsypjNk-e_FBtKFA-99K5LxGSrFEDI4CPVSNVQb8rQrJRmfu1EoPqFETQ0yB5_JavWOfKW6w8K9yRvymUvzPCUmylpywU2DupgnyQ01vCIfJBVDx7vZv6g28TiYRnNRzJPkQ_tDiTFz_4pVb7iSc2gx2NB91XAmaTFP8rE_nbisZ-fCWucTSoZaDMWykJy3vaB_Fd8U69_z7mdeKY2F3Yhd_xTfRGd96Fsqzw-8bpzw_jqZHG0Nl2_YXcgef3F8KSZ2AkubA65qh0ehhj1SNvxf8kVd_pXBg1pzBpnRPXrQom6phXC20RLGk22xhGxcGR5oL0wJpbyOsSOV35Vql6RWfd1AdqCiG1F_ZOPv3nFaa9reWO3O5k710kAWxBtXAtkZXiGL4nid-n4aR9sk9kM_jj0YIFsFwTqIwiBJ4yQJg-0mvXpwct_112kS-W-jaBsGm2QbbEIPkHGj9ON0Gd2dvP4GUh3YxQ)  
---

## **10\. Observability Architecture**

![][image9]  
Visit this link to see actual view: [Observability Architecture](https://mermaid.live/edit#pako:eNqNU8uO0zAU_RXrLlilJQ_SNBEaaWglGImqSGRFwsJtbiaR_IhsR0youuUD-MT5Epy4QzoMSHhh39e59-TEPsFRVggZ3CvaNSR_Vwpil-4PLlDCndBG9RyFoaaVogRXMa59Xuw7FDky5GjU8PagXt987qjQGfmkJO-MJo8_fpItdkwOX2fg7mPN5LfCHRNqZ1kwsrNd2qO-VKKonPGC00Yyhsc_6VyiUhX7fHauxo6c0DTY62I2p_F3olb0v8dvqW4OkqpKk1fklqEy-prHe0VrKmhxOZ0qgzbIyQekzDRXlHI7BRUbXJfiyZ0w-QO5FZJT1qK-gmx7gcW4TUWbhrbC1lE2mH9yt3osFjezJi7q5P9bZlZnyl4-xOWeM36ZH5k9j4Jnb1dbQWbvEXrAUXE6unAaESXYQRxLyKxZYU17ZkY1zxZmr9IXKfkTUsn-voGspkxbr-8qanDbUvtb-O-omuhtZC8MZMHKn5pAdoIHyKI4Xqa-n8bROon90I9jDwbIFkGwDKIwSNI4ScJgvUrPHnyf5vrLNIn8N1G0DoNVsg5WoQdYtVaonXs20-s5_wLkLQnH)  
---

## **11\. Deployment & Infra Stack**

| Component | Tech | Purpose |
| ----- | ----- | ----- |
| **API Gateway** | FastAPI \+ Auth0 | Multi-tenant routing, rate limiting |
| **Orchestration** | LangGraph \+ Redis/Celery | Agent workflow coordination |
| **Workers** | Python Docker containers | Stateless agent execution |
| **Verification** | Slither, Mythril, MythX, Echidna, Tenderly | Static \+ dynamic analysis |
| **Deployment** | Thirdweb SDK \+ Hardhat/Foundry | Multi-chain tx submission |
| **Storage** | Supabase (projects), VectorDB (RAG), Redis (queues), EigenDA (traces) | Persistent \+ ephemeral data |
| **Observability** | OpenTelemetry, MLflow, Tenderly, Dune | Full pipeline visibility |

---

## **12\. Key Integration Points (External APIs)**

![][image10]  
Visit this link to see actual view: [Key Integration Points (External APIs)](https://mermaid.live/edit#pako:eNptUktPwzAM_iuRr3SjD_oUmlStSBzgAkhItDukq9dGStMqS4Ey7b-TvoaEloPzOfbnR-wT7JsCIYJS0rYiTy-ZIPq8oShQ8j5dwH0ubzcJ5l1ZoiQ35JXVHaeqGXDMUarjbmZWTBZfmKcLGJlxTN4p56iO2j_Bljd9jULNnAdWokjidL6nXFRREn9SxmnOOFP97Jt0AtNBjF7bijJBYkF5r9h-qWGSj32LkuqIKv2DZNtI3JHVanPp8b_3ZJyrv2qc67xqG0rLBBj6Q1kBkZIdGlCjrOmgwmkgZaAqrDGDSMMCD7TjKoNMnDWtpeKjaeqFKZuurCA6UH7UWtcWVGHCqJ5WfXmVYyPbphMKIsu7G4NAdIJviBzXXYemGbpO4LumbbquAT1EK8taW45t-aHr-7YVeOHZgJ8xr7kOfce8c5zAtjw_sDzbACyYHvXztCnjwpx_AaA3tgs)  
---

# System Design

## **System Design Document**

**Topic**: Complete Hyperagent System Design (Architecture \+ Security)  
**Target audience**:

* Internal: Architects, engineers, security team (build / extend / audit the system)  
* External: Technical partners, auditors, ecosystem teams (understand security model, integration points)  
* Funding: Investors, grant programs (assess scalability, safety, multi-chain readiness)

---

## **1\. System Overview**

Hyperagent is a multi-tenant, multi-chain AI platform that transforms natural language specifications into production-ready, audited smart contracts deployed across EVM-compatible networks. The system consists of:

**Hosted control plane** (web UI, APIs, orchestration)

* **Agentic pipeline** (specialized agents for spec → code → audit → deploy)  
* **Verification & safety layer** (static/dynamic analysis, simulation, monitoring)  
* **Multi-chain deployment adapters** (Mantle, Arbitrum, Base, Polygon, etc.)  
* **Observability & data layer** (traces, metrics, long-term storage via EigenDA)

Core philosophy: **Safety-first, verifiable, horizontally scalable**. Every contract must pass static analysis, dynamic simulation, and risk scoring before deployment.

---

## **2\. High-Level Architecture**

`┌─────────────────────────────┐`  
`│        Client Layer         │`  
`│  Web UI (Next.js/React)     │`  
`│  SDK (TS: API, x402, CLI)   │`  
`└─────────────┬───────────────┘`  
              `│`  
`┌─────────────▼───────────────┐`  
`│   API Gateway (FastAPI)     │`  
`│   Auth, Rate Limiting,      │`  
`│   Multi-Tenant Routing      │`  
`└─────────────┬───────────────┘`  
              `│`  
`┌─────────────▼───────────────┐`  
`│    Orchestration Layer      │`  
`│    LangGraph + Agent Router │`  
`│    Redis Queue (Celery)     │`  
`└─────────────┬───────────────┘`  
              `│`  
   `┌──────────▼──────────┐ ┌──▼──────────┐ ┌─────────▼─────────┐`  
   `│ Agent Workers       │ │ Audit Agents │ │ Deploy Agents     │`  
   `│ (Python, Stateless) │ │ (MythX,Slither│ │ (Thirdweb, Hardhat│`  
   `└──────────┬──────────┘ │ Tenderly)    │ └─────────┬─────────┘`  
              `│             └──────────────┘           │`  
              `└────────────────────────────────────────┘`  
                              `│`  
                      `┌───────▼───────┐`  
                      `│  Verification │`  
                      `│  - Tenderly Sim│`  
                      `│  - Static Analysis│`  
                      `│  - Risk Scoring  │`  
                      `└───────────────┘`  
                              `│`  
                      `┌───────▼───────┐`  
                      `│  Deployment   │`  
                      `│  - Chain Adapters│`  
                      `│  - Gas Optimization│`  
                      `└───────────────┘`  
                              `│`  
                      `┌───────▼───────┐`  
                      `│   Monitoring  │`  
                      `│  - Tenderly Alerts│`  
                      `│  - Dune Dashboards│`  
                      `│  - OpenTelemetry │`  
                      `└───────────────┘`  
                              `│`  
                      `┌───────▼───────┐`  
                      `│   Data Layer  │`  
                      `│  - Supabase (Projects) │`  
                      `│  - VectorDB (RAG)     │`  
                      `│  - EigenDA (Traces)   │`  
                      `└───────────────┘`

**Key design principles:**

* **Stateless agents** scale horizontally via queues.  
* **Verification is mandatory**, not optional.  
* **Multi-tenant isolation** at API, storage, and compute levels.

---

## **3\. Data Flow (Example: RWA Token Launch)**

1. **Project Creation** → User creates workspace, selects chain (Mantle), vertical (RWA), uploads spec.  
2. **Pipeline Trigger** → API → LangGraph orchestrator → queue job.  
3. **Agent Execution** → CodeGenAgent generates ERC-20/4626 contracts using RAG \+ templates.  
4. **Verification Gate** → Static analysis (Slither/Mythril), Tenderly simulation of init/mint/redeem flows.  
5. **Deploy or Loop** → If pass, DeployAgent compiles and submits tx; else, feedback to CodeGenAgent for fix.  
6. **Monitoring** → Tenderly alerts on prod txs, OpenTelemetry traces full run.  
7. **Persistence** → Project state to Supabase, traces to EigenDA.  
   ---

## **4\. Security Model (Comprehensive)**

Hyperagent operates in the highest-risk domain: AI-generated smart contracts. Our security model addresses LLM risks, infrastructure risks, and on-chain risks.

## **4.1 LLM & Agent Security**

**Threats addressed:**

* **Prompt injection** (direct/indirect, jailbreaks)  
* **AI dorking** (information leakage via crafted queries)  
* **Agent takeover** (malicious tools or state manipulation)  
* **Model poisoning** (bad RAG data, compromised templates)

**Defenses (layered):**

1. **Input Sanitization (Pre-Agent)**  
   * Standardize all user inputs to structured JSON schemas  
   * OWASP LLM01 defenses: delimiters, input/output encoding, privilege control.  
   * PromptArmor-style guardrail model scans for injection before main pipeline.  
2. **Agent Sandboxing**  
   * Each agent runs in isolated container/process.  
   * Tools have least-privilege: CodeGenAgent can’t deploy, DeployAgent can’t generate code.  
   * Multi-agent verification: AuditAgent double-checks CodeGenAgent outputs.  
3. **Output Validation**  
   * All generated Solidity code parsed and validated against schema (pragma, imports, inheritance).  
   * Static analysis before any runtime execution.

**AI-Specific Metrics:**

* Zero prompt injection successes in internal red-team evals.  
* 99%+ detection of known jailbreak patterns via guardrail model.

**4.2 Infrastructure & Multi-Tenant Security**

* **API Layer**: Auth0/JWT, rate limiting per workspace, WAF rules.  
* **Queue Isolation**: Redis streams or separate queues per tenant tier.  
* **Storage**: Row-level security in Supabase, encrypted at rest, tenant-scoped VectorDB indexes.  
* **Secrets**: No long-lived keys; use ephemeral session tokens for chain RPCs.

## **4.3 Contract & On-Chain Security**

**Pre-Deploy:**

* Static analysis: Slither, Mythril, MythX, Echidna fuzzing.  
* Dynamic simulation: Tenderly Transaction Simulator with state overrides for edge cases.  
* Risk scoring: weighted combination of findings, gas estimates, privilege analysis.

**Deploy:**

* Thirdweb SDK with AA wallets (ERC-4337).  
* Gas estimation \+ buffer, simulation before submission.  
* Optional canary deploys or time-locks for high-risk contracts.

**Post-Deploy:**

* Tenderly monitoring \+ alerts for anomalies.  
* OpenTelemetry traces for full pipeline auditability.

---

## **5\. Scaling Model**

**Horizontal Scaling:**

* API gateway \+ stateless workers → add more instances as load grows.  
* Redis/Celery queues handle job distribution.  
* EigenDA for unbounded trace storage.

**Multi-Tenant Limits:**

* Per-workspace quotas: concurrent jobs, monthly runs, storage.  
* Circuit breakers prevent resource exhaustion.

**Performance Targets:**

* 95% of pipelines complete in \<15 minutes (end-to-end).  
* 99.9% uptime for control plane.  
* Support 1,000+ concurrent workspaces.

---

## **6\. Observability Stack**

* **Tracing**: OpenTelemetry end-to-end (prompts → deploy txs).  
* **Metrics**: MLflow for model performance, Prometheus for infra.  
* **Alerts**: Tenderly \+ PagerDuty for prod incidents.  
* **Chain Data**: Dune Analytics dashboards per chain/ecosystem.

---

## **7\. Deployment Architecture**

**Services:**

* `api-gateway`: FastAPI \+ auth/rate limiting.  
* `orchestrator`: LangGraph \+ Redis queue.  
* `agent-workers`: Python workers (scale to N).  
* `verification-service`: Slither/Mythril/Tenderly integration.  
* `deploy-service`: Thirdweb \+ chain adapters.

**Infra:**

* Docker \+ k8s (or equivalent).  
* Supabase (projects), Redis (queues), VectorDB (RAG).  
* EigenDA (traces), Tenderly (simulations/monitoring)

---

# Git & Github Strategies

# Repository Governance and Strategy

This is designing the "big picture" of how code moves from a developer's brain to a production server.

1. Repository Management Strategy  
2. Git Flow & Branching Strategy  
3. CI/CD Pipeline Design (The "Workflow")  
4. Security & Compliance (DevSecOps)  
5. Release Management & Versioning  
6. Infrastructure as Code (IaC)  
7. Code Standards & Quality  
8. Documentation Strategy

## **1\) Internal Technical Spec Outline**

## **1\. Repository Management Strategy**

Describe how code is organized (mono-repo vs multi-repo), how services map to repos, and rules for creating/archiving repositories. Include ownership (CODEOWNERS), permissions, and naming conventions.​

Example visualization (mono-repo variant):

`Developers`  
   `│`  
   `▼`  
`hyperagent/`  
  `├─ apps/           (frontend, backend, agents)`  
  `├─ packages/       (shared SDKs, UI, utils)`  
  `├─ infra/          (IaC, GitHub Actions)`  
  `└─ docs/           (specs, ADRs)`

## **2\. Git Flow & Branching Strategy**

Define your branching model (e.g., trunk-based or GitFlow variant), branch naming, and rules for PRs, reviews, and approvals. Clarify what can merge directly to main vs develop and what requires checks.​

Example visualization (trunk-based):

          `feature/*`  
`Dev ──►   ─────────┐`  
                    `├─► pull request ──► main (protected)`  
           `bugfix/* ┘         │`  
                              `└─► tag (release-YYYY.MM.DD)`

---

## **3\. CI/CD Pipeline Design (The “Workflow”)**

Specify which events trigger CI (push, PR, tag) and the stages: lint, test, build, security checks, deploy. Map pipelines per repo/app, including environments (dev/stage/prod).​

Example visualization:

`GitHub Event (PR / push / tag)`

        `│`  
        `▼`  
   `CI Pipeline`  
   `├─ Lint & Format`  
   `├─ Unit & Integration Tests`  
   `├─ Security Scans`  
   `└─ Build Artifacts`  
        `│`  
        `▼`  
   `CD Pipeline`  
   `├─ Deploy to Dev`  
   `├─ (Optional) Deploy to Staging`  
   `└─ Deploy to Production`

---

## **4\. Security & Compliance (DevSecOps)**

Define security controls baked into GitHub and pipelines: branch protection, required reviews, secret management, SAST/DAST, dependency scanning, and audit logging.​

Example visualization:

`Developer Action`  
        `│`  
        `▼`  
  `GitHub Controls`  
  `├─ Branch protection`  
  `├─ Required reviewers`  
  `└─ Signed commits (optional)`  
        `│`  
        `▼`  
  `CI Security Stage`  
  `├─ SAST (code scan)`  
  `├─ Dependency audit`  
  `└─ Secret scan`

---

## **5\. Release Management & Versioning**

Describe how you create releases: semantic versioning, release branches or tags, changelog generation, and hotfix processes.​

Example visualization (tag-based releases):

`main`  
 `├─ commit A`  
 `├─ commit B ──► tag v1.2.0 (release)`  
 `├─ commit C`  
 `└─ commit D ──► tag v1.3.0 (release)`

`hotfix/1.2.1 ──► PR to main ──► tag v1.2.1`

---

## **6\. Infrastructure as Code (IaC)**

Outline how infrastructure is defined and managed via code (Terraform, Pulumi, CDK, etc.), where it lives in the repo(s), and how changes are reviewed and deployed through CI/CD.​

Example visualization:

`infra/ (Terraform / Pulumi)`  
   `│`  
   `▼`  
`GitHub PR`  
   `│   (plan in CI, comment back)`  
   `▼`  
`Approval`  
   `│`  
   `▼`  
`CI/CD applies IaC`  
   `│`  
   `▼`  
`Cloud Infrastructure (k8s, DB, queues, etc.)`

---

## **7\. Code Standards & Quality**

Document coding standards, linting/formatting rules, test coverage expectations, and code review guidelines. Tie them directly into CI checks so they are enforced automatically.​

Example visualization:

`Developer Code`  
   `│`  
   `▼`  
`Pre-commit Hooks`  
   `├─ Lint`  
   `└─ Format`  
   `│`  
   `▼`  
`GitHub PR`  
   `│`  
   `▼`  
`CI Quality Gates`  
   `├─ Lint & format check`  
   `├─ Test coverage threshold`  
   `└─ Static analysis`

---

## **8\. Documentation Strategy**

Define where different types of docs live (README, /docs, ADRs, architecture diagrams, runbooks), and how they are kept in sync with code changes.​

Example visualization:

`Docs Sources`

  `├─ /docs/ (architecture, specs)`  
  `├─ /apps/*/README.md (service-level)`  
  `└─ ADRs (decisions)`  
        `│`  
        `▼`  
  `Docs Build (MkDocs/Docusaurus/GitHub Pages)`  
        `│`  
        `▼`  
  `Internal & External Documentation Sites`

---

## **2\) External Whitepaper / Investor Deck Outline**

Here the emphasis is on why your repository governance matters for velocity, reliability, and risk management, not on every low-level rule.​

## **1\. From Idea to Production: The Pipeline**

Explain that your Git & GitHub strategy is the “nervous system” that moves ideas from a developer’s brain to production in a controlled, auditable way. Highlight predictability, speed, and safety.​

Conceptual visualization:

`Idea → Spec → Code → Review → Test → Deploy → Monitor`  
       `(all governed via Git & GitHub workflows)`

---

## **2\. Repository Strategy: Single Source of Truth**

Describe your repo model (e.g., single monorepo for core services) and why it supports rapid iteration and consistency across agents, SDKs, and infra.​

Conceptual visualization:

`Monorepo`

  `├─ Platform (core)`  
  `├─ Agents / Services`  
  `├─ SDKs`  
  `└─ Infrastructure`  
   `⇒ One place to audit, test, and release`

---

## **3\. Branching & Collaboration: Safe Parallel Work**

Explain how your branching model allows many contributors to work in parallel while keeping the mainline always deployable. Emphasize PR reviews and automated checks.​

Conceptual visualization:

`Many contributors`  
     `│`  
     `▼`  
`Feature branches`  
     `│`  
     `▼`  
`Automated checks + review`  
     `│`  
     `▼`  
`Stable main branch (always releasable)`

---

## **4\. Automated Workflows: CI/CD as a Safety Net**

Show that every change goes through automated pipelines that test, analyze, and validate it before reaching users. This is key for reliability and trust.​

Conceptual visualization:

`Commit`  
  `└─► CI: build, test, security checks`  
            `└─► CD: staged rollout to environments`

---

## **5\. Built-In Security & Compliance**

Position your DevSecOps practices as a competitive advantage: security scans, secret management, branch protection, and auditability of changes.​

Conceptual visualization:

`Every change`  
  `passes through:`  
  `- Code review`  
  `- Security scan`  
  `- Policy checks`  
`⇒ Reduced exploit and outage risk`

---

## **6\. Predictable Releases & Rollbacks**

Explain how versioning and release management allow you to ship frequently while preserving the ability to roll back quickly if needed.​

Conceptual visualization:

`Incremental releases`  
  `(v1.1, v1.2, v1.3)`  
 `with`  
`- Changelogs`  
`- Tags`  
`- Rollback paths`

---

## **7\. Infrastructure as Code: Reproducible Environments**

Describe that your infra is code-reviewed, versioned, and deployed via the same Git workflows, enabling reproducible environments and lower operational risk.​

Conceptual visualization:

`IaC in Git`  
  `└─► Reviewed`  
        `└─► Applied via CI/CD`  
              `└─► Identical, reproducible environments`

---

## **8\. Documentation as a First-Class Artifact**

Emphasize that architecture, processes, and runbooks live alongside code and evolve with it, making onboarding and knowledge sharing much easier.​

Conceptual visualization:

`Code + Docs in same repos`  
  `⇒ Every change can update:`  
     `- Implementation`  
     `- Architecture diagrams`  
     `- Operational runbooks`

[Next Pages]()

# Monorepo & naming

## **Internal Technical Spec: Git & GitHub Strategies**

## **1\. Purpose and Scope**

This document defines how Hyperagent’s code moves from a developer’s brain to production, using Git, GitHub, and CI/CD as the backbone of repository governance. It applies to all services and artifacts in the Hyperagent ecosystem: web apps, agent runtimes, SDKs, infra, and smart contracts.

The goals are to ensure fast iteration, high reliability, strong security posture, and a consistent developer experience across teams and components.

---

## **2\. Repository Management Strategy**

We adopt a monorepo-first strategy for the core Hyperagent platform, with optional satellite repos only for clearly decoupled ecosystem projects (e.g., example integrations, community agents).

Proposed monorepo layout:

`hyperagent/`  
  `apps/`  
    `web/           (Next.js + React frontend)`  
    `api/           (Python/FastAPI agent orchestration)`  
    `worker/        (background jobs, schedulers)`  
  `agents/`  
    `codegen/       (LLM pipelines for code generation)`  
    `audit/         (security analysis orchestration)`  
    `deploy/        (multi-chain deployment logic)`  
  `packages/`  
    `sdk-ts/        (TypeScript SDK: x402, API client, facilitators)`  
    `ui/            (shared React/Tailwind UI components)`  
    `core-lib/      (shared domain logic, types)`  
  `infra/`  
    `terraform/     (IaC for cloud, DB, queues, runners)`  
    `github/        (GitHub Actions workflows, reusable actions)`  
  `contracts/`  
    `evm/           (Hardhat/Foundry projects for EVM chains)`  
    `templates/     (reusable contract blueprints)`  
  `docs/`  
    `specs/         (Hyperagent spec, ADRs, process docs)`  
    `runbooks/      (ops and incident response)`

Key governance rules:

* Every top-level directory has clear ownership (CODEOWNERS).  
* New repos require justification and approval to avoid fragmentation.​

---

## **3\. Git Flow & Branching Strategy**

We use trunk-based development with short-lived feature branches:

* main: always releasable, protected, CI must be green.  
* release/\*: optional, for stabilizing large releases if needed.  
* feature/\*, bugfix/\*, hotfix/\*: short-lived, merged via PR into main.

Flow visualization:

         `feature/login-ui ─┐`  
          `feature/agent-rl ─┼─► PRs → main (protected)`  
          `bugfix/rag-index ─┘`  
                                `│`  
                                `└─► tag vYYYY.MM.DD or vX.Y.Z`

Branch rules:

* PR required for all merges to main.  
* At least 1–2 code reviews depending on risk area.  
* Status checks: lint, tests, security scans must pass before merge.​

---

## **4\. CI/CD Pipeline Design (“Workflow”)**

Every push and PR to main or release/\* triggers CI. Tags that match v\* trigger CD to staging/production.

Generic pipeline:

`GitHub Event (PR / push / tag)`  
        `│`  
        `▼`  
   `CI (per app/package)`  
   `├─ Lint & format (TS, Python, Solidity)`  
   `├─ Unit tests (apps, agents, SDKs)`  
   `├─ Integration tests (API + agents + DB)`  
   `├─ Contract tests (Hardhat/Foundry)`  
   `└─ Security scans (SAST, dependency audit)`  
        `│`  
        `▼`  
   `Artifacts`  
   `├─ Docker images (apps, agents, workers)`  
   `├─ Built SDKs (npm packages)`  
   `└─ Compiled contracts + ABIs`  
        `│`  
        `▼`  
   `CD`  
   `├─ Deploy to dev (on merge to main)`  
   `├─ Promote to staging (on tag or manual)`  
   `└─ Promote to prod (on approved tag)`

CI provider: GitHub Actions with reusable workflows under infra/github/. Each app/agent has a small ci.yaml that calls shared jobs (lint, test, build, deploy).​

---

## **5\. Security & Compliance (DevSecOps)**

Security is enforced at the GitHub and pipeline levels:

GitHub layer:

* Branch protection on main and release/\*.  
* Required reviews for security-sensitive paths (contracts/, agents/audit/, infra/).  
* Optional signed commits for production infra changes.

CI security stage:

* SAST and dependency scanning for TypeScript, Python, and Solidity.  
* Secret scanning to catch accidental key commits.  
* Contract analysis via Slither, Mythril, MythX, Echidna integrated into the audit agent pipeline.​

Visualization:

`Developer push`  
   `│`  
   `▼`  
`GitHub protections`  
   `├─ Branch rules`  
   `├─ Review requirements`  
   `└─ (Optional) signed commits`  
   `│`  
   `▼`  
`CI Security Stage`  
   `├─ Code + dependency scans`  
   `├─ Secret scan`  
   `└─ Contract analyzers`  
   `│`  
   `▼`  
`Only passing PRs can merge to main`

---

## **6\. Release Management & Versioning**

We use Semantic Versioning for the platform and public SDKs:

* vMAJOR.MINOR.PATCH tags on main.  
* SDK packages follow the same versioning in their package.json.

Release process:

* Cut a release by creating a tag on a green main.  
* CI builds artifacts, publishes SDKs (e.g., to npm), and deploys services to staging.  
* After smoke tests, promote the same artifacts to production.

Hotfixes:

* Branch hotfix/\* from the latest release tag or main.  
* After merge and green CI, tag a new PATCH version and deploy.

Visualization:

`main`  
 `├─ commit A`  
 `├─ commit B ──► tag v1.2.0`  
 `├─ commit C`  
 `└─ commit D ──► tag v1.3.0`

`hotfix/1.2.1 ─► PR → main ─► tag v1.2.1`

---

## **7\. Infrastructure as Code (IaC)**

All infrastructure (cloud resources, runners, databases, queues, monitoring) is defined in infra/terraform (or similar) and managed via Git.

Workflow:

* Infra changes are made via PRs against infra/.  
* CI runs a “plan” and posts the diff as a PR comment.  
* After review and approval, a protected workflow applies the plan to the selected environment.

Visualization:

`Edit infra/terraform/*`  
   `│`  
   `▼`  
`GitHub PR`  
   `│`  
   `▼`  
`CI: terraform plan → comment`  
   `│`  
   `▼`  
`Review & approval`  
   `│`  
   `▼`  
`CI/CD: terraform apply (env-specific)`  
   `│`  
   `▼`  
`Cloud infrastructure updated`

---

## **8\. Code Standards & Quality**

Code quality is enforced both locally and in CI:

* Common style and lint configs for TypeScript, Python, Solidity shared via packages/core-lib or .config directory.  
* Pre-commit hooks encouraged to run lint/format/tests before pushing.  
* Minimum test coverage thresholds for critical areas (agents, contracts).

CI gates:

* Lint and format checks must pass.  
* Unit tests and contract tests must pass.  
* Coverage reports generated for key modules.

Visualization:

`Local dev`

  `├─ Pre-commit lint/format`  
  `└─ Local tests`  
      `│`  
      `▼`  
`GitHub PR`  
      `│`  
      `▼`  
`CI Quality Gates`  
  `├─ Lint & format`  
  `├─ Tests + coverage`  
  `└─ Static analysis`  
      `│`  
      `▼`  
`Eligible for review & merge`

---

## **9\. Documentation Strategy**

Documentation lives alongside code and is treated as a first-class artifact:

* High-level specs, ADRs, and architecture docs in docs/specs.  
* Service-level docs and READMEs under each app/agent directory.  
* Runbooks and operational docs under docs/runbooks.

We generate a documentation site (e.g., Docusaurus/MkDocs) from /docs and publish it via GitHub Pages or internal hosting as part of CI. Docs changes should accompany significant code changes.

Visualization:

`docs/`  
  `├─ specs/    (architecture, design)`  
  `├─ runbooks/ (ops)`  
  `└─ guides/   (how-tos, onboarding)`  
      `│`  
      `▼`  
`Docs build in CI`  
      `│`  
      `▼`  
`Internal / external docs site`

## **10\. Where submodules live in the repo**

Extend the repo layout with a dedicated external libs area so people instantly see what is upstream:

`hyperagent/`  
  `external/`  
    `openzeppelin-contracts/        (submodule → OZ)`  
    `openzeppelin-community/        (submodule → OZ community contracts)`  
    `forge-std/                     (submodule → foundry-std)`  
    `erc4626-tests/                 (submodule → a16z test suite)`

* This mirrors how projects like OpenZeppelin themselves embed external libs as submodules under lib/ (e.g., forge-std, erc4626-tests).​  
* Keeping all submodules under external/ (or lib/) is a common best practice for clarity and maintenance.

You’d then reference these paths from your contracts/ and agent code (e.g., Foundry remappings.txt pointing at external/openzeppelin-contracts).​

---

## **How to keep submodules updated (without breaking prod)**

The key is: pin to tags/commits, and update via PRs, not “always latest”.

Recommended workflow:

1. Pin to stable tags  
   * Configure .gitmodules to track a specific tag (e.g., v5.0.2) or commit of OpenZeppelin.  
   * This keeps builds reproducible and avoids silent upstream changes.  
2. Sync process (manual or via agent)  
   * On a schedule (weekly/bi-weekly), your “UpstreamSyncAgent” or a human runs:

`git submodule update --init --recursive          # ensure everything is present`  
`cd external/openzeppelin-contracts`  
`git fetch origin`  
`git checkout vX.Y.Z                              # new tag you want`  
`cd ../..`  
`git add external/openzeppelin-contracts`  
`git commit -m "chore: bump openzeppelin to vX.Y.Z"`

*   
  * This is exactly the pattern: update submodule, then commit the new submodule SHA in the parent repo.  
3. CI gate for submodule bumps  
   * Any PR that changes a submodule SHA triggers:  
     * Full contract test suite (Hardhat/Foundry)  
     * Security checks (Slither/Mythril/etc.)  
   * Only if green do you merge and roll that version into the mainline.  
4. Onboarding / cloning  
   * Document a one-liner for new devs:  
   * bash

`git clone --recursive git@github.com:hyperkit/hyperagent.git`  
*`# or, after clone:`*  
`git submodule update --init --recursive`

*   
  * This is standard guidance for submodule-based projects.

You can also add a small script (e.g., scripts/update\_submodules.sh) that runs git submodule update \--init \--recursive to keep everyone’s local checkout consistent.

---

## **How this fits into the Git/GitHub spec**

You can add a dedicated subsection under Repository Management Strategy:

External Dependencies (Submodules)

* All OSS dependencies we directly vendor as source (e.g., OpenZeppelin Contracts, community contracts, forge-std, external test suites) live under external/ as Git submodules.  
* Each submodule is pinned to a specific tag or commit; we never track master/main directly.  
* Updates to submodules happen via PRs, must pass the “contracts \+ security” CI pipeline, and require review from the contracts/security CODEOWNERS.

And under CI/CD:

* Any PR touching .gitmodules or external/ paths runs the Upstream Dependency workflow: full contract tests plus static analysis.  
* If an “update external libs” bot/agent is introduced later, it creates PRs following the same rules.

---

## **Why submodules (vs just npm/foundry deps) for OZ**

For Hyperagent, submodules make sense specifically for:

* Agents that reason over source: you want your audit/generation agents to see the *actual* OpenZeppelin source tree they’ll interact with, not just a compiled artifact.  
* Pinned reproducibility: a given project spec can be tied to “OZ vX.Y.Z”, backed by a specific submodule commit in Git this aligns with your verifiability and provenance story.

You can still use package managers where appropriate, but for “critical base libraries that agents must deeply understand and sometimes patch in forks,” submodules as pinned mirrors are a strong choice.

# Roadmap (Sprint up)

* **Phase 1 – Foundation (Q1 2026\)** → “Make Hyperagent real and usable”  
* **Phase 2 – Acceleration (Q2 2026\)** → “Turn hackathon presets into a platform others can adopt at scale”  
* **Phase 3 – Scale & Decentralize (Q3–Q4 2026\)** → “Enterprise, TVL, decentralized governance”

Below is a direct mapping.

---

## **Phase 1 – Foundation (Q1 2026\)**

Timeline image: “Core SDK & AI Assistant Deployed.”Reality: Feb–Mar 2026, while you are actively in Frontier of Collaboration, SF x402, BNB, Avalanche, MONOLITH prep.

**What Phase 1 must include**

* Working **core agentic pipeline** (spec → code → audit → deploy) on at least a few EVM chains.  
* Initial **TypeScript SDK** (for x402 \+ Hyperagent API) and minimal CLI.  
* One or more **hackathon-ready presets** that prove the pipeline (Mantle, Frontier, SF x402, BNB, Avalanche).

## **How current sprints map**

* **Sprint 1 (Feb 5–17)** – Frontier of Collaboration \+ SF x402  
  * Verifiable Factory on IPFS/Filecoin/EigenDA  
  * Agentic Commerce preset on SKALE \+ x402  
    → Delivers “Core AI Assistant” behavior for verifiable infra \+ payments.  
* **Sprint 2 (Feb 18–Mar 2\)** – BNB Smart Builders \+ Avalanche Build Games  
  * BNB \+ Avalanche deployment adapters  
  * Infra/AI templates for those ecosystems  
    → Expands “Core SDK” to multiple EVM chains.  
* **Sprint 3 (Mar 3–16)** – Platformization  
  * Multi-tenant workspaces  
  * Template library (Mantle, BNB, Avax, SKALE, PL presets)  
  * Solid monorepo \+ CI/CD  
    → Completes the “Foundation”: one coherent platform with SDK \+ AI assistant \+ basic ops.

So by the **end of Q1 2026**, you can truthfully say Phase 1 is done:

“Hyperagent core SDK and AI assistant are deployed and used across multiple hackathon projects on Mantle, BNB, Avalanche, SKALE, and Protocol Labs ecosystems.”

---

## **Phase 2 – Acceleration (Q2 2026\)**

Timeline image:

* Reach **500 active developers**  
* Support **50+ deployed dApps**  
* Launch on mainnet with Mantle, Avalanche, BNB, SKALE, Protocol Labs.

Given the detailed roadmap, Q2 is where you:

* Turn hackathon integrations into **repeatable presets** anyone can use.  
* Focus on developer acquisition and mainnet launches, not just hackathon demos.

## **What Phase 2 should contain**

* **Self-serve onboarding** – “New Project” wizard with chain \+ preset selection.  
* **Documentation and examples** for each preset (Mantle RWA, BNB Infra, Avax Games, SKALE Commerce, PL Verifiable Factory).  
* **Production adapters** for Mantle, Avalanche, Mantle, Avalanche, BNB, SKALE, Protocol Labs (Mantle, Avalanche, BNB, SKALE, Protocol Labs largely reuse patterns you used to win there).  
* Usage tracking and simple pricing hooks so you can actually count “active developers” and “deployed dApps.”

## **How your sprints map**

* **Sprint 4 (Mar 17–30)** – Solana & agents groundwork, but also:  
  * Harden EVM adapters (Mantle, Avalanche, BNB, SKALE, Protocol Labs)  
  * Start instrumenting usage metrics (projects, pipelines run, deployments).  
* **Sprint 5 (Mar 31–Apr 13\)** – Observability & verifiable safety  
  * OpenTelemetry, Tenderly, Dune dashboards  
  * Per-workspace usage \+ reliability metrics  
    → Needed for enterprise‑readiness and later for “500 devs / 50 dApps” proof.  
* **Early Q2 extensions (mid‑Apr–Jun)**  
  * Focus marketing, docs, and ecosystem outreach around:  
    * “Hyperagent for Mantle/Avax/Metis/Hyperion builders”  
  * Track and push towards your numeric targets:  
    * 500 devs signing up / workspaces created  
    * 50+ mainnet contracts shipped through Hyperagent.

So Phase 2 \= “run the same infra you proved in hackathons as a self-serve product for many devs.”

---

## **Phase 3 – Scale & Decentralize (Q3–Q4 2026\)**

Timeline image:

* Enterprise services & full monitoring dashboards  
* Achieve **$5M+ TVL** across deployed apps  
* Decentralize governance.  
* This phase sits **after** the current 6-sprint block; you don’t need sprint-level detail yet, just direction connected to what you’re already building.

## **How what you’re building now flows into Phase 3**

* **Enterprise services & dashboards**  
  * Built directly on top of Sprint 5 observability work (OpenTelemetry, Dune, Tenderly, risk scoring).  
  * Offer dedicated instances, SLAs, and compliance features for larger teams.  
* **$5M+ TVL**  
  * Comes from successful protocols launched via your presets (Mantle DeFi/RWA, BNB, Avax, SKALE commerce).  
  * Your platform already tracks which contracts and chains were generated through Hyperagent.  
* **Decentralize governance**  
  * Build on ERC‑8004 agent registries, EigenDA traces, and verifiable factory work from Frontier of Collaboration.  
    Move towards:  
    * Community‑maintained template/agent marketplace  
    * Staking or reputation for agents and reviewers  
    * On-chain governance for upgrades to core pipelines.

---

## **Simple visual mapping you can copy into the Roadmap tab**

You can summarize alignment like this in your doc:

`Q1 2026 – Phase 1: Foundation`  
  `S1: Frontier of Collaboration + SF x402 presets`  
  `S2: BNB + Avalanche adapters`  
  `S3: Multi-tenant SaaS, template library, SDK v1`

`Q2 2026 – Phase 2: Acceleration`  
  `S4: Harden multi-chain adapters (Mantle, Avax, BNB, Metis/Hyperion), Solana groundwork`  
  `S5: Observability, risk scoring, monitoring dashboards`  
  `S6: MONOLITH & Solana Agent prep, agent-centric UX`

`Q3–Q4 2026 – Phase 3: Scale & Decentralize`  
  `- Enterprise offerings built on S5 observability`  
  `- Ecosystem adoption → $5M+ TVL via presets`  
  `- Progressive decentralization: ERC-8004 registries, EigenDA-backed attestations, template/agent marketplace governance`

This way:

* **Your niche is consistent**: infra \+ AI \+ x402 agents for multi-chain smart contracts.  
* **Every hackathon** is just a milestone delivering a preset or adapter inside that niche.  
* **The high-level timeline** (Foundation → Acceleration → Scale & Decentralize) becomes a clean story investors and ecosystems can follow.

# Milestone 1

Timeline 1 \= Phase 1 – Foundation (Q1 2026\)  
Goal: Core Hyperagent SDK \+ AI assistant deployed and battle‑tested through Frontier of Collaboration, SF Agentic Commerce x402, BNB Smart Builders, and Avalanche Build Games.

Below is a concrete, high‑quality plan covering what we ship and how we implement it.

---

## **1\. Phase Goals and Success Criteria**

## **Primary goals**

1. Core AI pipeline live  
   Natural-language spec → architecture → code → audit → simulation → deploy on at least Mantle, BNB, Avalanche, SKALE.  
2. SDK \+ minimal CLI shipped  
   TypeScript SDK (and thin CLI) that lets other devs trigger Hyperagent pipelines programmatically (especially for x402 \+ infra use cases).​  
3. Hackathon-grade presets delivered  
   * Frontier of Collaboration (Protocol Labs): verifiable factory on IPFS/Filecoin/EigenDA.​​  
   * SF Agentic Commerce x402 (SKALE): agentic commerce preset using x402.​​  
   * BNB Smart Builders: BNB infra/AI preset.​  
   * Avalanche Build Games: Avalanche infra/AI preset.​

## **Success metrics (end of Q1)**

* ≥ 4 chains supported: Mantle, BNB, Avalanche, SKALE (plus any earlier Metis/Hyperion work reused).  
* ≥ 8 end‑to‑end projects run through Hyperagent (at least the hackathon submissions).​  
* SDK used in at least 1 external integration (e.g., simple script/repo in each hackathon submission).​

---

## **2\. Scope of Timeline 1 (What we actually build)**

## **Capabilities**

1. Core Orchestration & Agents (already largely specced)  
   * LangGraph-based orchestrator and worker pool (Python/FastAPI).  
   * Agents: SpecAgent, CodeGenAgent, AuditAgent, DeployAgent, MonitorAgent.​  
2. Initial Chain Adapters  
   * Mantle adapter (from Mantle hackathon work).  
   * New: BNB, Avalanche, SKALE adapters (RPC config, deployment flows).​  
3. Verification & Monitoring v1  
   * Static analysis: Slither, Mythril, MythX, Echidna wired into AuditAgent.​  
   * Tenderly simulation & monitoring wired into DeployAgent/MonitorAgent.​  
4. Storage & RAG  
   * Supabase schema for workspaces, projects, runs, artefacts.​  
   * VectorDB integration for security \+ framework RAG corpora.​  
5. TypeScript SDK \+ Minimal CLI  
   * TS client for Hyperagent API (project creation, run, status, artefact retrieval).​  
   * CLI thin wrapper around SDK: hyperagent init/run/deploy.  
6. Two “flagship presets” and two “infra presets”  
   * Verifiable Factory preset (Protocol Labs).  
   * Agentic Commerce preset (SKALE \+ x402).​  
   * BNB infra preset.​  
   * Avalanche infra preset.​

---

## **3\. Sprint‑Level Breakdown and Implementation**

## **Sprint 1 (Feb 5 – Feb 17\)**

Focus: Frontier of Collaboration \+ SF Agentic Commerce x402

## **3.1 Verifiable Factory Preset (Protocol Labs)**

Objective  
Let a user submit a spec and receive:

* Contracts \+ audit report \+ Tenderly simulation link  
* Content‑addressed artefacts (IPFS/Filecoin CIDs)  
* EigenDA “trace blob” reference for verifiable provenance.​

Implementation

* Data model (Supabase)  
  * workspaces(id, name, owner)  
  * projects(id, workspace\_id, chain, preset, status)  
  * runs(id, project\_id, stage, status, started\_at, finished\_at)  
  * artefacts(id, project\_id, type, cid, eigenda\_blob\_id, metadata)  
* IPFS/Filecoin integration  
  * Use Pinata or web3.storage client in a small storage-service (Node or Python).​  
  * From orchestrator, after each major stage (spec, code, audit):  
    * Upload artefact to IPFS/Filecoin  
    * Store CID in artefacts row.  
* EigenDA integration v0  
  * Define a JSON schema: { projectId, runId, chain, specCid, codeCid, auditCid, riskScore }.  
  * Serialize and submit as a blob; capture returned blob\_id and store in artefacts.eigenda\_blob\_id.  
* Pipeline changes  
  * Add VerifiableFactoryAgent or just a preset that:  
    * Sets preset="pl\_verifiable\_factory"  
    * Forces all artefact uploads at each step.  
  * UI path: “New Project → Preset: Protocol Labs – Verifiable Factory”.

## **3.2 Agentic Commerce Preset (SF x402 on SKALE)**

Objective  
AI agent can deploy a simple on-chain commerce contract on SKALE and use x402 for payments.​​

Implementation

* SKALE adapter  
  * In deploy-service, add chain="skale" configuration: RPC URL, chainId, gas settings.​  
  * Implement deployContract(chain, compiledArtifact, constructorArgs, signer) using Thirdweb or ethers.js, parameterized by chain config.​  
* x402 integration (SDK)  
  * Extend TS SDK with an x402Client that can:  
    * Create payment links / invoices  
    * Verify payment status via x402 APIs.​  
  * Expose helper in SDK: createCommerceFlow({ price, sku, chain }) that:  
    * Deploys a simple subscription/token‑gated contract via Hyperagent deploy endpoint  
    * Links contract usage to x402 invoices.  
* Preset  
  * “SKALE Agentic Commerce” preset:  
    * Uses a standard contract template (e.g., simple subscription manager or credit ledger).  
    * Preconfigures target chain \= SKALE, adds x402 metadata to project.  
* Demo  
  * Simple script in examples/sf-x402/ showing:  
    * Define product → call SDK → Hyperagent deploys contract on SKALE → x402 collects payment → script shows proof & Tenderly link.

---

## **Sprint 2 (Feb 18 – Mar 2\)**

Focus: BNB Smart Builders \+ Avalanche Build Games

## **3.3 BNB Chain Infra Preset**

Objective  
One-click pipeline for BNB infra/AI track: contracts deployable on BNB, with Hyperagent pipeline and basic monitoring.​

Implementation

* BNB adapter  
  * Add chain="bnb" config: RPC endpoints, chainId, gas token symbol, explorer URLs.  
  * Ensure deployment \+ Tenderly simulation works for BNB (choose supported network in Tenderly project).  
* Template set  
  * Curated OZ-based templates for:  
    * Token (ERC‑20), staking, simple DeFi primitives.  
  * Store in contracts/templates/bnb/ and expose via RAG \+ presets.  
* Preset  
  * “BNB Infra Starter” preset that:  
    * Asks 3–5 questions (token name, decimals, roles).  
    * Runs full CodeGen → Audit → Simulation → Deploy on BNB.

## **3.4 Avalanche Infra Preset (Build Games)**

Objective  
Pipeline for Avalanche games/infra: on-chain rewards, quests, or simple game mechanics.​

Implementation

* Avalanche adapter  
  * Similar to BNB: chain="avax", RPC, Tenderly network selection.​  
* Game templates  
  * e.g., quest contract, leaderboard, lootbox.  
* Preset  
  * “Avalanche Build Games” preset: focused on game logic; pipeline identical to BNB but with different templates and RAG corpus.

---

## **Sprint 3 (Mar 3 – Mar 16\)**

Focus: Turn hackathon work into a coherent platform (“Foundation complete”)

## **3.5 Multi-Tenant Workspaces**

Objective  
Every hackathon project is just a workspace \+ project in Hyperagent, not an ad‑hoc branch.

Implementation

* Auth & tenancy  
  * Implement auth (e.g., JWT/Clerk/Auth0) on API gateway.  
  * Every request carries workspace\_id, enforced through FastAPI dependencies.​  
  * Supabase row‑level security rules to ensure isolation between workspaces.​  
* Workspace UI  
  * Sidebar: list of workspaces & projects.  
  * For each workspace: list of runs, chains, presets used.

## **3.6 Template Library & Presets**

Objective  
Expose all the work from S1–S2 as first-class presets, so anyone can reuse.

Implementation

* Template registry  
  * A JSON/YAML index:  
    * id, name, chain, track, description, template\_paths, agents\_required.  
  * Stored under configs/presets/\*.yaml.  
* UI & API  
  * “New Project” wizard uses the registry to show:  
    * “Protocol Labs – Verifiable Factory”  
    * “SKALE – Agentic Commerce (x402)”  
    * “BNB – Infra Starter”  
    * “Avalanche – Build Games”  
    * (Plus Mantle preset from earlier work).  
* Routing changes  
  * Orchestrator reads presetId, loads corresponding YAML, wires agents & templates automatically.

## **3.7 SDK v1 \+ CLI**

Objective  
External devs can script Hyperagent flows.

Implementation

* TypeScript SDK (package @hyperagent/sdk):  
  * createProject({ workspaceId, chain, presetId, spec })  
  * runPipeline({ projectId })  
  * getStatus({ projectId })  
  * getArtefacts({ projectId })  
* CLI (thin wrapper)  
  * hyperagent init – configure workspace and API keys.  
  * hyperagent new \--preset \<id\> – create and run a project from terminal.  
  * hyperagent status \<projectId\> – show current stage, links (Tenderly, IPFS, EigenDA).

---

## **4\. Cross‑Cutting Implementation Details for Timeline 1**

* Monorepo & Git  
  * Structure: apps/api, apps/web, services/agents, services/deploy, external/ (OZ, forge-std, etc.), contracts/, packages/sdk, infra/.  
  * Submodules for OpenZeppelin & other core OSS; CI path filters ensure full contract tests when submodules move.​  
* CI/CD  
  * On every PR: lint, tests, contract checks, basic security scan.  
  * On tagged releases: build Docker images, deploy to staging env.  
* Security basics  
  * Prompt-injection guardrails for inbound specs.  
  * No direct deploy from LLM; always via AuditAgent \+ Tenderly gate.​​

---

By the end of Timeline 1 / Phase 1 (Q1 2026\) you have:

* A running Hyperagent platform with multi-chain support and a shipped SDK/CLI.​  
* Four concrete presets tied directly to your hackathon tracks (Protocol Labs, SF x402, BNB, Avalanche).​  
* A clean monorepo, CI, and workspace model ready for Phase 2 (scaling to 500 devs / 50+ dApps).

# Milestone 2

For Timeline 2, we move from “foundation” to early acceleration: turning the core you built in Q1 into something real developers and ecosystems can adopt at scale, while hitting MONOLITH / Solana‑agent and follow‑up BNB/Avax goals.

Assuming Timeline 1 ≈ Q1 2026, Timeline 2 covers roughly Q2 2026 and ties into your own Phase 2: *Acceleration* (500 devs, 50+ dApps, mainnet launches on key chains).

---

## **1\. Timeline 2 – Goal and Success Criteria**

Name: Phase 2 – Acceleration (Timeline 2\)  
Window: Approx. April–June 2026 (right after MONOLITH submissions close on March 9, 2026).​

Primary goal

Evolve Hyperagent from “hackathon‑proven” into a self‑serve multi-chain infra product that 100s of developers can use to deploy real dApps, starting with ecosystems where you already have hackathon presence (Mantle, BNB, Avalanche, SKALE, Protocol Labs/Filecoin, Solana).

Success by end of Timeline 2

* 500+ developer accounts / workspaces created across chains.  
* 50+ contracts / dApps deployed through Hyperagent pipelines (not just hackathon demos).  
* At least 3 ecosystems have an explicit “Hyperagent preset” linked from their docs or hackathon pages (e.g., Mantle, BNB, Avalanche, Solana Mobile).​

---

## **2\. Scope of Timeline 2 (What we must build)**

Building directly on Timeline 1:

1. Productize Presets as “Blueprints”  
   * All hackathon presets (Mantle, BNB, Avax, SKALE, Protocol Labs, Solana agentic payments) become first‑class, documented “Blueprints” in the UI and SDK.  
2. Self‑Serve Onboarding & UX  
   * Smooth “New Project” wizard and workspace UX; no hand‑holding required.  
3. Usage Tracking & Growth Loops  
   * Instrumentation to measure active devs \+ launched contracts, with in‑product nudges and referrals.  
4. Ecosystem Integrations  
   * Lightweight but real integrations (docs, templates, banners) with Mantle, BNB, Avax, SKALE, Solana Mobile / x402 hackathons.  
5. Reliability & Ops Hardening  
   * Stabilize CI/CD, monitoring, and error budgets to support many external teams.

---

## **3\. Detailed Implementation Plan**

## **3.1 Blueprint Library (Productizing Presets)**

Objective  
Turn every hackathon preset into a reusable, parameterized Blueprint.

Implementation

* Blueprint schema stored in configs/blueprints/\*.yaml:  
  * id, name, ecosystem, track (INFRASTRUCTURE, AI/x402, etc.),  
  * required questions (e.g., token name, supply, risk level),  
  * which agents/toolchains to use,  
  * reference templates and RAG corpora.  
* Distill from existing presets:  
  * Mantle RWA/DeFi  
  * BNB Infra Starter  
  * Avalanche Build Games  
  * SKALE Agentic Commerce (x402)  
  * PL Verifiable Factory  
  * Early Solana/x402 patterns from previous Solana hackathons.​  
* Blueprint UI:  
  * “Create Project → Choose Blueprint” gallery with filters: Chain, Track, Risk (DeFi, RWA, Games, Agents).  
  * Each blueprint has a detail page with:  
    * Description  
    * Supported chains  
    * Security level (what checks it runs)  
    * Example projects (your past hackathon repos).​  
* SDK updates:  
  * createProject({ blueprintId, chain, params })  
  * Example scripts per blueprint in /examples (one per hackathon track).

---

## **3.2 Self‑Serve Onboarding & Workspaces**

Objective  
New devs can sign up, create a workspace, and ship a contract in \<30 minutes without your team.

Implementation

* Auth & Workspaces (from Timeline 1\) extended with:  
  * Workspace roles (owner, collaborator, viewer).  
  * Invite flow via email or link.  
* New Project Wizard:  
  * Step 1: Choose chain(s) (Mantle, BNB, Avax, SKALE, Solana, “multi‑chain”).​​  
  * Step 2: Choose Blueprint.  
  * Step 3: Fill parameters (form auto-generated from blueprint schema).  
  * Step 4: Confirm, run pipeline, show progress bar (Think → Generate → Audit → Simulate → Deploy).  
* Onboarding tour:  
  * Simple in‑app guide showing how to:  
    * View code, audits, Tenderly link  
    * Re‑run with modifications  
    * Export artefacts (ABIs, CIDs, EigenDA blob info).

---

## **3.3 Usage Metrics & Growth Loop**

Objective  
See and influence your progress toward 500 devs / 50 dApps.

Implementation

* Metrics tracked in Supabase:  
  * users, workspaces, projects, deployments, chains, blueprint\_id.​  
  * Derived KPIs:  
    * Active developers (workspaces with activity last 30 days)  
    * Deployed dApps (projects with successful mainnet deployment)  
    * Chain distribution (e.g., 20% BNB, 30% Avax, etc.)​  
* In‑app dashboards:  
  * Personal: “Your workspace” – \#projects, chains, success rate, errors.  
  * Internal: “Admin view” – global metrics, hackathon‑source tags.  
* Growth loops:  
  * Simple referral mechanism: shared link to a blueprint pre‑filled (e.g., “Clone this BNB starter we built for Smart Builders”).  
  * Discount / credits if a builder invites others or launches multiple projects.

---

## **3.4 Ecosystem Integrations**

Objective  
Make Hyperagent discoverable and credible in each ecosystem you’re already in, instead of trying to boil the ocean.

Targets

* Mantle – use Mantle Global hackathon work as a case study.​  
* BNB – tie into their 2026 technical roadmap around AI middleware and RWA.  
* Avalanche – highlight Avalanche Build Games projects.​  
* SKALE/x402 – position Agentic Commerce blueprint as canonical for SKALE agentic payments.​​  
* Solana / x402 / MONOLITH – link into Solana Mobile & x402 hackathon pages as “infra/SDK” for agents.

Implementation

* For each chain:  
  * Docs page: “Using Hyperagent on \<Chain\>” with:  
    * How to configure RPC,  
    * Which Blueprints are chain-optimized,  
    * Example repos.  
  * Minimal integration:  
    * PR/issue to ecosystem docs adding Hyperagent as a suggested tool (where appropriate).​  
    * Participation in one AMA or workshop per ecosystem where you demo the blueprint.  
* Partner‑ready materials:  
  * 1‑pager PDF/Notion per ecosystem: problem, how blueprint helps, how to get started.

---

## **3.5 Reliability, CI/CD, and SRE Basics**

Objective  
Support many users without the platform collapsing.

Implementation

* Error budgets & SLOs:  
  * 99%+ success for pipeline runs not blocked by third‑party outages.  
  * 99.9% uptime for API gateway.  
* CI/CD policies:  
  * Canary deployments for core services.  
  * Staging environment where you dogfood before announcing to devs.  
* Automated regression suites:  
  * For each blueprint, maintain a minimal regression spec that must still pass after any change to:  
    * templates  
    * agents  
    * adapters  
    * security tooling.

---

## **4\. Post‑Timeline‑2 Outcomes**

If Timeline 2 is executed well, by end of Q2 2026 you can claim:

* “Hyperagent has over 500 active builders and 50+ dApps deployed via our Blueprints across Mantle, BNB, Avalanche, SKALE, Filecoin, and Solana.”  
* “Ecosystem partners link to Hyperagent as recommended infra for AI \+ agentic payments/x402 and infra/AI tracks.”  
* “We are now ready for Phase 3 (enterprise & decentralization): more TVL, dedicated enterprise dashboards, and on‑chain governance/registries.”

# Milestone 3

Timeline 3 \= Phase 3 – Scale & Decentralize (Q3–Q4 2026\)

This phase assumes Timelines 1–2 are done: Hyperagent is running as a multi‑tenant platform with chain adapters, Blueprints, SDK/CLI, and early ecosystem integrations. Now the focus is on enterprise‑grade scale, TVL, and progressive decentralization.​

---

## **1\. Goals and Success Criteria**

Window: roughly July–December 2026  
High‑level goals (from your timeline graphic):​

* Enterprise services and full monitoring dashboards.  
* At least $5M TVL across contracts deployed via Hyperagent.  
* Begin to decentralize governance of templates, agents, and verifiability rails.​

Concrete success by end of Timeline 3

* ≥ 5 enterprise / protocol‑level customers using Hyperagent in production (not just hackathon projects).​  
* ≥ $5M combined TVL across contracts tagged as “deployed via Hyperagent,” measured via on‑chain analytics (Dune) and your own indexer.​  
* First version of on‑chain registries and EigenDA‑backed provenance for contracts, per your roadmap (ERC‑8004 \+ DA layer).​

---

## **2\. Product Scope: Enterprise & Monitoring**

## **2.1 Enterprise Offering**

Objective  
Offer a “Hyperagent Enterprise” tier that larger protocols or organizations can adopt with guarantees.

Features

* Dedicated environments  
  * Isolated workspace group, separate infra (namespaces or even dedicated clusters).  
  * SSO (OIDC/SAML) and role‑based access control for teams.​  
* Custom Blueprints  
  * Ability to define organization‑specific Blueprints (e.g., “Our DAO’s upgrade pattern”, “Our RWA compliance constraints”) with locked policies.​  
  * Stored in org‑scoped blueprint registry, optionally private.  
* SLAs & audit trails  
  * Uptime and response time SLAs.  
  * Exportable audit logs for regulators or internal compliance: who triggered which pipeline, what code was deployed, what checks ran.​

Implementation steps

* Extend workspace model with organization concept and org‑scoped settings.​  
* Add SSO integration (e.g., via Auth0/Clerk enterprise features).  
* Implement “org‑blueprints” stored separately from global blueprint registry, with access control enforced in the API layer.

---

## **2.2 Full Monitoring Dashboards**

Objective  
Give both you and customers deep visibility into health, usage, and risk of all Hyperagent‑deployed contracts.

Features

* Per‑project dashboards  
  * Pipeline stats: run history, error rates, time per stage.  
  * Security stats: which static/dynamic checks ran, risk scores, open issues.​  
  * On‑chain stats: TX volume, failures, gas usage, key function calls (via Dune/Tenderly).​  
* Portfolio dashboards (per org & global)  
  * Number of active contracts per chain, TVL per chain, top users.  
  * Alert overview (from Tenderly and your own anomaly detectors).

Implementation

* Data collection  
  * Ensure all pipeline stages emit OpenTelemetry spans and metrics (already started in Timeline 2).​  
  * Integrate Tenderly’s monitoring \+ alerts API for per‑contract runtime data.  
* Dashboards  
  * Internal Grafana for system‑level metrics.​  
  * In‑app dashboards built in Next.js, backed by summarized tables in Supabase (or a small analytics DB) and links to Dune dashboards for chain data.​

---

## **3\. Verifiability & Decentralization**

## **3.1 On‑Chain Registries (ERC‑8004 \+ Provenance)**

Your roadmap already calls out ERC‑8004 (Trustless Agents) and on‑chain registries for identity, reputation, and validation.​

Objective  
Make each “Hyperagent‑produced contract” discoverable and auditable on‑chain.

Design

* ContractRegistry (per chain or global)  
  * Records: {contractAddress, blueprintId, codeHash, specCid, auditCid, eigendaBlobId, deployedByAgentId}.​​  
  * Optional: link to ERC‑8004 agent identity for the agent responsible.​  
* AgentRegistry & Reputation  
  * Agent identities (keys or addresses) with metadata (owner, capabilities, historical performance).​  
  * Reputation scores based on successful runs, incidents, and community feedback.

Implementation

* Deploy minimal registries using ERC‑8004 patterns on major chains you support (Mantle, BNB, Avax, SKALE, etc.).​  
* Update DeployAgent to register every new contract with the registry, including IPFS/Filecoin CIDs and EigenDA blob IDs for trace/provenance.​​

---

## **3.2 EigenDA / EigenCloud‑Backed Provenance**

Your spec already positions EigenDA/EigenCloud as the verifiable data layer for Hyperagent.

Objective  
Provide cryptographic guarantees that a contract came from a specific Hyperagent pipeline run.

Design

* For each successful pipeline run:  
  * Serialize core trace: prompts, tool calls, code hash, audit results, risk score.  
  * Publish as blob to EigenDA, recording blobId and KZG commitment.  
  * Store blobId in ContractRegistry on deployed chain.​  
* (Optional, Timeline 4+): use EigenCloud or other AVS to verify ZK proofs of correct execution of some steps (e.g., “this code was actually simulated with these inputs”).

Implementation

* Productionize the v0 EigenDA integration from Timeline 1: retry logic, fee estimation, monitoring.  
* Provide a simple explorer view: given a contract address, show its registered provenance and link to EigenDA blob.

---

## **3.3 Governance & Marketplace (First Steps)**

Objective  
Begin shifting control of templates and agents from the core team to a community \+ customers, while keeping quality high.

Elements

* Template / Blueprint Marketplace  
  * Allow third parties (auditors, protocol teams) to publish Blueprints and templates.​  
  * Metadata: owner, pricing (could be free), ratings, download/usage counts.  
* Curation & Governance  
  * Keep a “Core” set of officially maintained Blueprints.  
  * Introduce governance signals:  
    * Internal now (you \+ advisors decide),  
    * Later: token‑ or stake‑weighted voting on which templates/agents are “Recommended” or “Verified.”  
* Agent Staking (design only in Timeline 3\)  
  * Define how agent operators might eventually stake on their performance, and how slashing could work if they deploy unsafe code.

Implementation in Timeline 3

* Build marketplace UI \+ registry for templates/blueprints (no token yet).​  
* Add rating/review/usage metrics per Blueprint.  
* Start an invite‑only “early publisher” program with a few trusted teams (auditors, protocol teams you already know from hackathons).​

Deeper token‑level decentralization (DAO, staking, etc.) can be left to Timeline 4+, but the technical hooks and UX should be laid here.

---

## **4\. TVL & Ecosystem Growth Plan**

To hit $5M+ TVL, you don’t just need infra; you need successful projects built on top of it.

Steps

1. Identify 5–10 “hero protocols”  
   * From hackathon pipelines: the strongest BNB, Avax, Mantle, SKALE, Solana projects that want to go live or scale.​  
   * Offer them deeper collaboration using Hyperagent Enterprise.  
2. Measure TVL correctly  
   * For all contracts registered in your ContractRegistry, index balances and protocol‑specific metrics via Dune/your own indexers.​  
   * Aggregate TVL by chain, blueprint, and ecosystem.  
3. Ecosystem programs  
   * Co‑run “Launchpad” style initiatives with at least 2–3 chains where teams launch using your Blueprints (RWA, DeFi, agentic commerce).  
   * Offer credits/discounts to projects that cross certain TVL or usage thresholds.

---

## **5\. Internal Execution Structure**

Timeline 3 is long (\~6 months), so break it into three internal waves:

1. Wave 3A (Jul–Aug): Enterprise MVP \+ Dashboards  
   * Org workspaces, SSO, org‑scoped blueprints.  
   * Per‑project and org dashboards; system SLOs.  
2. Wave 3B (Sep–Oct): Registries & Provenance  
   * ERC‑8004 style registries on major chains.​  
   * EigenDA provenance stable in production; explorer view.  
3. Wave 3C (Nov–Dec): Marketplace & Governance v0  
   * Blueprint marketplace UI \+ APIs.  
   * Ratings/usage stats, curated vs community templates.  
   * Governance design doc \+ minimal hooks in registries (e.g., “verified” flag controlled by multisig for now).

By the end of Timeline 3 you can credibly say:

* Hyperagent is not just a hackathon tool; it’s enterprise‑ready infra with monitoring, provenance, and early decentralization.​  
* You’ve laid the foundation for future phases (Timeline 4–6) to dial up decentralization, tokenization, and more advanced ZK‑based verification.

# Milestone 4

Timeline 4 – Agent Economy & Governance (Phase 4\)

After Timeline 3, Hyperagent is enterprise‑ready infra with on‑chain registries and provenance. Timeline 4 is about embracing the full AI agent economy: making Hyperagent the default place where agents register, earn, and coordinate using ERC‑8004 \+ x402 and your multi‑chain infra.​

Assume this spans roughly H1 2027 (after you’ve hit the Q3–Q4 2026 Phase 3 goals).

---

## **1\. Goals and Success Criteria**

Primary goal

Turn Hyperagent from “infra used by humans” into infra used by agents: agents register, find work, get paid (x402), and build verifiable track records via ERC‑8004 registries and EigenDA provenance.​

Success by end of Timeline 4

* 10k+ registered agents in your ERC‑8004‑compatible registries across major chains.  
* Hundreds of agents actively using Hyperagent pipelines to propose, audit, and deploy contracts or run agentic commerce flows.  
* At least 3 notable ecosystems (e.g., a BNB DeFi hub, a Solana agent program, an L2) formally list your registry/blueprints as the way to onboard agents.

---

## **2\. Scope: From Platform to Agent Network**

## **2.1 Agent Registration & Discovery (ERC‑8004)**

Objective  
Make Hyperagent a first‑class agent registry provider and discovery layer.

Features

* ERC‑8004 Identity Registry integration  
  * For each agent using Hyperagent, create or link an ERC‑8004 identity NFT that points to an off‑chain registration file (JSON) hosted on IPFS/Filebase.  
  * Registration includes:  
    * Agent endpoints (A2A/MCP URLs), supported chains, supported Blueprints, pricing, supported trust models.  
* Reputation & Validation Registries  
  * Publish summarized performance metrics (jobs completed, failures, incidents, TVL managed) as Reputation entries.  
  * For high‑value work, allow third‑party auditors to record Validation entries referencing EigenDA blobs and Tenderly simulations.

Implementation

* Extend your ContractRegistry (Timeline 3\) so every agent that uses Hyperagent can opt‑in to ERC‑8004 registration.​​  
* Build a small on‑chain module (per chain) that:  
  * Issues ERC‑721 identity tokens,  
  * Stores URIs to agent registration files,  
  * Records reputation/validation entries referencing your existing analytics \+ EigenDA.

---

## **2.2 Agent Marketplace & Job Routing**

Objective  
Agents and protocol teams can find each other and transact through Hyperagent.

Features

* Jobs  
  * A “Job Board” where protocol teams, DAOs, or other agents post tasks:  
    * “Generate & audit a BNB lending pool,”  
    * “Monitor and patch MEV in this Avax vault,”  
    * “Run agentic commerce campaign on SKALE.”​  
* Matching  
  * Use your own AI models to match jobs with suitable agents based on:  
    * ERC‑8004 identity metadata, reputation, supported chains, pricing.  
  * Allow auto‑assignment or manual selection.  
* Payments (x402)  
  * Payment rails for jobs standardized via x402 (HTTP 402\) on supported chains: agents get paid programmatically based on job status.​​  
  * Optionally escrow funds in on‑chain contracts that release when Validation entries (success proofs) are written.

Implementation

* Backend: new jobs and assignments tables in Supabase; job lifecycle tracked through your pipeline.​  
* Frontend: “Agent Marketplace” tab:  
  * Agents: register capabilities, browse/apply to jobs.  
  * Clients: post jobs, see candidate agents, approve them.  
* Contracts: simple escrow/fee split contracts using your deployment pipeline, with x402 integration for recurring or usage‑based billing.​

---

## **2.3 Agents Using Hyperagent as a Tool**

Objective  
Other AI agents (not just humans through UI/CLI) can call Hyperagent APIs to generate, audit, or deploy on their own.

Features

* Agent‑friendly API surface  
  * Stable, minimal HTTP/JSON endpoints designed for autonomous clients:  
    * POST /agent/pipeline/run  
    * GET /agent/pipeline/status  
    * GET /agent/pipeline/artifacts  
  * With clear error semantics and rate limiting.  
* MCP / A2A connectors  
  * Provide reference connectors for popular agent frameworks (AutoGen, LangGraph, Agentic frameworks) that wrap Hyperagent as a tool:  
    * “call Hyperagent to propose an upgrade,”  
    * “call Hyperagent to deploy a new instance,”  
    * “call Hyperagent to audit a contract.”​​

Implementation

* Define “agent client profile” and register them in ERC‑8004 Identity Registry so they can be discovered as Hyperagent‑compatible agents.  
* Add SDK glue code (Python/TS) for the major open‑source agent frameworks, similar to how you’d add a LangChain tool.

---

## **3\. Governance & Token Mechanics (Minimal Viable DAO)**

You started governance hooks in Timeline 3 (marketplace, curated vs community templates). Timeline 4 introduces formal governance processes without over‑engineering tokenomics.

Objectives

* Community \+ key partners collectively decide:  
  * Which Blueprints are “Core / Recommended.”  
  * Which agents or templates get higher reputation weights.  
  * How Marketplace fees (if any) are distributed.

Design

* Governance body  
  * Start with a multisig/SAFE including: core team \+ 3–5 ecosystem advisors (Mantle, BNB, Avax, Protocol Labs, Solana rep).​​  
  * Define clear responsibilities and upgrade paths.  
* Token or reputational points (design‑only or pilot)  
  * Might introduce a non‑transferable “Hyperagent reputation point” first, then later consider a fungible token if needed.  
  * Use ERC‑8004 reputation entries as canonical record on‑chain.

Implementation

* Governance process documented (HIP – Hyperagent Improvement Proposals).  
* On‑chain: simple Governor contract controlling:  
  * Registry upgrade rights,  
  * “Verified/Recommended” flags on templates and agents,  
  * Fee split configuration for Marketplace.

Token launch, if any, can be delayed to a later timeline; Timeline 4 just ensures the structures and on‑chain levers exist.

---

## **4\. Security, Compliance, and Ethics for Agent Economies**

As you host thousands of agents, security and abuse prevention matter more.

Key work items

* Rate limiting & abuse controls for agent‑initiated actions (e.g., mass deployments) to avoid spam and chain abuse.  
* Policy engine for what jobs are allowed (no obvious exploit generation for live protocols without consent, alignment with ecosystem policies).  
* Audit and red‑team your own registries and job marketplace to prevent Sybil/reputation attacks (fake agents pumping each other’s scores).

---

## **5\. Milestone Examples Within Timeline 4**

You can split Timeline 4 into three internal milestones:

1. T4‑A – Agent Registry Rollout (Identity/Reputation)  
   * ERC‑8004 registries deployed on 3–4 major chains, integrated with Hyperagent.  
   * Agents using Hyperagent can opt‑in to registration; explorer shows agent profiles and basic stats.  
2. T4‑B – Marketplace & Job Routing  
   * Job board live, x402 payments wired into escrow flows.​​  
   * At least 50 real jobs completed through the platform.  
3. T4‑C – Agent Integrations & Governance v1  
   * Connectors for 2–3 external agent frameworks live.  
   * Governance multisig \+ “Core templates” registry formalized.  
   * Early design or pilot of reputation/tokens.

By the end of Timeline 4, Hyperagent is no longer just infra *for* developers; it’s a network where agents themselves discover each other, earn, build reputation, and coordinate on top of your infra stack.​

# Milestone 5

Timeline 5 – Verifiable Intelligence (Deep ZK \+ Cross‑Chain AVS)

By Timeline 5 you already have: multi‑tenant platform, enterprise users, ERC‑8004 registries, EigenDA provenance, and an emerging agent marketplace. Timeline 5 is about turning Hyperagent into fully verifiable AI infra where critical parts of the pipeline are *cryptographically provable*, not just logged.​

Assume this is roughly H2 2027\.

---

## **1\. Goals and Success Criteria**

Primary goal

For high‑value workflows (RWA, large‑TVL DeFi, institutional rails, agentic commerce), Hyperagent can produce cryptographic proofs that:  
– certain checks were run,  
– certain models/tools were called with specific hashes, and  
– results match what was deployed on‑chain.​

Success by end of Timeline 5

* A “Verifiable Mode” that institutions can toggle for their projects.  
* At least 10 high‑value protocols (RWA, DeFi, agentic payment networks) using Verifiable Mode in production.  
* Publicly verifiable proofs (or succinct commitments) for:  
  * Static analysis runs,  
  * Tenderly simulations on specified inputs,  
  * Binding between spec hash, code hash, and deployed bytecode.​

---

## **2\. Scope: What Verifiable Mode actually guarantees**

## **2.1 Verifiable Build & Audit**

Guarantees

* Given input spec hash H\_spec, templates hash H\_tpl, and toolchain version V\_tools, Hyperagent can prove that:  
  * The generated code has hash H\_code.  
  * Static analyzers (Slither/Mythril/Echidna) ran on H\_code with result set R\_static.  
  * No high‑severity issue types were ignored.​

Implementation outline

* Deterministic pipeline subset  
  * Lock versions of analyzers, compiler, and templates for Verifiable Mode.  
  * Run them in a reproducible Dockerized environment.  
* Proof surfaces (phase 1 \= commitments, phase 2 \= ZK)  
  * Phase 1: publish signed attestations (via EigenLayer AVS or your own signers) that “we ran these tools on H\_code and got R\_static,” then anchor them as hashes in EigenDA and ContractRegistry.​​  
  * Phase 2: explore ZK circuits that prove certain properties (e.g., “no state‑changing external call without checks”) based on academic patterns for RL/agents on blockchains.

---

## **2.2 Verifiable Simulation & Deployment**

Guarantees

* A specific deployment tx was pre‑simulated with given inputs and state and produced the same outcome.  
* The deployed bytecode corresponds to H\_code in your artefact set.​

Implementation

* Simulation transcript commitment  
  * Use Tenderly’s simulation API to produce a canonical JSON transcript (inputs, state overrides, outputs).  
  * Hash the transcript and store that hash in EigenDA \+ ContractRegistry as H\_sim.  
* Bytecode binding  
  * At deployment, capture actual bytecode from chain RPC and hash it (H\_bytecode).  
  * Prove (initially via deterministic build \+ signing, later via ZK) that H\_bytecode \== compiled(H\_code, V\_compiler).  
  * Include H\_bytecode in ContractRegistry \+ EigenDA blob.​  
* Lightweight verification contracts  
  * On-chain contracts that, given contractAddress, fetch registry data and assert:  
    * H\_code, H\_sim, H\_bytecode are present and consistent.  
    * Useful for on-chain risk‑based logic (e.g., vault only interacts with “verified” contracts).

---

## **2.3 Cross‑Chain AVS for Verification**

Using EigenLayer‑style AVSs, you can offload heavy proof/verification to a shared security set.

Objective

Make verification cheap and reusable across chains.

Implementation

* Design a Verification AVS that:  
  * Watches EigenDA blobs and ContractRegistry events.  
  * Runs extra checks or light proofs off‑chain.  
  * Signs attestations usable on multiple L2s/L1s.  
* Integrate with:  
  * Mantle, BNB, Avax, SKALE, etc. so they can query the AVS instead of rerunning full analysis.​  
  * Potentially other ZK‑rollups for on‑chain verification of attestations.

---

## **3\. Developer & Enterprise UX for Verifiable Mode**

## **3.1 Simple toggle, clear trade‑offs**

Features

* “Verifiable Mode” toggle when creating a project or blueprint instance:  
  * On → slower, more expensive, but yields proofs and on‑chain attestations.  
  * Off → normal fast dev mode.  
* Show estimated:  
  * Extra time (e.g., \+3–5 minutes),  
  * Extra cost (simulations, DA blobs, AVS fees).

Views

* Per project:  
  * “Verification Proofs” tab: list of attestations, hashes, and links to EigenDA / AVS / Tenderly.​  
* For enterprises:  
  * Policy setting “All mainnet deploys must use Verifiable Mode” for certain blueprints or chains.

---

## **3.2 APIs for external verifiers**

Provide simple APIs:

* GET /verify/contract/\<address\> → returns structured verification status, hashes, and links.  
* Libraries (TS/Python/Rust) that protocols can embed in their own tooling/UI to show “Verified by Hyperagent” badges.

---

## **4\. Alignment with Your Niche and Past Work**

Timeline 5 doesn’t change your niche; it deepens it:

* You’re already focused on infrastructure / AI / x402 / verifiable pipelines.  
* Frontier of Collaboration \+ Protocol Labs and your EigenDA integration make verifiable infra a natural extension.​  
* As agent economies (Timeline 4\) grow, trust in automated decisions will be the bottleneck; verifiable pipelines are your edge.

---

## **5\. Internal Milestones in Timeline 5**

1. V5‑A – Attestation‑Only Verifiable Mode  
   * Deterministic builds, signed statements about tools run and results.  
   * EigenDA \+ ContractRegistry linkage live on 2–3 chains.  
2. V5‑B – Simulation & Bytecode Binding  
   * Canonical Tenderly transcript hashing \+ on‑chain binding for bytecode.  
   * Basic verification contracts for “isVerified(contractAddress)”.  
3. V5‑C – AVS & ZK Exploration  
   * Launch a small Verification AVS with a few partners.  
   * Prototype 1–2 ZK circuits for simple but high‑value properties (no unrestricted delegatecall, correct upgrade pattern, etc.).​

# Milestone 6

Timeline 6 – Global Standard & Regulated-Grade Infra

By Timeline 6, Hyperagent already has: multi‑tenant infra, enterprise customers, ERC‑8004 registries, provenance via EigenDA, agent marketplace, and Verifiable Mode with attestations/ZK. Timeline 6 is about becoming the default global standard for AI‑driven smart contract and agent infra, including regulated and institutional environments.​

---

## **1\. High-Level Goal**

Make Hyperagent the reference standard for AI \+ smart contracts across chains and jurisdictions:  
– adopted by major L1/L2s as canonical infra,  
– trusted by institutions/regulators,  
– operated as a decentralized network with sustainable economics.​

---

## **2\. Success Criteria**

By the end of Timeline 6:

* Hyperagent (or its open protocol) is integrated in the core tooling docs of 5–10 major ecosystems (Mantle, BNB, Avalanche, Solana, Filecoin, etc.) as a recommended way to design/audit/deploy contracts or agents.  
* Tens of thousands of contracts and agents registered via your ERC‑8004 \+ ContractRegistry stack, with $50M+ aggregate TVL managed or influenced.​  
* A decentralized operator set (Hyperagent node/AVS operators) runs the verification and provenance layers, backed by on‑chain incentives and slashing.​  
* At least one regulated‑grade deployment (e.g., RWA issuer, payment rail, or fund) relies on your Verifiable Mode and audit logs as part of compliance evidence.

---

## **3\. Scope: From Product to Protocol \+ Network**

## **3.1 Open Protocol Specification**

Objective  
Fully document and standardize the “Hyperagent protocol” so anyone can implement compatible components.

Work

* Publish open specs for:  
  * Blueprint format and lifecycle,  
  * Pipeline/trace schema,  
  * ERC‑8004 usage pattern \+ ContractRegistry interfaces,  
  * Verifiable Mode attestation formats and EigenDA blob schema.​  
* Submit EIPs / EVM‑agnostic standards (or proposals to other ecosystems) so:  
  * Contract provenance and agent identity are interoperable across tooling (other agent frameworks, audit firms, infra providers).

---

## **3.2 Decentralized Operator Network**

Objective  
Move verification, provenance publication, and maybe even some agent execution to a distributed operator set.

Work

* Define and deploy Hyperagent Node software:  
  * Runs verification tasks (static analysis, simulation replay, proof checking) for Verifiable Mode projects.  
  * Publishes or confirms EigenDA blobs and registry entries.​  
* Token or stake design (building on Timeline 4):  
  * Operators stake to participate; slashed for provable misbehavior (e.g., wrong attestations, downtime beyond SLO).  
  * Fee flows:  
    * Portion of enterprise/usage fees → operator rewards  
    * Portion → treasury (for grants, R\&D, ecosystem incentives).  
* Governance expands:  
  * DAO (or equivalent) with on‑chain control over:  
    * Protocol upgrades  
    * Economic parameters (fees, rewards, slashing thresholds)  
    * Which chains/Blueprints are “core supported.”

---

## **3.3 Regulated & Institutional Flows**

Objective  
Make Hyperagent acceptable to RWA issuers, institutional DeFi, and possibly TradFi‑adjacent rails.

Work

* Build compliance‑grade audit trails:  
  * Immutable, exportable logs suitable for audits (timestamped pipeline runs, who approved what, proofs attached).​  
  * Mappings from on‑chain provenance to legal/compliance docs (e.g., mapping contract IDs to ISIN‑like identifiers for securities).  
* Partnerships:  
  * Work with a small number of RWA/institutional partners (likely grown from earlier timelines) to co‑design “regulated presets.”  
  * Align with standards bodies or consortiums looking at AI \+ blockchain governance.  
* Optional “private mode”:  
  * For some regulated flows, allow encrypted traces (ZK \+ encrypted DA) where only regulators or designated parties can decrypt raw data, but public gets proofs.

---

## **4\. Ecosystem and Community Expansion**

Objective  
Ensure the protocol lives beyond the founding team.

Work

* Grants and ecosystem programs:  
  * Hyperagent Grants: fund new Blueprints, agents, and integrations built by community teams, especially in long‑tail ecosystems.  
  * Educator/mentor programs to onboard more devs into “AI \+ infra \+ x402” niche.  
* Community governance maturity:  
  * Move from core‑team‑driven HIPs to fully community‑driven proposals and voting.  
  * Rotate or expand core multisig to a more diverse, representative council.

---

## **5\. Milestone Examples in Timeline 6**

You can split this phase into three long milestones:

1. L6‑A – Protocol Spec & Reference Implementations  
   * Publish Hyperagent protocol spec, get at least one external implementation (e.g., a third‑party node or alternative client) using it.​  
   * Upgrade internal codebase to speak the spec natively.  
2. L6‑B – Operator Network & DAO Live  
   * Launch Hyperagent node software \+ staking and rewards.  
   * DAO (or similar) controls key protocol parameters and registry governance.  
3. L6‑C – Regulated Use‑Case & Ecosystem Saturation  
   * Close at least one flagship regulated / institutional deployment using Verifiable Mode as part of its compliance stack.  
   * Achieve broad ecosystem adoption: major chains link to Hyperagent protocol/registry in their official docs or tooling pages.

---

By the end of Timeline 6, Hyperagent is:

* A protocol \+ network, not just a hosted app.  
* The de facto standard for verifiable AI‑driven contract and agent workflows across chains, with a path to sustain itself via decentralized operators and community governance.

# KPI Metrics

# **Hyperagent KPIs & Success Metrics**

**Clear, measurable success criteria for each phase of the roadmap**

---

## **Phase 1 – Foundation (Q1 2026\)**

**Goal:** Core Hyperagent SDK and AI assistant deployed and battle‑tested

## **Primary KPIs**

## 

| Metric | Target | Definition |
| :---- | :---- | :---- |
| **Chains Supported** | ≥ 4 | Production adapters for Mantle, BNB, Avalanche, SKALE (+ existing Metis/Hyperion) |
| **End-to-End Projects** | ≥ 8 | Full pipeline runs (spec → code → audit → deploy) for hackathon submissions |
| **SDK Integration** | ≥ 1 | At least one external repo/script using Hyperagent TypeScript SDK |

## 

## **Secondary Metrics**

* **Pipeline Success Rate:** ≥ 85% of runs complete without critical failures  
* **Security Coverage:** 100% of generated contracts run through Slither \+ Mythril \+ Tenderly simulation  
* **Agent Response Time:** \< 5 minutes for simple contract generation (token/NFT)  
* **Hackathon Wins:** Submit to 4 hackathons (Frontier of Collaboration, SF x402, BNB Smart Builders, Avalanche Build Games)

  ## **Validation Criteria**

✅ Developers can go from natural language spec → deployed contract on 4+ chains  
✅ SDK enables programmatic access to pipeline (documented examples exist)  
✅ All outputs include audit reports \+ Tenderly simulation links  
✅ At least 2 hackathon projects use Hyperagent as core infra

---

## **Phase 2 – Acceleration (Q2 2026\)**

**Goal:** Self‑serve platform with ecosystem adoption

## **Primary KPIs**

## 

| Metric | Target | Definition |
| :---- | :---- | :---- |
| **Active Developers** | ≥ 500 | Workspace accounts with ≥1 project run in last 30 days |
| **Deployed dApps** | ≥ 50 | Mainnet contracts deployed via Hyperagent with confirmed on-chain activity |
| **Ecosystem Integrations** | ≥ 3 | Mantle/BNB/Avalanche officially list Hyperagent in docs or hackathon pages |

## 

## **Secondary Metrics**

* **Blueprint Library:** 8+ public Blueprints (Mantle RWA, BNB Infra, Avax Games, SKALE Commerce, PL Verifiable Factory, etc.)  
* **Multi-Chain Usage:** ≥ 30% of projects target 2+ chains  
* **Self-Serve Onboarding:** ≥ 70% of new users complete first project without support tickets  
* **Pipeline Reliability:** ≥ 95% uptime for API gateway and orchestration services  
* **Documentation Coverage:** 100% of Blueprints have working examples in `/examples`

  ## **Validation Criteria**

✅ Developers discover and use Hyperagent without founder involvement  
✅ Ecosystem partners actively refer builders to Hyperagent  
✅ Platform handles 100+ concurrent projects without degradation  
✅ Clear path from hackathon demo → mainnet production

---

## **Phase 3 – Scale & Decentralize (Q3-Q4 2026\)**

**Goal:** Enterprise-grade infra with verifiable provenance

## **Primary KPIs**

## 

| Metric | Target | Definition |
| :---- | :---- | :---- |
| **Enterprise Customers** | ≥ 5 | Protocol teams or organizations using dedicated/org-scoped Hyperagent instances |
| **Total TVL** | ≥ $5M | Aggregate value locked in contracts deployed via Hyperagent (measured via Dune \+ indexers) |
| **On-Chain Registrations** | ≥ 100 | Contracts registered in ERC‑8004 ContractRegistry with EigenDA provenance |

## 

## **Secondary Metrics**

* **Monitoring Coverage:** 100% of mainnet contracts have active Tenderly monitoring \+ alerts  
* **Audit Trail Exports:** ≥ 3 enterprise customers using audit log exports for compliance  
* **Marketplace Blueprints:** ≥ 5 community-contributed Blueprints in marketplace (non-core team)  
* **Multi-Org Workspaces:** ≥ 20 orgs with 3+ collaborators using workspace features  
* **Verifiable Contracts:** ≥ 30 contracts with full EigenDA blob \+ registry provenance

  ## **Validation Criteria**

✅ Enterprises trust Hyperagent for production-grade, high-TVL deployments  
✅ On-chain registries provide cryptographic provenance for contracts  
✅ Community can publish and monetize custom Blueprints  
✅ Platform economics are sustainable (revenue covers infra \+ team)

---

## **Phase 4 – Agent Economy & Governance (2027 H1)**

**Goal:** Hyperagent as agent network, not just human tool

## **Primary KPIs**

## 

| Metric | Target | Definition |
| :---- | :---- | :---- |
| **Registered Agents** | ≥ 10,000 | ERC‑8004 agent identities registered across chains |
| **Active Agents** | ≥ 100 | Agents using Hyperagent pipelines in last 30 days (not just humans via UI) |
| **Jobs Completed** | ≥ 500 | Marketplace jobs matched, executed, and paid (via x402 or escrow) |

## 

## **Secondary Metrics**

* **Agent Marketplace Volume:** ≥ $50k in job payments processed  
* **Reputation Entries:** ≥ 200 validation entries from third-party auditors/validators  
* **Governance Participation:** ≥ 50 unique addresses voting on HIPs or Blueprint curation  
* **Agent Framework Integrations:** ≥ 3 external agent frameworks with Hyperagent connectors (e.g., AutoGen, LangGraph, others)

  ## **Validation Criteria**

✅ AI agents discover, hire, and use other agents via ERC‑8004 \+ Hyperagent marketplace  
✅ x402 payment rails work for automated agent-to-agent commerce  
✅ Community has real governance voice over Blueprints and agent curation  
✅ Hyperagent is "infra for agents," not just "infra for humans building agents"

---

## **Phase 5 – Verifiable Intelligence (2027 H2)**

**Goal:** Cryptographic proofs for high-value workflows

## **Primary KPIs**

## 

| Metric | Target | Definition |
| :---- | :---- | :---- |
| **Verifiable Mode Adoption** | ≥ 10 | High-value protocols using Verifiable Mode in production (RWA, DeFi, institutional) |
| **Attestations Published** | ≥ 500 | Signed attestations for builds/audits anchored to EigenDA \+ ContractRegistry |
| **AVS Integrations** | ≥ 1 | At least one Verification AVS live with cross-chain attestation support |

## **Secondary Metrics**

* **ZK Circuit Proofs:** ≥ 2 properties provable via ZK (e.g., "no unrestricted delegatecall," "correct upgrade pattern")  
* **Verifiable Contracts:** ≥ 100 contracts with full cryptographic provenance (spec hash → code hash → bytecode hash)  
* **Institutional Compliance Use:** ≥ 3 regulated entities using Verifiable Mode for audit/compliance evidence  
* **Cost of Verification:** \< 20% overhead vs standard mode (time \+ gas \+ DA fees)

  ## **Validation Criteria**

✅ High-stakes protocols trust Hyperagent because proofs are cryptographically verifiable  
✅ External verifiers can independently check contract provenance via on-chain data  
✅ AVS makes verification cheap and reusable across many chains  
✅ Verifiable Mode is production-ready, not research-only

---

## **Phase 6 – Global Standard & Protocol (2028+)**

**Goal:** Default standard for AI \+ smart contracts across ecosystems

## **Primary KPIs**

## 

| Metric | Target | Definition |
| :---- | :---- | :---- |
| **Verifiable Mode Adoption** | ≥ 10 | High-value protocols using Verifiable Mode in production (RWA, DeFi, institutional) |
| **Attestations Published** | ≥ 500 | Signed attestations for builds/audits anchored to EigenDA \+ ContractRegistry |
| **AVS Integrations** | ≥ 1 | At least one Verification AVS live with cross-chain attestation support |

## **Secondary Metrics**

* **Protocol Implementations:** ≥ 2 alternative implementations of Hyperagent protocol (non-founding team)  
* **DAO Treasury:** ≥ $2M equivalent for grants, R\&D, ecosystem incentives  
* **Regulated Deployments:** ≥ 5 institutional/RWA use cases with compliance-grade audit trails  
* **Open Source Contributions:** ≥ 100 external contributors to core repos  
* **Network Revenue:** Self-sustaining economics via operator fees \+ marketplace \+ enterprise

  ## **Validation Criteria**

✅ Hyperagent is recognized as the reference standard (like ERC‑20 for tokens)  
✅ Protocol lives beyond founding team via decentralized operators \+ DAO  
✅ Developers choose Hyperagent by default because ecosystems recommend it  
✅ Both Web3-native and regulated/institutional flows trust the system

---

## **Cross-Phase Leading Indicators**

**Track these continuously to predict phase transitions**

* **Developer NPS:** Net Promoter Score from post-deployment surveys (target: ≥ 50\)  
* **Security Incident Rate:** Critical vulnerabilities in Hyperagent-deployed contracts (target: \< 0.1% of deployments)  
* **Ecosystem Referrals:** Inbound projects from ecosystem partners vs self-serve (target: 30%+ from partners by Phase 3\)  
* **Agent Diversity:** Number of unique agent frameworks/tools using Hyperagent APIs (target: 5+ by Phase 4\)  
* **Cost per Contract:** Fully burdened cost to generate \+ audit \+ deploy (target: trending down 20% per phase)  
  ---

  ## **How to Measure**

**Data Sources:**

* **Supabase:** `workspaces`, `projects`, `runs`, `deployments` tables track user activity and pipeline metrics  
* **Dune Analytics:** On-chain contract interactions, TVL calculations, registry entries  
* **ContractRegistry:** On-chain counts of registered contracts, EigenDA blob references  
* **Tenderly:** Monitoring alerts, simulation success rates, runtime metrics  
* **OpenTelemetry \+ Grafana:** Service uptime, latency, error rates  
* **ERC‑8004 Registries:** Agent identity counts, reputation entries, validation records  
* **Marketplace Analytics:** Job postings, completions, payment volume (via x402 or escrow contracts)

**Dashboards:**

* Internal: Real-time KPI dashboard (Grafana \+ custom Next.js views)  
* Public: Quarterly transparency reports showing ecosystem growth, security stats, and decentralization progress

# Skills.md(Agents)

https://skills.sh/wshobson/agents/langchain-architecture  
https://skills.sh/sickn33/antigravity-awesome-skills/langgraph  
https://skills.sh/langchain-ai/deepagents/langgraph-docs  
[https://skills.sh/wshobson/agents/gitops-workflow](https://skills.sh/wshobson/agents/gitops-workflow)  
[https://skills.sh/julianobarbosa/claude-code-skills/gitops-principles-skill](https://skills.sh/julianobarbosa/claude-code-skills/gitops-principles-skill)  
[https://skills.sh/davila7/claude-code-templates/senior-devops](https://skills.sh/davila7/claude-code-templates/senior-devops)  
[https://skills.sh/jeffallan/claude-skills/devops-engineer](https://skills.sh/jeffallan/claude-skills/devops-engineer)  
[https://skills.sh/othmanadi/planning-with-files/planning-with-files](https://skills.sh/othmanadi/planning-with-files/planning-with-files)  
[https://skills.sh/composiohq/awesome-claude-skills/file-organizer](https://skills.sh/composiohq/awesome-claude-skills/file-organizer)  
[https://skills.sh/wshobson/agents/prometheus-configuration](https://skills.sh/wshobson/agents/prometheus-configuration)  
[https://skills.sh/sickn33/antigravity-awesome-skills/api-documentation-generator](https://skills.sh/sickn33/antigravity-awesome-skills/api-documentation-generator)  
[https://skills.sh/wshobson/agents/fastapi-templates](https://skills.sh/wshobson/agents/fastapi-templates)  
[https://skills.sh/jezweb/claude-skills/fastapi](https://skills.sh/jezweb/claude-skills/fastapi)  
[https://skills.sh/pluginagentmarketplace/custom-plugin-blockchain/smart-contract-security](https://skills.sh/pluginagentmarketplace/custom-plugin-blockchain/smart-contract-security)  
[https://skills.sh/pluginagentmarketplace/custom-plugin-blockchain/solidity-development](https://skills.sh/pluginagentmarketplace/custom-plugin-blockchain/solidity-development)  
[https://skills.sh/github/awesome-copilot/mcp-cli](https://skills.sh/github/awesome-copilot/mcp-cli)  
[https://skills.sh/wshobson/agents/debugging-strategies](https://skills.sh/wshobson/agents/debugging-strategies)

**VISUALIZATION:**  
[https://skills.sh/softaworks/agent-toolkit/c4-architecture](https://skills.sh/softaworks/agent-toolkit/c4-architecture)  
[https://skills.sh/sickn33/antigravity-awesome-skills/c4-component](https://skills.sh/sickn33/antigravity-awesome-skills/c4-component)  
[https://skills.sh/antvis/chart-visualization-skills/infographic-creator](https://skills.sh/antvis/chart-visualization-skills/infographic-creator)  
[https://skills.sh/softaworks/agent-toolkit/mermaid-diagrams](https://skills.sh/softaworks/agent-toolkit/mermaid-diagrams)  
[https://skills.sh/aj-geddes/useful-ai-prompts/architecture-diagrams](https://skills.sh/aj-geddes/useful-ai-prompts/architecture-diagrams)  
[https://skills.sh/aj-geddes/useful-ai-prompts/data-visualization](https://skills.sh/aj-geddes/useful-ai-prompts/data-visualization)  
[https://skills.sh/refoundai/lenny-skills/behavioral-product-design](https://skills.sh/refoundai/lenny-skills/behavioral-product-design)  
[https://skills.sh/sickn33/antigravity-awesome-skills/behavioral-modes](https://skills.sh/sickn33/antigravity-awesome-skills/behavioral-modes)  
[https://skills.sh/thebushidocollective/han/structural-design-principles](https://skills.sh/thebushidocollective/han/structural-design-principles)

**DATABASE:**  
[https://skills.sh/sickn33/antigravity-awesome-skills/api-documentation-generator](https://skills.sh/sickn33/antigravity-awesome-skills/api-documentation-generator)  
[https://skills.sh/supabase/agent-skills/supabase-postgres-best-practices](https://skills.sh/supabase/agent-skills/supabase-postgres-best-practices)  
[https://skills.sh/aj-geddes/useful-ai-prompts/database-schema-documentation](https://skills.sh/aj-geddes/useful-ai-prompts/database-schema-documentation)  
[https://skills.sh/softaworks/agent-toolkit/database-schema-designer](https://skills.sh/softaworks/agent-toolkit/database-schema-designer)

**ICONS:**  
[https://skills.sh/better-auth/better-icons/better-icons](https://skills.sh/better-auth/better-icons/better-icons)  
[https://skills.sh/raphaelsalaja/userinterface-wiki/morphing-icons](https://skills.sh/raphaelsalaja/userinterface-wiki/morphing-icons)

**MCP:**  
[https://skills.sh/anthropics/skills/mcp-builder](https://skills.sh/anthropics/skills/mcp-builder)  
[https://skills.sh/figma/mcp-server-guide/implement-design](https://skills.sh/figma/mcp-server-guide/implement-design)  
[https://skills.sh/sickn33/antigravity-awesome-skills/agent-memory-mcp](https://skills.sh/sickn33/antigravity-awesome-skills/agent-memory-mcp)

**Devs:**  
[https://skills.sh/tursodatabase/turso/pr-workflow](https://skills.sh/tursodatabase/turso/pr-workflow)  
[https://skills.sh/qodex-ai/ai-agent-skills/branch-finalization](https://skills.sh/qodex-ai/ai-agent-skills/branch-finalization)  
[https://skills.sh/troykelly/claude-skills/branch-discipline](https://skills.sh/troykelly/claude-skills/branch-discipline)  
[https://skills.sh/wshobson/agents/github-actions-templates](https://skills.sh/wshobson/agents/github-actions-templates)

# Solution hard to scaling project itself

## **Core positioning: "Chain-agnostic AI contract infrastructure, optimized per ecosystem"**

**Global tagline:**  
*"Hyperagent: The AI-native smart contract platform for multi-chain deployment. From natural language to production-ready, audited contracts across any EVM chain and beyond."*

**Key principles:**

* Core platform is **chain-agnostic by design** (supports EVM, with Solana/Move/Rust/Cadence coming).  
* But **deployment templates, compliance modules, and ecosystem integrations are chain-specific** to maximize value per network.  
* This mirrors how Alchemy, Thirdweb, or QuickNode operate: one infra layer, ecosystem-specific optimizations.

---

## **1\. Reframe the verticals globally, with Mantle as first showcase**

## **Hyperagent Product Suite (Chain-Agnostic)**

| Product | What It Does | Chain Coverage |
| ----- | ----- | ----- |
| **RWA Issuer Launch Kit** | Spec → ERC-20/4626/tokenization → audit → deploy | All EVM (Mantle, Arbitrum, Base, Polygon, etc.) |
| **DeFi Safety Pipeline** | Lending/AMM/DEX protocols → security validation → multi-chain deploy | EVM \+ Solana (coming) |
| **NFT & Gaming Contract Studio** | Game assets, marketplaces, rewards → optimized per chain gas models | EVM \+ Solana/Immutable |
| **DAO Governance Factory** | Governor contracts, token voting, multi-sig → tailored per ecosystem | EVM initially |

**Then add:**

**Mantle Optimization Focus (2026 Q1-Q2):**  
We're launching with deep Mantle integration as our first production-ready vertical because Mantle's RWA and institutional DeFi focus aligns perfectly with our audit-first, compliance-aware agent design. This includes:

* Pre-built Mantle RWA templates (security token, stablecoin, fund tokenization)  
* Direct integration with Mantle's MNT gas sponsorship for deployers  
* Mantle-native dashboards via Dune Analytics for all Hyperagent-deployed contracts  
* Co-marketing: Hyperagent as the default contract pipeline for Mantle EcoFund/Grants recipients

This shows: **global capability, Mantle-first execution.**

---

## **2\. Multi-tenant story: global platform, per-chain workspaces**

Reframe as:

**Hyperagent is a multi-tenant, multi-chain SaaS platform:**

* Each project gets a **workspace** with isolated API keys, pipelines, and deployment configs.  
* Projects choose their **target chains** at setup (Mantle, Arbitrum, Base, Polygon, etc.).  
* Templates auto-adapt: Mantle projects get MNT-optimized gas strategies, Arbitrum gets Nitro-specific patterns, etc.  
* **No lock-in**: one project can deploy the same contract logic to multiple chains from a single spec.

**UX Flow (Global):**

`New Project Wizard`  
  `├─ Step 1: Select primary chain(s)`  
  `│    └─ Mantle / Arbitrum / Base / Polygon / Multi-chain`  
  `├─ Step 2: Choose vertical`  
  `│    └─ RWA / DeFi / NFT / DAO / Custom`  
  `├─ Step 3: Configure compliance & audit level`  
  `│    └─ Regulatory (RWA) / Standard (DeFi) / Fast (NFT)`  
  `└─ Step 4: Deploy pipeline spins up`  
       `├─ Chain-specific templates loaded`  
       `├─ Agent workflows configured`  
       `└─ Ready to generate + audit + deploy`

**For Mantle specifically:**  
The wizard has a "Mantle Accelerator" preset that auto-configures RWA \+ institutional DeFi templates and connects to Mantle's grant/gas sponsorship programs.

---

## **3\. Infra scaling: global by default, region/chain-optimized**

Present your architecture as:

**Hyperagent Infrastructure: Globally Distributed, Chain-Aware**

`Global Control Plane`  
  `├─ Multi-region API (US, EU, APAC)`  
  `├─ Agent orchestration (LangGraph + queue workers)`  
  `└─ Shared services (auth, billing, observability)`  
      `│`  
      `▼`  
`Chain-Specific Deployment Adapters`  
  `├─ Mantle deployer (RPC, gas oracle, MNT integration)`  
  `├─ Arbitrum deployer (Nitro-specific optimizations)`  
  `├─ Base deployer (Coinbase integration, ENS)`  
  `└─ Polygon deployer (zkEVM support)`  
      `│`  
      `▼`  
`Data & Verification Layer (Global)`  
  `├─ EigenDA (cross-chain telemetry, agent traces)`  
  `├─ EigenCloud (ZK proof generation for all chains)`  
  `└─ Multi-chain observability (Dune, OpenTelemetry)`

**Scaling characteristics:**

* **Horizontal**: Stateless workers scale per workload, not per chain. One Hyperagent cluster serves all chains.  
* **Per-chain optimization**: Each chain adapter is independently versioned and can be updated (e.g., Mantle gas improvements) without touching other chains.  
* **No single point of failure**: Multi-region control plane, EigenDA for data availability across chains, Redis/queue for job distribution.

**For Mantle pitch:**  
"Because we're chain-agnostic, adding Mantle-specific optimizations (gas sponsorship, RWA templates, Dune dashboards) doesn't slow down other chains it's just one more adapter in our system."

---

## **4\. Ecosystem impact: Mantle as case study, metrics that generalize**

Instead of Mantle-only metrics, use:

## **Global Metrics (Platform-Wide)**

* **Total projects launched** across all chains  
* **Total contracts deployed** (audited, production)  
* **Total TVL/volume** in Hyperagent-generated contracts  
* **Security incidents prevented** (via automated audit catches)

## **Chain-Specific Metrics (Mantle as Example)**

* **Mantle projects launched via Hyperagent**: X  
* **Audited contracts deployed on Mantle**: Y  
* **TVL in Mantle contracts generated by Hyperagent**: $Z  
* **Mantle EcoFund/Grant recipients using Hyperagent**: N%

**Positioning for Mantle:**  
"We track these metrics globally, and we'll share Mantle-specific dashboards with the ecosystem team to show how Hyperagent is driving RWA/DeFi growth on Mantle specifically."

---

## **5\. Programmatic integrations: global product, Mantle pilot**

Frame it as:

**Hyperagent Ecosystem Integration Strategy (Multi-Chain)**

We partner with L1/L2 ecosystems to offer Hyperagent as **official infrastructure** for their builder programs. This includes:

* **Hackathon integration**: Every hackathon participant gets Hyperagent credits for contract generation \+ audit.  
* **Grant/Accelerator bundling**: Projects receiving ecosystem grants get free or discounted Hyperagent pipelines.  
* **Developer onboarding**: Hyperagent becomes the default "new project" flow in ecosystem docs.

**Mantle as Launch Partner (2026 Q1):**

* Hyperagent integrated into Mantle Global Accelerator and EcoFund onboarding  
* All Mantle hackathon projects can use "Hyperagent for Mantle" preset with pre-configured RWA/DeFi templates  
* Co-branded marketing: "Powered by Hyperagent" badge for Mantle projects using the pipeline  
* Success here becomes the template for Arbitrum, Base, Polygon partnerships in Q2-Q3

This shows: **Mantle is the pilot, not the only customer.**

---

## **6\. Updated one-pager structure**

## **Slide 1: Problem** 

"Smart contract development is slow, risky, and expensive across all chains. Teams struggle to go from idea → audited code → production in under 4-8 weeks, limiting Web3 innovation velocity."

## **Slide 2: Solution** 

"Hyperagent: AI-native contract infrastructure that takes natural language specs → production-ready, audited contracts → multi-chain deployment in days, not weeks. Chain-agnostic core, ecosystem-optimized templates."

## **Slide 3: Product Suite** 

\[Table from section 1 above, with note: "Mantle RWA templates ready now, other chains rolling out Q2-Q3 2026"\]

## **Slide 4: How This Scales**

* Multi-tenant SaaS (workspaces per project, chain selection)  
* Horizontally scalable infra (stateless agents, queue workers, k8s)  
* EigenDA/EigenCloud for cross-chain verifiability  
* Per-chain deployment adapters (Mantle is first production-ready)

## **Slide 5: Mantle Ecosystem Impact (Mantle-Specific)**

* "We're launching on Mantle first because of RWA/institutional focus alignment"  
* Metrics: \# projects, \# contracts, TVL on Mantle  
* Integration: EcoFund/Grants bundling, hackathon preset, co-marketing  
* Timeline: Mantle optimization Q1-Q2, other major EVMs Q2-Q3

## **Slide 6: Traction & Roadmap**

## Current: Mantle \+ 3 other EVM testnets

* Q2 2026: Arbitrum, Base, Polygon production-ready  
* Q3 2026: Solana/Move support  
* Long-term: Become the "Vercel for smart contracts" any chain, any vertical

---

## **Summary: How to talk to Mantle vs. others**

**To Mantle:**  
"Hyperagent is a multi-chain AI contract platform, and we're choosing Mantle as our **launch ecosystem** because your RWA and institutional DeFi focus matches our audit-first, compliance-aware design. We'll optimize our templates, integrations, and go-to-market for Mantle first, prove the model, then expand to other chains. This makes Mantle the reference implementation for how Hyperagent integrates with L2 ecosystems."

**To other chains (Arbitrum, Base, Polygon, etc.):**  
"Hyperagent is chain-agnostic AI contract infrastructure. We've proven the model on Mantle \[show metrics\], and now we're expanding. We can offer you the same programmatic integration: templates optimized for your ecosystem, hackathon/grant bundling, co-marketing. The platform already supports EVM; we just need to build your chain-specific adapter and templates."

**To investors/broader market:**  
"Hyperagent is the first globally scalable, verifiable AI platform for smart contracts. We're not a single-chain tool we're infrastructure that works across any EVM chain (and soon non-EVM). Our go-to-market is ecosystem-by-ecosystem partnerships, starting with Mantle, to build the network effect of templates, agents, and security patterns that make us the default for contract generation everywhere."

This way, sees as committed and optimized for them, but you're never locked in or small-scale in positioning.

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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NmsuA04hQ0fud4JG93npr64KttXagw74jjFrp9ExW4WA89u5c9+uxtugQYMic4iIiNLCBZz8qOiz5YDIlTC5L8dmznzZOm4bM8dNzIBTxN3eNtbMuAsEnN9y9Q0REV0sZMB9ZZs9gvFlHyyLxJCJ3r/gvCti18nbaOLGNfUCzqSZ+9I0mo9DnecZM2YGzpnzZkPfeOPNyPOlnzMCLjl/8INTqvF2553jInOIiIg2cx1wpua4ido3P6khex1RmT59Zmhef5Q2otGaegEXd1+2Y7704izrWhfUedZXedpRP2cEXHKq87rOOutExhEREePMdcDZkONq3/yk9hh0aGzAyeBqhLwviTyeeV+2cbltG7PNN4M6z+28hbrpppsGEUfAJefIkf8ThDEiImKzFj7gli3rqhtAev+yS66OzGlcxzXyHzEc/90fBduaf/zjzdD+nrsfWlm1alWwr6j3+Jul3YDT6ogj4JJRnctRo06LjCMiItYztwG39VYD5VCVuHEVPrY5GURqjRo75eSzreMSNW47rkLP2ebNx9O3z66VpUs/COYOPvC40G3OPP3C6vrfXHFddd92vEYkFXBKHXEEXHuab0sjIiK6mNuAS4ITRpxqjbIikmTArbVWTwKuTSdNerJ6Ds8448zIHCIiYiNLG3Aq3MoSb4okA04dS8XH6NGjCbgW5eobIiK2Y2kDrmykEXD6KhwB5646d9OnPxcZR0REbEYCriQkHXBrrtmdgGtRdd422mijyDgiImKzEnAlIemA23XXPQi4FuzXrx9vnSIiYtsScCUh6YBT/40IAecuP/uGiIhJSMCVBAIue3v06FE9Zx980BWZQ0REdJGAKwlpBdzw4cMJuCa87bbbq+frlltujcwhIiK6SsCVhDQC7j//8z+rUULANZa3ThERMUkJuJKQRsDdcccdBFwTLlu2vHqeFi1aEplDRERsRQKuJKQRcOoFQ8A1Vp2jrbfuGxlHRERsVQKuJKQZcI888oi8u0zwMeA233wL3jpFRMTEJeBKQpoBt/nmm8u7ywQfA06dn27dukXGERER29GLgMPOmFbAKX1Af57y8WYl/3ABERHTUn2/yzTgTM3AwHSV595FM+D0v0T1AZ8C7rTTTq+el6lTn4nMISIitisBV1LluXfRDLibbrqJgLPI1TdERExTAq6kynPvohlw+m3U3/72t/Kl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>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnAAAAEUCAYAAACrngtyAAAnmUlEQVR4Xu3dD7A1d13f8QMytGiV0U7/MVFDnvPvPnmS6gTB5LnnPjdFSQO0tBSsVEFsmYKVf00VCRAsbQnEP9jK8EexUKEUdaCOTCJFZghjS62xSkgCCIrJFC2EPymxOpOkhKf3d577O89vv3f33D3nu+f8Prv7fs3s7Nnf7tmz+/n87rk7N4EMBgAAAAAAAAAAAAAAAAAAYGHnxN6/Ho9nZ/uw2HtHM2zOXV0m49kD9t7V2Xvo6jIc7l5j712Bvc6uLhdeeMW32XtXYq+3q8t0tPsFe+9NsZ/V1WU0Ov02e++SwsX2SbhfmwF8mEO6+tbNZDL7lM0gl5MnTz68f/nv/qDNQUHfetjEdxQZCuppKY+0OWB9H/3ox23MndamOWSvveuUuunbd2uglH+qb1289Edf3XgPfctQdS4X9LgU7WJaxGbcdW2aQ/bauy7p5qE2i23r23droPpLr49dDBr+jupbhslcfrjNQkaPS2lsYvedzbjr2jSH7LV3nVI3fftuDZTyT/Wxi0HDPfQtQ9W5XEAp8LIZd12b5pC99q5T6qZv362BUv6pPnYxaLiHvmWoOpcLKAVeNuOua9McstfedUrd9O27NVDKP9XHLgYN99C3DFXncgGlwMtm3HVtmkP22rtOqZu+fbcGSvmn+tjFoOEe+pah6lwuoBR42Yy7rk1zyF571yl107fv1kAp/1Qfuxg03EPfMlSdywWUAi+bcde1aQ7Za+86pW769t0aKOWf6mMXg4Z76FuGqnO5gFLgZTPuujbNIXvtXafUTd++WwOl/FN97GLQcA99y1B1Lhdsq5SXX/taO5RFK0ppGZvxceJcCOu4lG2npqPqeVp2/Ca1aQ7Za18mZNx0lk2f7zhK3dT9bq2a81Ve/MJX2qFjrXJ+a5X3KuWfqttFKr3vn7zhjcmeaul7ln1nBbZ3ux0cd45lBg33sE6G1rLv+Cp1MqhzzKpU53JBE6XUEQN+0Quum79+ypOfvRiP++x6E1pRSsvYjJep6rZO9+kx6XHp9hOv+r4j5/j+f/T8+brs/emxX/nKg4vXy7RpDtlrr5LmcPUTzmeYrq/67mcsjrH5h5/rdLss6/vvf6B0PL6O20/5O88unP/zn//i2de8+vWL7WWUuqn73XrPPV9evLaZxNcPPvjgYjt9gLPHpeOp9Lh0+3GPedJi2+77nqc9t7Bdh1L+qbpdpMqy/fSn7zoy/oHf+M3Cdlhu/uCHC5ldeeZpRzKs2n7sZU8sbNvj6ho03MM6GZZJ78dmuWz/sn02o/e8+6bC9jpU53JBU6UcJwZ86anHL8Ze8bIbFq9/9t/+wpESNqEVpbSMzXiZ2PElJ68sHV9lDix7j/1Bt2MebZpD9tqr2Lzsdl322HXPE9x22yfs0LGUuqn73Vr2ABe979c/WBg7tXNl6V/g7PvK2J+D733680rHq9Z1KOWfqttFKtz3T9zwxrOv+vGftrsWbDarzPe4/yO/d0dh267XNWi4h3UyLFN1f3a87rpszJ57HapzuaCpUo6TBvrsZ714vm1Dttub0IpSWsZmvEzsvarrqvEg7gvzJ91e9p7gd265dX7M/uyp8+34/ijsC8fU1aY5ZK+9Spqh7WdZvi/44ZfbobOv/9m3lnYT/gIX2Q7K8AB3dCy8XvYA97E7PnnkHLFPe56yjtJtu65DKf9U3S5SZfdvs1i2bfdZ9vz2eLu9qkHDPayTYZnj7ve4dVSWdfzDgD12HapzuaCpUqq89vrXz5cYaHh9112fWWy/8rqfnK/5C1x72YzreNLVz7RDi3kS1in7Axz2X/PiHy+Mx/fYY+06iHPydT/1c4t9q8y9Ns0he+1V4v1/x2VXF7bT13Uyssem3aQPcLHr//C2Xzly3Kp9pJS6qfvdGh7g0u/IIGYR/wK3M9lbjIUHuPg6rP/uk38gvq00u3T7u678nmTPOT9yzavm62U/Q/ZnsopS/qm6XaRsjunYT7z2DYXt6M/+7M/n/3rQH/7BnUfmtBXH7r77C4XtyPawqkHDPayTYZl4P+FfjUjnlb3fqvU/fvY1hW37uimqc7mgqVLaohWltIzNuI3Sh4vjtGkO2WvvOqVumvpufc4P/gs7VOmfPudH7dAR6S+7+O/ANUUp/1RTXbTJoOEe2pJhUw9zqnO5oC2lNKUVpbSMzbjr2jSH7LV3nVI3yt+t4ZdcU7/oUkr5p5S72JRBwz30LUPVuVxAKfCyGXddm+aQvfauU+qmb9+tgVL+qT52MWi4h75lqDqXCygFXjbjrmvTHLLX3nVK3fTtuzVQyj/Vxy4GDffQtwxV53IBpcDLZtx1bZpD9tq7Tqmbvn23Bkr5p/rYxaDhHvqWoepcLqAUeNmMu65Nc8hee9cpddO379ZAKf9UH7sYNNxD3zJUncsFlAIvm3HXtWkO2WvvOqVu+vbdGijln+pjF4OGe+hbhqpzuYBS4GUz7ro2zSF77V2n1E3fvlsDpfxTfexi0HAPfctQdS4XUAq80v8n+T5o0xyy1951St307bs1UMo/1bcuPvGJP2y8h75lqDqXCygFXswhXc965ovs5XeaUjej0ezm8P/I3ydK+af4jvIjQ0EXX3zVN4UL/aV3/drZO+74ZKcXU4huKS0zGe/+Scj2Qx/6rSOZd21p2xwK1xsWex9dW97y8++U7KYv+b/qX77O5v8NJorswvX97u/efuTau7Tccsut8x6mw9O3Dhr+Obj00if81T7M5fAspPhdcpz0Yje+jE9cbgPa9vJ1AzTNZrzRRWAOtcVDBkevfaML3RR8zeDo9W10If9K9jo3unS0B/sZG106muFG2Avf2JK5lPCFis2wWW9syTyH2sjew8YWujliqw/R5L+Uvd6NLR3uwX7WxpbMGfKsUCb8d/jsGLAK5pAuusmL/DXQgx8ZCqIUeDGHdNFNXuSvgR78yFAQpcCLOaSLbvIifw304EeGgigFXswhXXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLaTaE/hWtAObrJi/w10IMfGQraVinp52ziMw/O+X8P1/Nz23UqjE1Gs5ccGR/PPmzHPMo+21onl3Xes0kK14BydJMX+WugBz8yFLStUo576Dg53Pt2OxZMR3tPPf96dvbgIev56f5oeuQBbu+Pk31n7Wfa7flYyQPcZHJ6El+fP/fydVR2z9Ph7NrzR5y/toPlC+l43Jeu7bh9nYvCNaAc3eRF/hrowY8MBW2rFPvQMR3u7seHlzBW9QA3Ge29Ir5OHmjus9c9PXyAK5N+Tnxt3z/fV/IANz2xd8V8fe499yWvC+dM11G6bfdF9lxlY/a99tj5ejy73p5nW3J8Juqhm7zIXwM9+JGhoG2VsnjQOHggmh4+bE1OnL4y7g8PcDvj2TvidioeNxnP3h7WZQ8q8ZxlDzfp63Ts5PD0xfH1fF/yALcznP1qui9V8tlHzm236xxjx+za7revc1G4BpSjm7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdCDHxkKohSsIsyXuKRj6THQQTd5kb8GevAjQ0HpL2QWllWWdA6lcwo66CYv8tdAD35kKIhSsIowXyYnZqftWLoNHXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdCDHxkKohR4MYd00U1e5K+BHvzIUBClwIs5pItu8iJ/DfTgR4aCKAVezCFddJMX+WugBz8yFEQp8GpiDk2nj//LdqwJda9tZ7z7LDvWlLrXEKxybB1Nnw+rIX8N9OBHhoIoBV6eOZS+155nOp49/3D8i3HfkWMOtndO7J8qGy97X1xPhrOnpPvjA1zYnpw4c2XZ+eI6XRbvGc1+xhxT+Oywff5s9r53n2GPTfd7NHUerIf8NdCDHxkKohR4eeZQ8UHGPDQdPMClY5PR7suPHFPx2SeHe98e1nZ/3A4PcOm2/QtcHF/sH82uS/en++quUwdjD5TtS97zB+n4uuz5sV3kr4Ee/MhQEKXAyzOH0vfa89gHuPnYMduRfYCbDnf30/3VD3BP/5p0PKx3hqe/89y+ovSYZeN2/+FY4QFuMp69Jd2e8gDXCeSvgR78yFAQpcDLO4emw9lVB8v16Xa6347Z/dPhmcvT7Srp++b/CLXkcwI7Xuf+hsP9C+zYMvEBbv664jqaUOfasTnkr4Ee/MhQEKXAq41zKP4F7jibuLdwzk2ct8y2PgflyF8DPfiRoSBKgRdzSBfd5EX+GujBjwwFUQq8mEP5HXRwox0L6CYv8tdAD35kKIhS4MUcyi90cG7Ze6odT7exXeSvgR78yFAQpcDr/MMDi8qSdpN2he0ifw304EeGgigFXsyh/Moe3uJ4uo3tIn8N9OBHhoIoBV7MofyqOqgax3aQvwZ68CNDQZQCL+aQLrrJi/w10IMfGQqiFHgxh3TRTV7kr4Ee/MhQEKXAizmki27yIn8N9OBHhoIoBV7MIV10kxf5a6AHPzIURCnwYg7popu8yF8DPfiRoSBKgRdzSBfd5EX+GujBjwwFUQq8mEO66CYv8tdAD35kKIhS4MUc0uXpJrw3LnbfptT9rLrHrWMy2n2hHVvXJq8T9dGDHxkKohR4MYd0ebqpeu9ktPeKsLb77XYUjo9L2A7Hxdcp+7CYvg7Hh+3xePciu88eF9Y7w90fi9txv31PPNbez8H6xvn7xrOXxePXVZUJtose/MhQEKXAizmky9NNeO/B8t/NduFhaGe092/S7XXZ825qPRnN/pW9VrvNX+C6hx78yFAQpcCLOaTL0419b9i2D0TpvnR7Vfa89nx2vGptxfGdndnfCGse4PqJHvzIUBClwIs5pMvTTXhvXNLxCy64/BHp/rJj7XvsPrs/PDTZ8bL3nN/e+5w57qvptn2dPsDF8fTc8fjocP//s+OrKjs3to8e/MhQEKXAizmkqyvdrHIfB8fea8dyWeW6sTn04EeGgigFXswhXXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF91sR8h5f3//YWXjdgzbRw9+ZCiIUuDFHNJFN9sRco7Lznjviel4ehzyoAc/MhREKfBiDumim+0oPMCNZi9Jx9PjkAc9+JGhIEqBF3NIF91sR8h5Mpo9r2zcjmH76MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdCDHxkKohR4MYd00U1e5K+BHvzIUBClwIs5pItu8iJ/DfTgR4aCKAVezCFddJMX+WugBz8yFEQp8GIO6aKbvMhfAz34kaEgSoEXc0gX3eRF/uVsLnY7qhpfpuw9ZWNB1XiqzjF9QA6CKAVezCFddJMX+R+1Sib2WLtdV9X7lozfacf6riorZEQp8GIO6aKbvPqS/6kTe988mcwujfcb1zvD2T8vHlmeiR2z57Hr1MHYZ8z2vYfrxbH2/XZdctydi7Hh7NXpvp3R7Dpz7JFr6qK+3GerUAq8mEO66Cavrucf7i/eY3iAs+PpQ86yBx6777h16mDsf6Tj08MHuJR9f8n6T8PrZPvOxXvNA9xifHHs3nPT8a6y9w8BlAIv5pAuusmrT/nbB7h0X6psn32gqhq3+8tM13uAK6zT/66tfYA7WN9c3OYBDplQCryYQ7roJq8+539yePpiO3ac8J6wNJ1bnfNNJnuPtmPWOvfUFXUyxJZRCryYQ7roJi/yX03IKy52n0fT5+sjMhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6KG+6WjvvXYsIENBlAIv5pAuusmL/DXQQ30hq7jY8XQbAigFXswhXXSTV/rLkIWlpcufx7ls5zcyoxR4MYd00U1e5K+BHupLHtzutuPpNgRQCryYQ7roJi/y10AP9VVlVTWOjCgFXswhXXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdCDHxkKohR4MYd00U1e5K+BHvzIUBClwIs5pItu8upr/vG+m77/nUdf8a12rI4mrqOJc7RZ3+9fEqXAizmki27y6mv+9r7TB7p0SY8pkx5n3zsdzq61xxxu32vPPT9mun/h4fvOVJ03fY9V9h57TJf17X5bgVLgxRzSRTd59Tn/w4ecT8XXZeu64vHpX+DiA9xi+/y57w3rndHsTXaffV22XcWc4z+l+/qgbk7YIkqBF3NIF93k1ff87QObXdcVj9/EA1xUNR6V7T8Y+4wd66qy+0dmlAIv5pAuusmrr/kf3PdXzUPTV8vWyf5CTslx8aFscfxi33DvpXbs8PWXw7rqAS5ux/fsjGfvMNdqjz362efur3APXWdzgQBKgRdzSBfd5EX+GujBjwwFUQq8mEO66CYv8tdAD35kKIhS4MUc0kU3eZG/BnrwI0NBlAIv5pAuusnL5j81/24YtoPM/chQEKXAizmki27yivmHtV3K9tuxsvNUjR2e41Y7Nl+PZy+zY5PR7KbJZHa67PiyscPz1xo7d4Z6Y5s8R9nYuTMcHQtZhEzsvpCdHTtc31oyVnn+srH5+WuOnTtDvbFNnCM9FiIoBV7MIV10k5f9BckvwjzI3I8MBVEKvJhDuugmr7L8p8Mzl9sxbFZZD1gNGQqiFHgxh3TRTV7kr4Ee/MhQEKXAizmki27yIn8N9OBHhoIoBV7MIV10kxf5a6AHPzIURCnwYg7popu8yF8DPfiRoSBKgRdzSBfd5EX+GujBjwwFUQq8mEO66CYv8tdAD35kKIhS4MUc0kU3eZG/BnrwI0NBlAIv5pAuusnLm394/3S491I7Xpf384ODc9x3uC79r0gkx1V+1rJ91sGxNyava79vmabO02dkKIhS4MUc0kU3eXnyr3pQ2rb086teH2fFYxcPcMFkvPeGdHsdq3w+ypGhIEqBF3NIF93k5cm/6r3Jg929cXs62n3zZHL6UePx7t/cGc2uq3rvMofn+Q07nip7gKtal40drP9jeL2/v/+w5JgHKo49cr51NXGOviNDQZQCL+aQLrrJq4n87TnKtsMDXHgdHuDKjqnruPel++0Dll2XjYV1+IvauWsu/6zp4V/g7Hs9mjhH35GhIEqBF3NIF93k5cl//pAz3R2nDzLpg8/89Xj2uulo77fqPMCl7y0bs/uidLzsddU6vi77jIP1jenYZDj7obi9M9z9Z2F7PD7zHfPt0ey/xvOtq+reUB8ZCqIUeDGHdNFNXl3IP+c9NPXZTZ2nz8hQEKXAizmki27yIn8N9OBHhoIoBV7MIV10kxf5a6AHPzIURCnwYg7popu8yH/7pqPdJx8dowcvMhREKfBiDumim7zIf/tC5jZ3u43VkaEgSoEXc0gX3eQV8g//y1CW7S3xAS6d+/wc+JGhIEqBF3NIF93kRf7bV5Z52RhWQ4aCKAVezCFddJMX+WugBz8yFEQp8GIO6aKbvMhfAz34kaEgSoEXc0gX3eRF/hrowY8MBVEKvJhDuugmL/LXQA9+ZCiIUuDFHNJFN3mRvwZ68CNDQZQCL+aQLrrJi/w10IMfGQqiFHgxh3TRTV7kr4Ee/MhQEKXAizmki27y6kv+k9Hsf9kxJX3pYZPIUBClwIs5pItu8lLKfzravT1cT1jbfV2n1ENbkaEgSoEXc0gX3eSlln96PfOHueHstnT/ZDS7KR5TuR7O/ls8fjrefU18vRgTu+dA8ZrahgwFUQq8mEO66CYvtfzt9Uwms9OF7YMHuPh6/oB3uMTtxXGT2aXpvjIHD3p32bFcll0n6iFDQZQCL+aQLrrJSy3/9HrKHsDsA1y6z263SZuvXQUZCqIUeDGHdNFNXmr5l/2PDdKx6XD3F9N94foL+4sPgHcfLF+O2yl732Wfu032erA6MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5pflPp/v7YZtOto/M/chQEKXAizmki27yivnHB7f0Ac7uqzMW1mVjVceXjZ07Q72xqnMcLB89OT4zO7JvOLv2yNjBejw+vWvHknPVGgvrumP2HOmxWA8ZCqIUeDGHdNFNXmn+F1xw+SN4mMiDzP3IUBClwIs5pItu8irLf2d85u/bMWxWWQ9YDRkKohR4MYd00U1e5K+BHvzIUBClwIs5pItu8iJ/DfTgR4aCKAVezCFddJMX+WugBz8yFEQp8GIO6aKbvMhfAz34kaEgSoEXc0gX3eRF/hrowY8MBVEKvJhDuugmL/LXQA9+ZCiIUuDFHNJFN3mRvwZ68CNDQZQCL+aQLrrJq0/5h3tdLNO9S+x+y2Zjt5sUr8uOoz7yE0Qp8GIO6aKbvPqW/3Q8u37x+vDe4/pRj7rsa+cPUuO9H4jjh8sfpcfZ1+nYfBnOri8eu/see7z97OSzSj8j3W/fMxnP3m6Pie/rk77etzRKgRdzSBfd5NW3/NMHnMlkdul8bDi71h6zyjqy40fOO959TbqdSq8rbpety8aqrqNv+nrf0igFXswhXXSTV9/yL/0L3OGDln0gOm5t2f2eB7gDD4nj6bpsLF1XXVsf9PneZVEKvJhDuugmr77lHx9ywr8Dt/PoK751Pnb+Ae4Dh/vvKBxbklHZeNxerJMHQ3usNT9mODuTniN9T9nrsrV9X5/09b6lUQq8mEO66CYv8tfQZA9NnqtN+nrf0igFXswhXXSTF/lraKKH+Ne3iy++/Jvsvj5oIkM0jFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdBDffEvjWXjdgyZUQq8mEO66CavkP8ll+x+I0vehR7qL/EBzj7I8V0iiFLgxRzSRTd5hfwvPrE/ZMm70EP9hQe4FqEUeDGHdNFNXuSvgR7qO3xw+9OycTuGzCgFXswhXXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdCDHxkKohR4MYd00U1e5K+BHvzIUBClwIs5tL5NZ7fp82M58tdAD35kKIhS4MUcOm9y4vSVYV03k7rHrSOce5Pntw4+6z471nfbzB/V6MGPDAVRCryYQ+fZB7hkPX+4KRkvXYf/pI0dTxe7r2odX0fp9mQ0uykdO25tTeM9DWc/nW4fvj587+7tcayPqrLDdtGDHxkKohR4MYfOK3uAi4sdr7OOJpPTjzkY+9R833D3mnjMcee250m3zx+397nidvk1WCWfX3iAK/v8vun7/augBz8yFEQp8GIOnVf2ABfWw+HVf6FsvGptVT3ApcfYc4R11THp6xrrDx2+pdTOcPfHwjo992Q4e9p8PZldGsf6yOaPPOjBjwwFUQq8mEP1rZLVKsdWaeIcWB/5a6AHPzIURCnwYg7VVzeruscdp6nzYD3kr4Ee/MhQEKXAizmki27yIn8N9OBHhoIoBV5lc2hnuPvM6XT/QjuO7SrrBttD/hrowY8MBVEKvOwcCtthOTW84kQ6ju2z3WC7yF8DPfiRoSBKgVecQ5PJmZfEhzcWFpZzi/15wfbRgx8ZCqIUeNk5dOmlT/i6MHbq0Y//a+k4ts92g+0ifw304EeGgigFXswhXXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDAVRCryYQ7roJi/y10APfmQoiFLgxRzSRTd5kb8GevAjQ0GUAi/mkC66yYv8NdCDHxkKohR4MYd00U1e5K+BHvzIUBClwIs5pItu8iJ/DfTgR4aCmiwlnCssO+PZ37P71rHs2pbtQz07o9mb7Ng66EIX3eRF/hrowY8MBW2ilHjOnfHeP4yv48Nd8vpmO2637b50LD3m4EHkuqpzmLF7p6O9z9nxkxfu/3V7zvly0e44PTbuKxsLy2RyelJ1HYtzJttV42XnMMfcaI8JGYQljiX7PmrPHbd5gOs+usmL/DXQgx8ZCmqylINz/d7hUnnOg4ecR4X19PABLjrYftdktPcKM1Z5HrvvuO0ojh+s/ySsTw5PX2yPtdtRGI+LHU+3T53Y++Z0e+fEFafsMccpOz659hvDejLc+77iEeWS9xXW4QGu7HNW1cQ5sBl0kxf5a6AHPzIUtO1Sqh7g5vtGey9Kt5dd27J9QdX+9CHmYLkjHbPHlCnbZ8c8D3CXfMvuN4Z12fHJtRce4A7vZf5AWia953TNA1z30U1e5K+BHvzIUNC2Sjl8yFh81rTGP0KN2/F1uj+O2+3zY3vvjK/T4+Ix6T67/2D9LnvsMvbY+ABnrzM9JmWPqzo2OabsAe7Ie+xn23X8R6hl712F9/3YHLrJi/w10IMfGQrKUUqOz7QUrqEJ6X3kuqdcn4vj0U1e5K+BHvzIUBClwIs5pItu8iJ/DfTgR4aClpTyEDsAlFkyh5AZ3eRF/hrowY8MBdlSpqPd28OYHQeqMFd00U1e5K+BHvzIUFAsZTLa+0h8cGNhWXWx8woa6CYv8tdAD35kKMiU8lB+KWNVzBVddJMX+WugBz8yFFRWynA4+ytl40AZ5oouusmL/DXQgx8ZCqIUeDGHdNFNXuSvgR78yFAQpcCLOaSLbvIifw304EeGgigFXswhXXSTF/lroAc/MhREKfBiDumim7zIXwM9+JGhIEqBF3NIF93kRf4a6MGPDGsYj2dnt7mEUuzYppfpdHds7xvNsXlveskxh+w9t8HOiStO2fvY9LLtbibj2X32vlWcHM8eb69308u2898Znf6cvW81+/v7D7PXvell2z2Exd53k05edPpb7Odteulaho2aTGb/M1xwH9xwwxvPTse7v28zgE+YP4+57Gobdye16od7cK6b97//Q/Y2Okmxm3BNH/vYJ+2ldpJi/tHJk1defPXf/n57yZ20qYeQg3P+0dve+sv24zop5Dcdz26xGcjpy8NbdDixH2lzwPrCg3GftGkO2WvvusNu/qLNIYe+fbcGh/k/1GaRW9+6mE7PNP4d1bcMW/E93+NStItpEZtx1yVz6OttFmrstXed0pdu375bA6X8U33sYnCuh0fYLNbVtwxV53JBj0vRLqZFbMZd16Y5ZK+965S66dt3a5Dk/w02j5z62MWg4Z+DvmWo9F1SiVLgZTPuujbNIXvtXafUTd++WwOl/FN97GLQcA99y1B1LhdQCrxsxl3Xpjlkr73rlLrp23droJR/qo9dDBruoW8Zqs7lAkqBl82469o0h+y1d51SN337bg2U8k/1sYtBwz30LUPVuVxAKfCyGXddm+aQvfauU+qmb9+tgVL+qT52MWi4h75lqDqXCygFXjbjrmvTHLLX3nVK3fTtuzVQyj/Vxy4GDffQtwxV53IBpcDLZtx1bZpD9tq7Tqmbvn23Bkr5p/rYxaDhHvqWoepcLqAUeNmMu65Nc8hee9cpdbOp79YXv/CVdkiGUv6pTXWxTPhPQOU0aLiHHBkGdXKsc8yqVOdywbZK2UTA62hFKS1jM14mzIOyuRDHVt0XVI1vSpvmkL32KpvKcFPnraLUTd3v1nvu+fLidZ281nmAq/q5q2OV9ynln6rbRSrc98+9+R2L13Wkxx33Hrvffs/Z9aoGDfewToZlVr2fOsfXOWZVqnO5oKlSjhMDvuq7n7EYe8XLbli8/nc/8wsbKcFqRSktYzNeJnZ88wc/XDq+yhxY9p50bNlx62jTHLLXXsXmZbePc//9D8zX9thVz5O677777dCxlLqp+9267AHufb/+wcLYr/zye0sf4H7nllvtUMHHP/6pIz8H3/v05xW2j1vXoZR/qm4Xqfhz8MUv3GN3LdhsVpnvdn/cfuxlTyxsr2vQcA/rZFimal7Z8brrsjF77nWozuWCpko5jg37h5770vnaLpvWilJaxma8jO3a9r5sDtj3pNvpMWXnDMv+7KmF7XT/Kto0h+y1V7F52O0qL/jhl5ceH7fT8fiQF8eXnTe47bZP2KFjKXVT97u17AEu5mNzCq/LHuDsMak3veEXj5znrf/+l0o/K26XretQyj9Vt4tU2f1XZZXur3odlgcffPDI/nRt3+MxaLiHdTIsY++3LIeqddnx9hi7b12qc7mgqVKOYwMN25/+9F2L7fe8+6Yjx2xCK0ppGZtxHVVdl41X/VCWjb/5jW+fr7/0pf9TeYwV9i3bb7VpDtlrr2LvP922++ooyz19gAsuOXnl4vX7/8vNi9evefXrz/7qf37fYnsVSt3U/W5NH+De8vPvTPacPfvbv/2RQoZVf4FL/wJq+0q3f+SaVyV7zqk63q7rUMo/VbeLVNl920zsMZ/933cvXqf73vtr71+8juL+d7z93YXtyG6vatBwD+tkWCbe1zvf8Z7S8ePWUbpt9zVBdS4XNFVKW7SilJaxGbfRKl8AbZpD9tq7Tqmbpr5bV5mbdaTne9xjnpTs8VPKP9VUF20yaLiHtmTY1M+L6lwuaEspTWlFKS1jM+66Ns0he+1dp9SN6ndr/KcdTf2iSynln1LtYpMGDffQtwxV53IBpcDLZtx1bZpD9tq7Tqmbvn23Bkr5p/rYxaDhHvqWoepcLqAUeNmMu65Nc8hee9cpddO379ZAKf9UH7sYNNxD3zJUncsFlAIvm3HXtWkO2WvvOqVu+vbdGijln+pjF4OGe+hbhqpzuYBS4GUz7ro2zSF77V2n1E3fvlsDpfxTfexi0HAPfctQdS4XUAq8bMZd16Y5ZK+965S66dt3a6CUf6qPXQwa7qFvGarO5QJKgZfNuOvaNIfstXedUjd9+24NlPJP9bGLQcM99C1D1blcQCnwshl3XZvmkL32rlPqpm/frYFS/qk+djFouIe+Zag6lwsoBV7MIV322rtOqZu+/VwESvmn+tbFJnogQ0GT8ezOvhTzgQ/85tnJePdLA/VSWibMn+983JNt3J30uMc+Of2hlp9DoZvbb/99exudZL5wJboJ1/TZz37eXmonKeYfndqZPekfPPU59pI76dSpv2W7aMTBOT8ffof2QchvPNr940HDGW7M/II7vlx00WOfMRD9gmm7yy677JE27y4ug+L8acUcGg4v/yf2Prq4DIq9PLSYQj7j8e5P2Wvt3DKafWUg/nNx4YXfduGR6+7gMtjgd9RFF132JPt5XVwGxfweXkxBly2+ywua95DB0Zy7uvylQbt8/eDoPXR1UWSvscuLsvBgb6+3q8sjBpvxtYOjn9XlBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHn8f+w+zkCFH69gAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,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>