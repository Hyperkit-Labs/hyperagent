# OpenZeppelin Wizard–compatible generator conventions

HyperAgent codegen targets **OpenZeppelin Contracts 5.x** patterns so exports from the [OpenZeppelin Wizard](https://wizard.openzeppelin.com/) map cleanly into generated repos.

## Layout

| Wizard / OZ pattern | Generated path | Notes |
|---------------------|----------------|--------|
| ERC20 / ERC721 / ERC1155 | `src/token/` or `src/` root | Single primary contract per file |
| AccessControl | `src/access/` | `DEFAULT_ADMIN_ROLE` documented in NatSpec |
| Ownable | same module as token | Prefer AccessControl for multi-admin factories |
| UUPS / Transparent proxy | `src/proxy/` | Use `@openzeppelin/contracts/proxy/` imports |
| Upgradeable | `*-upgradeable` imports | Match `contracts-upgradeable` remapping |

## Solidity settings

- **Pragma:** `^0.8.24` unless the target chain compiler requires a narrower range.
- **Optimizer:** enabled, `runs = 200` default (tune per deploy gas vs size).
- **EVM version:** `paris` baseline in `foundry.toml` and Hardhat; bump only with chain requirements.

## Naming

- **Contracts:** PascalCase; interfaces `IThing.sol`.
- **Files:** one top-level contract per file; filename matches main contract.
- **Tests:** Foundry `test/foundry/*.t.sol`, Hardhat `test/hardhat/*.ts`.

## Import style

Use npm-style remappings aligned with Foundry:

- `@openzeppelin/contracts/...`
- `forge-std/...`

Do not mix relative `../../lib/openzeppelin` paths in generated code; keep remappings authoritative.

## Security tooling hooks

Every generated project should include or symlink:

- `packages/contract-security-rules/slither.config.json`
- An `echidna.config.yml` pointing at a harness under `test/foundry/` or `echidna/`

## Wizard JSON (optional)

If the product stores Wizard export JSON, keep a `wizard-manifest.json` next to `src/` with:

- `contractName`, `ozVersion`, `kind` (ERC20, etc.)
- Hash of the last exported source set (for drift detection in CI)
