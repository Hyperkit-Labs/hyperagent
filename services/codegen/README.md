# Codegen

LLM code generation and Solidity compilation entry point.

- **Generate (LLM):** `POST /generate` proxies to agent-runtime `POST /agents/codegen` (spec + design + BYOK context). The actual code generation runs in the agent-runtime.
- **Compile (build):** `POST /compile` proxies to the compile service (Hardhat/Foundry). See `services/compile/`.

So this service is a thin facade; the orchestrator can call either this service or agent-runtime + compile directly. See `docs/detailed/Monorepo.md`.
