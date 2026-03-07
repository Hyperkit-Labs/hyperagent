<div align="center">
  <img src="/public/ascii-art-doh-HyperAgent.png" alt="HyperAgent ASCII Art" width="800">
  
<!-- Badges: start -->
![Version](https://img.shields.io/badge/version-0.1.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![Status](https://img.shields.io/badge/status-active-success)
<!-- Badges: end -->

HyperAgent is an AI-powered smart contract development platform that transforms natural language specifications into production-ready, audited contracts deployed across multiple EVM chains in minutes.

</div>

## Table of Contents

- [Overview](#overview)
- [Phase 1 (Closed Beta)](#phase-1-closed-beta)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)
- [Acknowledgments](#acknowledgments)

## Overview

HyperAgent is an AI-powered multi-agent platform that turns natural-language specifications into production-ready, audited, simulated, and deployed smart contracts across multiple EVM networks. The system uses a microservice and service-oriented architecture (SOA). Agents communicate via the Agent2Agent (A2A) protocol with ERC-8004 on-chain registries for identity, reputation, and validation. LLM access is BYOK: no server-side LLM keys for user workloads; keys are stored in an isolated, encrypted environment and used only for that user's runs.

**Goal:** Make end-to-end smart contract development verifiable, repeatable, and safe. Developers go from "idea in English" to deployed and monitored contract with as few manual steps as possible, while preserving auditability and human oversight where needed.

## Phase 1 (Closed Beta)

**Current phase:** Closed Beta v0.1.0

- Web-based IDE (HyperAgent Studio)
- Public, user-tested by default
- SKALE Base networks (SKALE Base Mainnet, SKALE Base Sepolia Testnet). Default network: Sepolia.

**User flow:** Connect (wallet) → BYOK (provide LLM keys: Gemini, OpenAI, Claude, OpenRouter) → Approved → Run full pipeline (spec, generate, audit, Tenderly simulation and report, deploy if applicable). Tenderly simulation and report are part of the visible workflow. Users can remove key configuration at any time; keys are wiped with no long-lived exposure.

## Architecture

**Three layers:** client shells, orchestration/agents, and core services. Agents are independent services with well-defined input/output schemas; they communicate over A2A with ERC-8004-compatible on-chain registries.

**Core stack:** Python/FastAPI, Next.js/React/TypeScript, Supabase (PostgreSQL), VectorDB (e.g., Pinecone), Redis, Acontext, Docker, Tenderly. Smart contract tooling: Hardhat, Foundry, Thirdweb SDK.

**Pipeline:** SpecAgent (versioned Spec Lock) → Design and Proposal agents → CodegenAgent (streaming guardrails) → Autofixer and audit agents (Slither, Mythril, MythX, Echidna) → TenderlySimAgent → DeployAgent and VerifyAgent → MonitorAgent. Safety is enforced through Spec Lock, simulation-first validation via Tenderly, and mandatory security tooling.

**Deployment:** Vercel (frontend), Render (backend).

**Networks:** SKALE Base Roadmap includes Mantle, Avalanche, BNB, Arbitrum, and other EVM-compatible chains via chain registry and SDK capability registry (x402, AA, Thirdweb first-class).

## Features

- **Natural language to contracts** – Describe behavior in plain language; get Solidity, tests, and audit-ready artifacts.
- **BYOK** – Bring your own LLM keys (OpenAI, Anthropic, Google, OpenRouter); no server-side LLM config for user workloads.
- **Simulation-first** – Tenderly integration for transaction simulation and reports before deployment.
- **Security tooling** – Slither, Mythril, MythX, Echidna as mandatory pipeline stages.
- **Multi-chain** – Chain and SDK registries for plug-and-play networks
- **Account abstraction** – ERC-4337 and EIP-7702 via Thirdweb; x402 metering where configured.
- **Observability** – OpenTelemetry, MLflow, Tenderly monitoring, Dune dashboards.
- **RAG and memory** – Curated corpora and Acontext for long-term agent memory; IPFS/Pinata, Arweave, Filecoin for artifacts.

## Quick Start

### Prerequisites

- Node.js 18 or higher
- pnpm 8 or higher
- Git
- (Optional) Python 3.11+, Docker for backend

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hyperkit-Labs/hyperagent.git
   cd hyperagent
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment**
   - Local dev: copy `.env.development.example` to `.env`. Production: copy `.env.example` to `.env` or `.env.production`.
   - Set `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` and `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000` with Docker backend).

4. **Start the frontend (Studio)**
   ```bash
   pnpm --filter hyperagent-studio dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

5. **Backend (optional)**  
   If a backend is provided (e.g. API + Docker), follow its run instructions so the API is available at the URL set in `NEXT_PUBLIC_API_URL`. The web app calls that URL for workflows and data.

For full setup and usage, see [Getting started](docs/getting-started.md) and [Developer guide](docs/developer-guide.md).

## Documentation

- [Docs index](docs/README.md) – Onboarding, users, and developers.
- [Getting started](docs/getting-started.md) – First-time setup and run locally.
- [User guide](docs/user-guide.md) – How to use HyperAgent Studio (connect, BYOK, run workflows).
- [Developer guide](docs/developer-guide.md) – Repo structure, local setup, contributing.
- [Platform Blueprint](external/docs/detailed/draft.md) – Full specification (SOA, A2A, ERC-8004, pipeline, registries).
- [Project Details](external/docs/detailed/Project%20Details.md) – Goals, architecture, tech stack, roadmap.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Make your changes; run lint and tests.
4. Commit with a clear message (`git commit -m 'feat: add X'`).
5. Push and open a Pull Request.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Support

- [Documentation](docs/README.md) – Getting started, user guide, developer guide.
- [GitHub Issues](https://github.com/Hyperkit-Labs/hyperagent/issues) – Report bugs or request features.
- [GitHub Discussions](https://github.com/Hyperkit-Labs/hyperagent/discussions) – Questions and ideas.

## Acknowledgments

**Core stack:** [FastAPI](https://fastapi.tiangolo.com/), [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), [pnpm](https://pnpm.io/), [Turbo](https://turbo.build/).

**Web3:** [Thirdweb](https://thirdweb.com/) (x402, account abstraction), [Mantle](https://www.mantle.xyz/), [Pinata](https://www.pinata.cloud/) (IPFS).

**LLM providers (BYOK):** [Anthropic](https://www.anthropic.com/), [OpenAI](https://openai.com/), [Google Gemini](https://deepmind.google/technologies/gemini/), [OpenRouter](https://openrouter.ai/). Keys are user-provided and stored in an isolated, encrypted environment; no server-side LLM keys for user workloads.
