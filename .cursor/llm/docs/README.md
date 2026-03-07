# LLM Documentation Resources

This directory contains curated `llm.txt` files for each major dependency, library, and service used in HyperAgent. These files follow the [llms.txt standard](https://llmstxt.org/) to help AI systems understand and work with external documentation.

## Purpose

Each `llm.txt` file provides:
- Overview of the technology and its role in HyperAgent
- Key use cases and implementation details
- Links to official documentation
- Code examples relevant to HyperAgent
- Best practices for integration

## Available Resources

All files are located in this `docs/` directory. Each file follows the [llms.txt standard](https://llmstxt.org/).

### Core Frameworks & Languages
- **thirdweb-llm.txt** - Thirdweb SDK for wallets, ERC-4337, EIP-7702, and deployments
- **langgraph-llm.txt** - LangGraph for agent orchestration and workflow management
- **fastapi-llm.txt** - FastAPI for backend API gateway and REST endpoints
- **nextjs-llm.txt** - Next.js 14+ for frontend with App Router
- **nextjs-react-llm.txt** - Combined Next.js and React patterns

### Blockchain & Web3
- **wagmi-llm.txt** - React Hooks for Ethereum, wallet connections, and contract interactions
- **viem-llm.txt** - TypeScript interface for Ethereum, low-level blockchain access
- **tenderly-llm.txt** - Smart contract simulation, debugging, and monitoring platform
- **hardhat-llm.txt** - Ethereum development environment and testing framework
- **foundry-llm.txt** - Fast Ethereum toolkit (Forge, Cast, Anvil, Chisel)
- **hardhat-foundry-llm.txt** - Combined Hardhat and Foundry patterns
- **multi-chain-sdk-llm.txt** - Multi-chain SDK integration (Avalanche, BNB, Filecoin FVM, SKALE): install, deploy, verify, unified DeployParams/DeployResult, chain registry alignment

### AI & Orchestration
- **langchain-llm.txt** - Framework for developing LLM-powered applications
- **elements-ai-sdk.txt** - AI Elements (shadcn registry) for AI-native UI in Studio chat and agents

### Infrastructure & Data
- **supabase-llm.txt** - Supabase (PostgreSQL) for database, multi-tenant workspaces, and RLS
- **redis-llm.txt** - Redis for caching, message queuing, and session management
- **pinecone-llm.txt** - Pinecone vector database for RAG and semantic search
- **acontext-llm.txt** - Acontext for agent long-term memory and context management

### Smart Contract Development
- **openzeppelin-llm.txt** - OpenZeppelin Contracts library for secure contract templates
- **slither-mythril-llm.txt** - Slither, Mythril, MythX, and Echidna for security auditing

### Blockchain Standards
- **erc-4337-llm.txt** - ERC-4337 Account Abstraction for gasless transactions and smart wallets
- **erc-8004-llm.txt** - ERC-8004 Trustless Agents for agent identity and reputation
- **erc1066-x402-llm.txt** - ERC-1066-x402 SDKs (npm: hyperkit-erc1066, PyPI: hyperkitlabs-erc1066-x402)

### Storage & Data Availability
- **ipfs-pinata-llm.txt** - IPFS and Pinata for decentralized artifact storage and RAG
- **eigenda-llm.txt** - EigenDA for verifiable data availability and agent traces

### Observability & Monitoring
- **opentelemetry-llm.txt** - OpenTelemetry for distributed tracing and metrics
- **mlflow-llm.txt** - MLflow for LLM experiment tracking and model routing
- **tenderly-llm.txt** - Tenderly for contract simulation, debugging, and monitoring
- **dune-analytics-llm.txt** - Dune Analytics for on-chain analytics and dashboards

### DevOps & Deployment
- **docker-llm.txt** - Docker and Docker Compose for containerization (infra/docker)

## Usage

When working on HyperAgent features that involve external dependencies:

1. **Check the relevant `llm.txt` file first** - It contains HyperAgent-specific context
2. **Reference official docs** - Links provided for detailed information
3. **Follow best practices** - Each file includes integration best practices
4. **Use code examples** - Examples are tailored to HyperAgent's use cases

## File Structure

Each `llm.txt` file follows this structure:

```markdown
# [Technology] Documentation for HyperAgent

## Overview
Brief description and role in HyperAgent

## Key Use Cases in HyperAgent
Specific use cases in the project

## Documentation Links
Links to official documentation

## Implementation in HyperAgent
Where and how it's used in the codebase

## Code Examples
Relevant code examples

## Best Practices
Integration best practices

## Related Resources
Additional resources
```

## Maintenance

- Update files when dependencies change
- Add new dependencies as they are integrated
- Keep documentation links current
- Update code examples when implementation changes
- Implementation locations use current monorepo layout: `apps/studio`, `services/*` (orchestrator, agent-runtime, audit, codegen, deploy, simulation, storage, context), `packages/*`, `infra/registries`. See repo root `README.md` and `.cursor/commands/repo-map.md`.

## Contributing

When adding a new dependency:
1. Create a new `{dependency}-llm.txt` file
2. Follow the standard structure
3. Include HyperAgent-specific context
4. Add links to official documentation
5. Update this README

