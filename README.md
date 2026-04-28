<div align="center">
  <img src="/public/ascii-art-doh-HyperAgent.png" alt="HyperAgent ASCII Art" width="800">
  
<!-- Badges: start -->
![Version](https://img.shields.io/badge/version-0.1.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![Status](https://img.shields.io/badge/status-active-success)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Hyperkit-Labs/hyperagent)
<!-- Badges: end -->

HyperAgent is an AI-assisted smart contract development platform that turns natural language specifications into draft artifacts with automated checks, an audit workflow, simulation, and deploy preparation for SKALE Base Mainnet and SKALE Base Sepolia in the current release.

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

HyperAgent is an AI-powered multi-agent platform that turns natural-language specifications into draft contracts and artifacts with automated checks, audit workflow stages, Tenderly simulation, and deploy preparation on SKALE Base Mainnet and SKALE Base Sepolia for v0.1.0. The system uses a microservice and service-oriented architecture (SOA). Agents communicate via the Agent2Agent (A2A) protocol with ERC-8004 on-chain registries for identity, reputation, and validation. LLM access is BYOK: no server-side LLM keys for user workloads; keys are stored in an isolated, encrypted environment and used only for that user's runs.

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

**Pipeline:** SpecAgent (versioned Spec Lock) → Design and Proposal agents → CodegenAgent (streaming guardrails) → Autofixer and audit agents (Slither, Mythril, MythX, Echidna) → TenderlySimAgent → DeployAgent and VerifyAgent → MonitorAgent. Safety is enforced through Spec Lock, Tenderly simulation in the workflow, and mandatory security tooling where the pipeline is configured.

**Deployment:** Vercel (frontend), Contabo/Coolify (backend).

**Networks:** v0.1.0 supports only SKALE Base Mainnet and SKALE Base Sepolia. Other chain registry entries remain roadmap or configuration scaffolding and are not a launch-ready support claim.

## Features

- **Natural language to contracts** – Describe behavior in plain language; get Solidity, tests, and artifacts for the audit workflow (static analysis and fuzzing).
- **BYOK** – Bring your own LLM keys (OpenAI, Anthropic, Google, OpenRouter); no server-side LLM config for user workloads.
- **Tenderly simulation** – Transaction simulation and reports in the pipeline before deploy when your environment and workflow enable it.
- **Security tooling** – Slither, Mythril, and related tools run when the audit service is deployed and reachable; gates use findings when the audit stage completes (not a substitute for human review on high-value contracts).
- **Supported network scope** – v0.1.0 is scoped to SKALE Base Mainnet and SKALE Base Sepolia. Other chains in the repo are roadmap, not current support.
- **Account abstraction and payments** – ERC-4337 and EIP-7702 via Thirdweb; x402 is the intended payment wall for supported user flows, with current enforcement gaps tracked in the honesty docs.
- **Metrics and tracing** – OpenTelemetry, MLflow, Tenderly monitoring, Dune dashboards where the deployment wires them.
- **RAG and memory** – Curated corpora and Acontext for long-term agent memory; artifact storage via IPFS/Pinata (and compatible providers) per `docs/storage-policy.md`.

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

4. **Start the stack in order (Studio first, then backend)**  
   - **Recommended:** from the repo root run `pnpm run dev:ordered` (or `make dev-ordered`). This starts HyperAgent Studio (Next.js) and waits until it responds on port 3000, then tells you to run the backend. In a second terminal run `make up` to start the API gateway and Python services (`.env` must include Supabase, Redis/Upstash, and related settings).  
   - **One terminal (Studio, then Docker):** `pnpm run dev:ordered:stack` or `make dev-ordered-stack` (requires Docker; runs `docker compose` in `infra/docker` after Studio is up).  
   - **Studio only:** `pnpm --filter hyperagent-studio dev` or `make run-web`, then start the backend when you are ready.

5. Open [http://localhost:3000](http://localhost:3000) for Studio. The gateway (when `make up` is running) is at [http://localhost:4000](http://localhost:4000) by default.

6. **Supabase and database** follow your `.env`: use your cloud Supabase project, or for local DB use the compose profile described in the developer guide (`make up-local` and migrations as documented).

For full setup and usage, see [Getting started](docs/introduction/getting-started.md) and the [Contributor guide](docs/contributing/developer-guide.md).

## Documentation

- [Capability truth table](docs/control-plane/capability-truth-table.md) – What is implemented vs partial vs not shipped (living document).
- [Docs index](docs/README.md) – Onboarding, Studio usage, and contributor references.
- **MkDocs site** – `pip install -r requirements-docs.txt && mkdocs serve` for searchable HTML (see [docs/documentation-site.md](docs/documentation-site.md)).
- [Getting started](docs/introduction/getting-started.md) – First-time setup and run locally.
- [Studio guide](docs/user-guide.md) – HyperAgent Studio (connect, BYOK, run workflows).
- [Contributor guide](docs/contributing/developer-guide.md) – Repository layout, local setup, contributing.

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

**Web3:** [Thirdweb](https://thirdweb.com/) (x402, account abstraction), [SKALE](https://skale.space/), [Pinata](https://www.pinata.cloud/) (IPFS).

**LLM providers (BYOK):** [Anthropic](https://www.anthropic.com/), [OpenAI](https://openai.com/), [Google Gemini](https://deepmind.google/technologies/gemini/), [OpenRouter](https://openrouter.ai/). Keys are user-provided and stored in an isolated, encrypted environment; no server-side LLM keys for user workloads.
