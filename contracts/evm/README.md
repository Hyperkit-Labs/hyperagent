# HyperAgent EVM contracts

**Foundry** is the primary toolchain (`forge build`, `forge test`). **Hardhat** compiles the same `src/` tree for teams that need the Node ecosystem.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## One-time setup

```bash
cd contracts/evm
forge install foundry-rs/forge-std
```

Optional OpenZeppelin (for generated Wizard code):

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
```

## Commands

```bash
forge build
forge test -vvv
forge fmt
```

Hardhat (after `pnpm install` in this directory from repo root):

```bash
pnpm exec hardhat compile
pnpm exec hardhat test
```

## Layout

| Path | Role |
|------|------|
| `src/` | Production Solidity (interfaces, libraries, tokens) |
| `test/foundry/` | Forge tests and Echidna smoke harness |
| `test/hardhat/` | Hardhat/Mocha tests |
| `test/fixtures/patterns/` | JSON fixtures for simulation and fork tests |
| `script/` | Deployment and verification scripts |

## Security baselines

Shared Slither / Echidna / Solhint configs live in `packages/contract-security-rules/`. CI runs Slither and a short Echidna smoke pass.

OpenZeppelin Wizard alignment: `docs/contracts/oz-wizard-conventions.md`.

Verification helper: `scripts/contracts/verify-deployment.sh`.
