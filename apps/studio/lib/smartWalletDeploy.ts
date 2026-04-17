/**
 * Resolves network id to thirdweb Chain for deployment.
 */

import type { Chain } from "thirdweb/chains";
import {
  mantleMainnet,
  mantleSepoliaTestnet,
  skaleBaseSepolia,
  skaleBaseMainnet,
  filecoinMainnet,
  filecoinCalibration,
  mainnet,
  sepolia,
  avalanche,
  avalancheFuji,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
} from "@/lib/chains";

const NETWORK_TO_CHAIN: Record<string, Chain> = {
  mantle: mantleMainnet,
  "mantle-mainnet": mantleMainnet,
  "mantle-sepolia": mantleSepoliaTestnet,
  "mantle-sepolia-testnet": mantleSepoliaTestnet,
  skale: skaleBaseSepolia,
  "skale-base": skaleBaseMainnet,
  "skale-base-mainnet": skaleBaseMainnet,
  "skalebase-mainnet": skaleBaseMainnet,
  "skale-base-sepolia": skaleBaseSepolia,
  "skalebase-sepolia": skaleBaseSepolia,
  filecoin: filecoinMainnet,
  "filecoin-mainnet": filecoinMainnet,
  "filecoin-calibration": filecoinCalibration,
  ethereum: mainnet,
  mainnet,
  sepolia,
  avalanche,
  fuji: avalancheFuji,
  "avalanche-fuji": avalancheFuji,
  arbitrum,
  "arbitrum-sepolia": arbitrumSepolia,
  base,
  "base-sepolia": baseSepolia,
  bsc,
  "bsc-testnet": bscTestnet,
};

const CHAIN_ID_TO_CHAIN: Record<number, Chain> = {};
for (const chain of Object.values(NETWORK_TO_CHAIN)) {
  const c = chain as { id?: number };
  if (c.id !== undefined) CHAIN_ID_TO_CHAIN[c.id] = chain;
}

export function getChainFromNetwork(network: string): Chain {
  const key = network.toLowerCase().replace(/\s+/g, "-");
  const chain = NETWORK_TO_CHAIN[key];
  if (chain) return chain;
  const byId = Object.entries(NETWORK_TO_CHAIN).find(
    ([k]) => k.includes(key) || key.includes(k),
  );
  if (byId) return byId[1];
  return skaleBaseSepolia;
}

export function getChainByChainId(chainId: number): Chain | undefined {
  return CHAIN_ID_TO_CHAIN[chainId];
}
