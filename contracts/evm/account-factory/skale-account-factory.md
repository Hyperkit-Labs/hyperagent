# SKALE AccountFactory Deployment

Thirdweb's shared AccountFactory is not deployed on SKALE Base Sepolia or SKALE Base Mainnet. HyperAgent deploys its own thirdweb-compatible AccountFactory on those chains and configures Studio to use it via `factoryAddress`.

## Official AccountFactory (SKALE Base Sepolia)

HyperAgent's official AccountFactory is deployed on SKALE Base Sepolia:

| Field | Value |
|-------|-------|
| **Factory address** | `0x16aE460b084501F9A55Ad7f98c6576a01881Bbc9` |
| defaultAdmin | `0x16aE460b084501F9A55Ad7f98c6576a01881Bbc9` |
| Explorer | [SKALE Base Sepolia Explorer](https://base-sepolia-testnet-explorer.skalenodes.com/address/0x16aE460b084501F9A55Ad7f98c6576a01881Bbc9) |

Set `NEXT_PUBLIC_SKALE_BASE_SEPOLIA_FACTORY_ADDRESS=0x16aE460b084501F9A55Ad7f98c6576a01881Bbc9` and `NEXT_PUBLIC_SPONSOR_GAS=true` to use it.

## Prerequisites (for custom deployment)

- `THIRDWEB_SECRET_KEY` (backend only)
- Wallet with CREDIT for gas on SKALE Base Sepolia (faucet: https://base-sepolia-faucet.skale.space/)
- ERC-4337 v0.6 EntryPoint deployed on the target chain (canonical: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`; deploy if SKALE does not have it)

## Deployment Options

### Option 1: thirdweb Dashboard

1. Go to [thirdweb.com/contracts](https://thirdweb.com/contracts)
2. Find **AccountFactory** (thirdweb.eth)
3. Deploy to SKALE Base Sepolia (chain ID 324705682) or SKALE Base Mainnet (1187947933)
4. Constructor params: `defaultAdmin` (deployer address), `entrypoint` (EntryPoint address)
5. Copy the deployed factory address

### Option 2: thirdweb CLI

```bash
npx thirdweb create contract
# Select: AccountFactory (or custom)
# Edit constructor: defaultAdmin, entrypoint

npx thirdweb deploy -k $THIRDWEB_SECRET_KEY
# Select chain: SKALE Base Sepolia (324705682) or SKALE Base Mainnet (1187947933)
```

### Option 3: Deploy Published Contract (SDK)

```ts
import { deployPublishedContract } from "thirdweb/deploys";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY });
const address = await deployPublishedContract({
  client,
  chain: skaleBaseSepolia,
  account: deployerAccount,
  contractId: "AccountFactory",
  publisher: "0xthirdweb.eth",
  contractParams: {
    defaultAdmin: "0x...",
    entrypoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  },
});
```

## Environment Variables

After deploying, set in `.env`:

```env
# SKALE Base Sepolia (official factory)
NEXT_PUBLIC_SPONSOR_GAS=true
NEXT_PUBLIC_SKALE_BASE_SEPOLIA_FACTORY_ADDRESS=0x16aE460b084501F9A55Ad7f98c6576a01881Bbc9
NEXT_PUBLIC_SKALE_BASE_SEPOLIA_BUNDLER_URL=https://324705682.bundler.thirdweb.com
NEXT_PUBLIC_SKALE_BASE_SEPOLIA_ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
NEXT_PUBLIC_SKALE_BASE_SEPOLIA_SPONSOR_GAS=true

# SKALE Base Mainnet (when ready)
NEXT_PUBLIC_SKALE_BASE_MAINNET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_SKALE_BASE_MAINNET_BUNDLER_URL=https://1187947933.bundler.thirdweb.com
NEXT_PUBLIC_SKALE_BASE_MAINNET_ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
NEXT_PUBLIC_SKALE_BASE_MAINNET_SPONSOR_GAS=true
```

## Rollout Sequence

1. Deploy factory on SKALE Base Sepolia first
2. Verify smart-wallet connect, account creation, and sponsored send in Studio
3. Freeze EntryPoint/factory combination after passing tests
4. Deploy the same validated stack to SKALE Base Mainnet

## Chain Registry

| Chain            | ID        | RPC                                                                 |
|------------------|-----------|---------------------------------------------------------------------|
| SKALE Base Sepolia | 324705682 | https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha |
| SKALE Base Mainnet | 1187947933 | https://skale-base.skalenodes.com/v1/base                          |

## Notes

- The Account contract is non-upgradeable; treat the account model as long-lived
- Use v0.6 EntryPoint; v0.7 requires a compatible factory
- thirdweb bundler URL format: `https://{chainId}.bundler.thirdweb.com`
- Register SKALE chains in thirdweb dashboard if bundler returns 404
