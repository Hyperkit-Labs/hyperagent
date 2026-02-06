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

### Core Frameworks
- **thirdweb-llm.txt** - Thirdweb SDK for wallets, ERC-4337, and deployments
- **langgraph-llm.txt** - LangGraph for agent orchestration
- **fastapi-llm.txt** - FastAPI for backend API
- **nextjs-react-llm.txt** - Next.js and React for frontend

### Infrastructure
- **supabase-llm.txt** - Supabase for database and multi-tenant workspaces
- **redis-llm.txt** - Redis for caching and message queuing
- **pinecone-llm.txt** - Pinecone for vector database and RAG
- **acontext-llm.txt** - Acontext for agent long-term memory

### Blockchain & Smart Contracts
- **hardhat-foundry-llm.txt** - Hardhat and Foundry for Solidity development
- **openzeppelin-llm.txt** - OpenZeppelin Contracts library
- **slither-mythril-llm.txt** - Security auditing tools
- **erc-4337-llm.txt** - Account Abstraction standard
- **erc-8004-llm.txt** - Trustless Agents standard

### Storage & Data
- **ipfs-pinata-llm.txt** - IPFS and Pinata for decentralized storage
- **eigenda-llm.txt** - EigenDA for verifiable data availability

### Observability
- **opentelemetry-llm.txt** - OpenTelemetry for distributed tracing
- **mlflow-llm.txt** - MLflow for ML experiment tracking
- **tenderly-llm.txt** - Tenderly for contract simulation and monitoring
- **dune-analytics-llm.txt** - Dune Analytics for on-chain analytics

### LLM Providers
- **anthropic-openai-llm.txt** - Anthropic (Claude) and OpenAI (GPT) for code generation
- **gemini-llm.txt** - Google Gemini for fast, cost-effective generation

### Payments
- **x402-llm.txt** - x402 payment protocol for SKALE

### DevOps & Deployment
- **docker-llm.txt** - Docker and Docker Compose for containerization

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
- Add new dependencies as they're integrated
- Keep documentation links current
- Update code examples when implementation changes

## Contributing

When adding a new dependency:
1. Create a new `{dependency}-llm.txt` file
2. Follow the standard structure
3. Include HyperAgent-specific context
4. Add links to official documentation
5. Update this README

