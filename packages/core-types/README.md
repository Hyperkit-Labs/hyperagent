# Core types

Status: real runtime-contract package.

This package is the shared contract surface used by active HyperAgent services and toolkits. It owns cross-service request/response types, chain constants, and BYOK-safe helper utilities.

Current source-of-truth files:
- `index.ts` for authored TypeScript contracts and helpers
- `index.js` / `index.d.ts` for the committed runtime/type entrypoints consumed by workspace packages
- `run-model.json` for the canonical run-model schema shared with backend systems

Verification:
- `node --test packages/core-types/index.test.js`
