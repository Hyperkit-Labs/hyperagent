# TypeScript Orchestrator (Reference Only)

This TypeScript orchestrator implementation is a reference implementation of a spec-locked state machine following the DNA blueprint.

## Current Architecture

**Python backend handles ALL orchestration:**
- Workflow coordination
- Service orchestration
- State management
- Event bus

**TypeScript is used for:**
- x402 payment verification (`services/x402-verifier/`)

## Production Implementation

For actual workflow orchestration, see:
- `hyperagent/core/orchestrator.py` (Python)
- `hyperagent/architecture/soa.py` (Service registry)
- `docs/ARCHITECTURE_SIMPLIFIED.md` (Architecture overview)

