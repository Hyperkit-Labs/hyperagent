/**
 * Thirdweb chain definitions for HyperAgent Studio.
 *
 * Strategy:
 *   - Standard EVM chains: re-export directly from thirdweb/chains. When a
 *     Thirdweb clientId is configured the SDK routes RPC calls through
 *     authenticated Thirdweb endpoints, avoiding third-party aggregator 403s.
 *   - Custom chains not in Thirdweb's registry: use defineChain with an
 *     explicit RPC URL. Currently: SKALE Base Mainnet and SKALE Base Sepolia
 *     (v0.1.0 launch targets), Mantle, Filecoin.
 *
 * v0.1.0 user-facing support is limited to SKALE Base Mainnet and SKALE Base
 * Sepolia. All other chains are roadmap / configuration scaffolding.
 * Chain IDs and RPCs must match infra/registries/network/chains.yaml.
 */

import { defineChain } from "thirdweb/chains";

// --- Standard EVM chains (from Thirdweb registry) ---
// These use Thirdweb's managed RPC infrastructure when clientId is set.
export {
  mainnet,
  sepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
  avalanche,
  avalancheFuji,
  bsc,
  bscTestnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
} from "thirdweb/chains";

// --- Mantle (not always present in older Thirdweb SDK versions) ---
// defineChain ensures explicit RPC is used regardless of SDK version.
export const mantleMainnet = defineChain({
  id: 5000,
  name: "Mantle",
  nativeCurrency: { decimals: 18, name: "MNT", symbol: "MNT" },
  rpc: "https://rpc.mantle.xyz",
  blockExplorers: [{ name: "Mantlescan", url: "https://mantlescan.xyz" }],
});

export const mantleSepoliaTestnet = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { decimals: 18, name: "MNT", symbol: "MNT" },
  rpc: "https://rpc.sepolia.mantle.xyz",
  blockExplorers: [
    { name: "Mantlescan", url: "https://sepolia.mantlescan.xyz" },
  ],
  testnet: true,
});

// --- Filecoin (FEVM) — custom chain ---
export const filecoinMainnet = defineChain({
  id: 314,
  name: "Filecoin",
  nativeCurrency: { decimals: 18, name: "FIL", symbol: "FIL" },
  rpc: "https://api.node.glif.io/rpc/v1",
  blockExplorers: [{ name: "Filfox", url: "https://filfox.info" }],
});

export const filecoinCalibration = defineChain({
  id: 314159,
  name: "Filecoin Calibration",
  nativeCurrency: { decimals: 18, name: "FIL", symbol: "tFIL" },
  rpc: "https://api.calibration.node.glif.io/rpc/v1",
  blockExplorers: [{ name: "Filfox", url: "https://calibration.filfox.info" }],
  testnet: true,
});

// --- SKALE Base (v0.1.0 launch targets, custom chain — not in Thirdweb registry) ---
// Gas is free on SKALE (CREDIT token). x402 payments require wallet signature only.
export const skaleBaseSepolia = defineChain({
  id: 324705682,
  name: "SKALE Base Sepolia",
  nativeCurrency: { decimals: 18, name: "CREDIT", symbol: "CREDIT" },
  rpc: "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
  blockExplorers: [
    {
      name: "SKALE Explorer",
      url: "https://base-sepolia-testnet-explorer.skalenodes.com/",
    },
  ],
  testnet: true,
});

export const skaleBaseMainnet = defineChain({
  id: 1187947933,
  name: "SKALE Base",
  nativeCurrency: { decimals: 18, name: "CREDIT", symbol: "CREDIT" },
  rpc: "https://skale-base.skalenodes.com/v1/base",
  blockExplorers: [
    {
      name: "SKALE Explorer",
      url: "https://skale-base-explorer.skalenodes.com/",
    },
  ],
});
