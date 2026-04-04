# Contract security rules (OSS baseline)

Shared configuration for **Slither**, **Echidna**, and **Solhint** used across HyperAgent-generated contracts and `contracts/evm`.

## Contents

| File | Purpose |
|------|---------|
| `slither.config.json` | Detector filters, path exclusions (`lib/`, vendor tests) |
| `echidna/echidna.config.template.yml` | Baseline fuzz config; copy to `contracts/evm/echidna.config.yml` per project |
| `echidna/templates/*.sol` | Harness patterns (ERC20/721-style); replace `Target` with generated contract name |
| `solhint/solhint.json` | Style and safety lint rules for Solidity |

## Usage

**Slither** (from `contracts/evm` after `forge build`):

```bash
slither . --config-file ../../packages/contract-security-rules/slither.config.json
```

**Echidna**: copy `echidna/echidna.config.template.yml` to your project root, point `cryticArgs` at the same remappings as Foundry, set `contract` to your harness.

**Codegen**: the orchestrator and audit pipeline should copy or merge these files into generated project roots so factory output stays aligned with CI.
